// 📝 写作工坊：学结构/技法 → 小练笔（即时表达力分析）→ 作品集
import { h, btn, note, pick, sfx, toast, modal } from '../ui.js';
import { speak, recognize, hasASR } from '../speech.js';
import { finishScreen, collectBtn, speakBtn } from '../components.js';
import { state, addXP, addWork, markUsed, markDone, save } from '../state.js';
import { STRUCTURES, OPENINGS, ENDINGS, TECHNIQUES, PROMPTS, IMITATE } from '../data/writing.js';
import { ALL_IDIOMS, GOOD_WORDS } from '../data/words.js';
import { analyzeWriting, hanCount } from '../score.js';
import { forStage, menuGrid, listItem, lvTag } from './common.js';
import { aiAvailable, reviewWriting } from './ai.js';

export function page(root, nav, params = {}) {
  nav.title('📝 写作工坊');
  if (params.m === 'learn') return learn(root, nav, params.k);
  if (params.m === 'write') return writePage(root, nav, params);
  if (params.m === 'imitate') return imitateList(root, nav);
  if (params.m === 'works') return worksPage(root, nav, params.id);
  root.replaceChildren(
    h('p', { class: 'intro' }, note('写作 = 有话可说（积累）+ 有条理（结构）+ 说得好（技法）。先学一个方法，马上在小练笔里用上！')),
    menuGrid([
      { icon: '✍️', title: '每日小练笔', sub: '写完立刻看"表达力"', onClick: () => nav.go('writing', { m: 'write' }) },
      { icon: '🍔', title: '结构模板', sub: '总分总·起承转合…', onClick: () => nav.go('writing', { m: 'learn', k: 'struct' }) },
      { icon: '🚪', title: '开头与结尾', sub: '凤头·豹尾', onClick: () => nav.go('writing', { m: 'learn', k: 'oe' }) },
      { icon: '🪄', title: '写作小技法', sub: '把"很"字变成画面', onClick: () => nav.go('writing', { m: 'learn', k: 'tech' }) },
      { icon: '🪞', title: '仿写练习', sub: '学名段的写法', onClick: () => nav.go('writing', { m: 'imitate' }) },
      { icon: '📂', title: '我的作品集', sub: `${state.works.length} 篇`, onClick: () => nav.go('writing', { m: 'works' }) },
    ]));
}

// ---------- 学方法 ----------
function learn(root, nav, k) {
  const s = state.settings.stage;
  if (k === 'struct') {
    const list = STRUCTURES.filter((x) => x.lv <= s + 1);
    root.replaceChildren(h('p', { class: 'intro' }, note('每种结构都附一篇示范。学完点"用它写一篇"，马上练！')),
      list.map((st) => h('details', { class: 'panel learn' },
        h('summary', {}, h('b', {}, st.icon, ' ', st.name), ' ', lvTag(st.lv), h('div', { class: 'muted small' }, st.one)),
        h('ol', {}, st.steps.map((x) => h('li', {}, x))),
        h('div', { class: 'example' }, h('div', { class: 'muted small' }, '示范：'), st.example.split('\n').map((l) => h('p', {}, l))),
        h('div', { class: 'row center' }, btn('🔊 听示范', () => speak(st.example.replace(/\n/g, '')), 'soft small'), btn('✍️ 用它写一篇', () => nav.go('writing', { m: 'write', struct: st.id }), 'primary small')))));
    return;
  }
  if (k === 'oe') {
    const o = OPENINGS.filter((x) => x.lv <= s + 1);
    const e = ENDINGS.filter((x) => x.lv <= s + 1);
    const card = (x) => h('div', { class: 'panel' }, h('b', {}, x.name), ' ', lvTag(x.lv), h('p', { class: 'example' }, x.ex, ' ', speakBtn(x.ex)), note('💡 ' + x.tip, 'small'), h('div', {}, collectBtn('sentence', x.ex, x.name)));
    root.replaceChildren(h('p', { class: 'intro' }, note('古人说文章要"凤头、猪肚、豹尾"：开头像凤凰头一样漂亮，结尾像豹子尾巴一样有力。')),
      h('h3', {}, '🚪 开头'), o.map(card), h('h3', {}, '🎬 结尾'), e.map(card));
    return;
  }
  const t = TECHNIQUES.filter((x) => x.lv <= s + 1);
  root.replaceChildren(h('p', { class: 'intro' }, note('对比一下"大白话"和"有画面的话"，看看差别在哪里。')),
    t.map((x) => h('div', { class: 'panel' }, h('h3', {}, '🪄 ', x.name, ' ', lvTag(x.lv)),
      h('div', { class: 'cmp' }, h('div', { class: 'cmp-bad' }, h('div', { class: 'small' }, '😐 大白话'), x.bad), h('div', { class: 'cmp-good' }, h('div', { class: 'small' }, '🤩 有画面'), x.good, ' ', speakBtn(x.good))),
      note('💡 ' + x.tip, 'small'))));
}

// ---------- 写作编辑器（小练笔 / 仿写 / 自由写） ----------
function writePage(root, nav, params) {
  let prompt;
  if (params.imitate != null) {
    const im = IMITATE[Number(params.imitate)];
    prompt = { t: '仿写：' + im.title, hint: im.task, model: im.model, focus: im.focus, example: im.example, len: 40, words: [], kind: 'imitate' };
  } else {
    const st = params.struct ? STRUCTURES.find((x) => x.id === params.struct) : null;
    const p = params.t ? PROMPTS.find((x) => x.t === params.t) : pick(forStage(PROMPTS, 3));
    prompt = { ...p, kind: 'practice', struct: st };
  }
  return writeEditor(root, prompt).then((r) => finishScreen(root, { score: r.score, xp: r.xp, title: '写完啦！✍️', extra: r.extra, onDone: () => nav.go('writing') }));
}

/** 写作编辑器，返回 { score, xp, extra }。daily 也会调用。 */
export function writeEditor(root, prompt) {
  return new Promise((resolve) => {
    const draftKey = 'kcz.draft.' + prompt.t;
    let draft = '';
    try { draft = localStorage.getItem(draftKey) || ''; } catch { /* */ }
    const ta = h('textarea', { class: 'editor', rows: 10, placeholder: '在这里写……（也可以点🎤用说的，说完再修改）' });
    ta.value = draft;
    const counter = h('span', { class: 'muted small' });
    const target = prompt.len || 100;
    const live = h('div', { class: 'live-tips' });
    const mine = state.material.filter((m) => m.kind === 'word' || m.kind === 'idiom').slice(-12);
    const update = () => {
      const n = hanCount(ta.value);
      counter.textContent = `${n} / ${target} 字`;
      counter.classList.toggle('ok', n >= target);
      try { localStorage.setItem(draftKey, ta.value); } catch { /* */ }
      const used = mine.filter((m) => ta.value.includes(m.text)).map((m) => m.text);
      live.replaceChildren(used.length ? h('span', { class: 'small' }, '📒 已用上：', used.join('、')) : null);
    };
    ta.addEventListener('input', update);
    const mic = hasASR ? btn('🎤 口述', async () => {
      mic.disabled = true;
      mic.classList.add('listening');
      mic.textContent = '👂 说吧…';
      const { alts } = await recognize({ timeout: 30000 });
      mic.disabled = false;
      mic.classList.remove('listening');
      mic.textContent = '🎤 口述';
      if (alts[0]) {
        ta.value += alts[0] + (/[。！？]$/.test(alts[0]) ? '' : '。');
        update();
      }
    }, 'soft small') : null;
    const insert = (w) => {
      const pos = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, pos) + w + ta.value.slice(pos);
      ta.focus();
      update();
    };
    const wordBox = [...new Set([...(prompt.words || []), ...mine.map((m) => m.text)])];

    root.replaceChildren(h('div', { class: 'activity' },
      h('div', { class: 'say-card left' },
        h('div', { class: 'muted small' }, prompt.kind === 'imitate' ? '仿写' : '今日练笔'),
        h('h2', {}, prompt.t),
        h('p', {}, '💡 ', prompt.hint),
        prompt.model ? h('div', { class: 'example' }, h('div', { class: 'muted small' }, '原文：'), prompt.model, h('div', { class: 'small' }, '👉 学它的：', prompt.focus)) : null,
        prompt.struct ? h('div', { class: 'example' }, h('b', {}, prompt.struct.icon, ' 用"', prompt.struct.name, '"来写：'), h('ol', {}, prompt.struct.steps.map((x) => h('li', { class: 'small' }, x)))) : null),
      wordBox.length ? h('div', { class: 'panel' }, h('div', { class: 'small muted' }, '试着用上这些词（点一下插入）：'), h('div', { class: 'word-grid' }, wordBox.map((w) => h('button', { class: 'word-chip', type: 'button', onclick: () => insert(w) }, w)))) : null,
      ta,
      h('div', { class: 'row' }, counter, h('span', { class: 'grow' }), mic, btn('✓ 写好了', submit, 'primary')),
      live));
    update();

    function submit() {
      const text = ta.value.trim();
      if (hanCount(text) < Math.min(20, target / 2)) return toast(`再多写一点吧，至少 ${Math.min(20, Math.round(target / 2))} 个字～`);
      const a = analyzeWriting(text, { idioms: ALL_IDIOMS, goodWords: [...GOOD_WORDS, ...mine.map((m) => m.text)] });
      const used = markUsed(text);
      const work = addWork({ kind: prompt.kind, title: prompt.t, text, chars: a.chars, score: a.score });
      try { localStorage.removeItem(draftKey); } catch { /* */ }
      markDone('write:' + prompt.t, a.score);
      const lenBonus = Math.min(1, a.chars / target);
      const score = Math.min(1, a.score * 0.5 + lenBonus * 0.5 + 0.15);
      const aiBox = h('div');
      const extra = h('div', { class: 'left' },
        h('div', { class: 'stat-row' },
          stat(a.chars, '字数'), stat(a.sentences, '句子'), stat(a.rhetoric.length, '修辞'), stat(a.idioms.length + a.good.length, '好词')),
        a.praise.length ? h('div', { class: 'explain ok' }, h('b', {}, '👍 亮点'), h('ul', {}, a.praise.map((x) => h('li', {}, x)))) : null,
        a.tips.length ? h('div', { class: 'explain bad' }, h('b', {}, '💡 可以更好'), h('ul', {}, a.tips.slice(0, 2).map((x) => h('li', {}, x)))) : null,
        used.length ? h('p', {}, '📒 素材本里的词用出来了：', used.join('、'), '（掌握度 +1）') : null,
        h('details', {}, h('summary', {}, '📝 我写的'), h('p', { class: 'pre' }, text), btn('🔊 读给我听', () => speak(text), 'soft small')),
        prompt.example ? h('div', { class: 'panel' }, h('div', { class: 'muted small' }, '墨墨的仿写示范：'), h('p', {}, prompt.example)) : null,
        aiAvailable() ? h('div', { class: 'row center' }, btn('🤖 请 AI 小老师批改', async (e) => {
          e.target.disabled = true;
          e.target.textContent = '🤖 正在批改…';
          const fb = await reviewWriting(text, prompt.t);
          e.target.remove();
          if (fb.error) return aiBox.replaceChildren(h('p', { class: 'warn' }, fb.error));
          work.feedback = fb.text;
          save();
          aiBox.replaceChildren(h('div', { class: 'tip-card ai-fb' }, h('div', { class: 'tip-title' }, '🤖 AI 小老师'), fb.text.split('\n').filter(Boolean).map((l) => h('p', {}, l))));
        }, 'soft')) : note('（家长在家长中心填写 API Key 后，可以请 AI 小老师批改）', 'small'),
        aiBox);
      sfx.win();
      resolve({ score, xp: addXP(10 + Math.min(a.chars, 400) / 10 + a.praise.length * 3, 'write'), extra });
    }
  });
}

function stat(n, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'small' }, label));
}

function imitateList(root, nav) {
  const s = state.settings.stage;
  root.replaceChildren(h('p', { class: 'intro' }, note('模仿是最快的进步方法。先读懂原文好在哪，再照着写一段自己的。')),
    h('div', { class: 'list' }, IMITATE.map((im, i) => im.lv <= s + 1 ? listItem({ icon: '🪞', title: im.title, sub: im.model.slice(0, 30) + '…', onClick: () => nav.go('writing', { m: 'write', imitate: i }) }) : null)));
}

function worksPage(root, nav, id) {
  if (id) {
    const w = state.works.find((x) => x.id === id);
    if (!w) return nav.go('writing', { m: 'works' });
    root.replaceChildren(h('div', { class: 'activity left' },
      h('h2', {}, w.title), note(new Date(w.at).toLocaleString('zh-CN') + `　${w.chars} 字`, 'small'),
      h('div', { class: 'story-text pre' }, w.text),
      h('div', { class: 'row center' }, btn('🔊 读给我听', () => speak(w.text), 'soft'), btn('✍️ 再改一改', () => {
        try { localStorage.setItem('kcz.draft.' + w.title, w.text); } catch { /* */ }
        nav.go('writing', { m: 'write', t: w.title });
      }, 'soft')),
      w.feedback ? h('div', { class: 'tip-card ai-fb' }, h('div', { class: 'tip-title' }, '🤖 AI 小老师的批改'), w.feedback.split('\n').filter(Boolean).map((l) => h('p', {}, l))) : null,
      btn('🗑️ 删除这篇', async () => {
        const ok = await modal(h('p', {}, '确定删除这篇作品吗？删除后不能恢复。'), [{ label: '取消', value: false }, { label: '删除', value: true, cls: 'danger' }]);
        if (!ok) return;
        state.works = state.works.filter((x) => x.id !== id);
        save();
        nav.go('writing', { m: 'works' });
      }, 'chip')));
    return;
  }
  const list = state.works.slice().reverse();
  root.replaceChildren(h('p', { class: 'intro' }, note(`一共写了 ${list.length} 篇、${list.reduce((a, w) => a + (w.chars || 0), 0)} 字。回头看看，你进步了多少！`)),
    list.length ? h('div', { class: 'list' }, list.map((w) => listItem({ icon: w.feedback ? '🤖' : '📄', title: w.title, sub: `${new Date(w.at).toLocaleDateString('zh-CN')} · ${w.chars} 字 · ${w.text.slice(0, 20)}…`, onClick: () => nav.go('writing', { m: 'works', id: w.id }) }))) : h('p', { class: 'empty' }, '还没有作品，去写第一篇小练笔吧！'));
}
