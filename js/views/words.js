// 📚 词语工坊
import { h, btn, note, sample, shuffle, pick, sfx, toast } from '../ui.js';
import { speak, recognize, hasASR } from '../speech.js';
import { choice, runSequence, finishScreen, collectBtn, speakBtn } from '../components.js';
import { state, addXP, markDone, srsAdd, markUsed } from '../state.js';
import { IDIOMS, SYNONYMS, COLLOCATIONS, UPGRADES, WORD_BANKS } from '../data/words.js';
import { forStage, shuffled, menuGrid, lvTag } from './common.js';
import { cleanZh } from '../score.js';

export function page(root, nav, params = {}) {
  nav.title('📚 词语工坊');
  const back = () => nav.go('words');
  const done = (r, title) => finishScreen(root, { score: r.score, xp: r.xp, title, onDone: back });
  if (params.m === 'idioms') return idiomList(root, nav);
  if (params.m === 'idiom') return idiomCard(root, IDIOMS.find((i) => i.w === params.w), nav);
  if (params.m === 'banks') return banks(root);
  if (params.m === 'syn') return runSynonyms(root, 8).then((r) => done(r, '近义词小侦探 🔎'));
  if (params.m === 'col') return runCollocations(root, 8).then((r) => done(r, '搭配达人 🧩'));
  if (params.m === 'iq') return runIdiomQuiz(root, 8).then((r) => done(r, '成语小达人 🏮'));
  if (params.m === 'fill') return runIdiomFill(root, 8).then((r) => done(r, '成语补全 ✍️'));
  if (params.m === 'up') return runUpgrade(root).then((r) => done(r, '换词高手 🔁'));

  root.replaceChildren(
    h('p', { class: 'intro' }, note('词语是表达的砖瓦。会的词越多、用得越准，说话写作才能"出口成章"。看到喜欢的词，点"☆ 收藏"放进素材本，然后在写作和说话里用出来！')),
    menuGrid([
      { icon: '🏮', title: '成语乐园', sub: `${IDIOMS.length} 个成语·小故事`, onClick: () => nav.go('words', { m: 'idioms' }) },
      { icon: '🎯', title: '看意思猜成语', sub: '8 题', onClick: () => nav.go('words', { m: 'iq' }) },
      { icon: '✍️', title: '成语补全', sub: '缺了哪个字？', onClick: () => nav.go('words', { m: 'fill' }) },
      { icon: '🔎', title: '近义词辨析', sub: '哪个词最准确', onClick: () => nav.go('words', { m: 'syn' }) },
      { icon: '🧩', title: '词语搭配', sub: '什么配什么', onClick: () => nav.go('words', { m: 'col' }) },
      { icon: '🔁', title: '换个好词', sub: '"高兴"有多少种说法', onClick: () => nav.go('words', { m: 'up' }) },
      { icon: '💎', title: '好词宝库', sub: '分类好词·一键收藏', onClick: () => nav.go('words', { m: 'banks' }) },
    ]));
}

// ---------- 成语乐园 ----------
function idiomList(root, nav) {
  let lv = state.settings.stage;
  const box = h('div');
  function render() {
    const list = IDIOMS.filter((i) => i.lv === lv);
    box.replaceChildren(
      h('div', { class: 'row wrap center' }, [1, 2, 3, 4, 5, 6].map((n) => btn(String(n), () => { lv = n; render(); }, 'chip' + (n === lv ? ' on' : '')))),
      h('div', { class: 'row center' }, lvTag(lv), note(`${list.length} 个`, 'small')),
      h('div', { class: 'word-grid' }, list.map((i) => h('button', { class: 'word-chip' + (state.srs[i.id] ? ' learned' : ''), type: 'button', onclick: () => nav.go('words', { m: 'idiom', w: i.w }) }, i.w, i.story ? ' 📖' : ''))));
  }
  root.replaceChildren(h('p', { class: 'intro' }, note('点开一个成语：听读音、看意思和例句，有 📖 的还有小故事。点"学会了"会加入复习计划。')), box);
  render();
}

function idiomCard(root, it, nav) {
  if (!it) return nav.go('words', { m: 'idioms' });
  const said = h('div');
  const tryBtn = btn('🎤 用它说一句话', async () => {
    if (!hasASR) return toast('这个浏览器不支持语音识别，试试写在下面的框里吧');
    tryBtn.disabled = true;
    tryBtn.textContent = '👂 正在听…';
    const { alts } = await recognize({ timeout: 15000 });
    tryBtn.disabled = false;
    tryBtn.textContent = '🎤 再说一句';
    judge(alts[0] || '');
  }, 'soft');
  const input = h('input', { class: 'wide-input', placeholder: `用"${it.w}"写一句话…` });
  function judge(text) {
    said.replaceChildren();
    if (!text) return said.append(h('p', { class: 'muted' }, '没听到，再试一次～'));
    const ok = cleanZh(text).includes(it.w);
    if (ok) {
      addXP(8, 'word');
      markUsed(text);
      srsAdd({ id: it.id, type: 'idiom', front: it.w, back: it.m, ex: it.ex });
      sfx.ok();
    } else sfx.bad();
    said.append(h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') }, ok ? `✅ 用得好！"${text}"  +8 经验` : `🤔 "${text}"——好像没有用上"${it.w}"，再试试？`));
  }
  root.replaceChildren(h('div', { class: 'activity' },
    h('div', { class: 'say-card' },
      h('div', { class: 'say-text huge' }, it.w),
      h('div', { class: 'row center' }, speakBtn(it.w, '🔊 读音'), collectBtn('idiom', it.w, it.m), lvTag(it.lv)),
      h('p', {}, h('b', {}, '意思：'), it.m),
      h('p', {}, h('b', {}, '例句：'), it.ex, ' ', speakBtn(it.ex))),
    it.story ? h('div', { class: 'tip-card' }, h('div', { class: 'tip-title' }, '📖 成语故事'), h('p', {}, it.story), btn('🔊 听故事', () => speak(it.story), 'soft small')) : null,
    h('div', { class: 'panel' }, h('h3', {}, '✍️ 学了就用'), note('积累不等于会用。用这个成语说一句或写一句话，才算真正掌握！'),
      h('div', { class: 'row center' }, tryBtn),
      h('div', { class: 'row' }, input, btn('提交', () => judge(input.value.trim()), 'primary')),
      said),
    h('div', { class: 'row center' },
      btn(state.srs[it.id] ? '✓ 已在复习计划中' : '✅ 学会了，加入复习', (e) => {
        if (srsAdd({ id: it.id, type: 'idiom', front: it.w, back: it.m, ex: it.ex })) { addXP(3, 'word'); toast('加入复习计划，明天来复习哦'); }
        e.target.textContent = '✓ 已在复习计划中';
      }, 'primary'),
      btn('下一个 ➜', () => {
        const list = IDIOMS.filter((i) => i.lv === it.lv);
        const next = list[(list.indexOf(it) + 1) % list.length];
        nav.go('words', { m: 'idiom', w: next.w });
      }, 'soft'))));
  speak(it.w);
}

// ---------- 小游戏 ----------
export function runIdiomQuiz(root, n = 8) {
  const pool = forStage(IDIOMS, 12);
  const items = sample(pool, n);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🎯 看意思，猜成语'),
    renderItem(stage, it, done) {
      const wrong = sample(pool.filter((x) => x.w !== it.w), 2).map((x) => x.w);
      const opts = shuffle([it.w, ...wrong]);
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.m)));
      choice(stage, opts, opts.indexOf(it.w), { explain: `${it.w}：${it.ex}` }).then((ok) => {
        if (ok) srsAdd({ id: it.id, type: 'idiom', front: it.w, back: it.m, ex: it.ex });
        stage.append(h('div', { class: 'row center' }, speakBtn(it.w, '🔊 ' + it.w), collectBtn('idiom', it.w, it.m)));
        done(ok ? 1 : 0);
      });
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, 'word') }));
}

export function runIdiomFill(root, n = 8) {
  const pool = forStage(IDIOMS, 12);
  const items = sample(pool, n);
  const allChars = [...new Set(IDIOMS.map((i) => i.w).join(''))];
  return runSequence(root, {
    items,
    head: h('h2', {}, '✍️ 成语补全：缺了哪个字？'),
    renderItem(stage, it, done) {
      const k = Math.floor(Math.random() * it.w.length);
      const ch = it.w[k];
      const shown = it.w.slice(0, k) + '□' + it.w.slice(k + 1);
      const wrong = sample(allChars.filter((c) => c !== ch), 3);
      const opts = shuffle([ch, ...wrong]);
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text huge' }, shown), note('提示：' + it.m, 'small')));
      choice(stage, opts, opts.indexOf(ch), { explain: `${it.w}：${it.ex}` }).then((ok) => {
        stage.append(h('div', { class: 'row center' }, speakBtn(it.w, '🔊 ' + it.w), collectBtn('idiom', it.w, it.m)));
        done(ok ? 1 : 0);
      });
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, 'word') }));
}

function mcRun(root, list, n, title, act) {
  const items = sample(forStage(list, n), n);
  return runSequence(root, {
    items,
    head: h('h2', {}, title),
    renderItem(stage, it, done) {
      const s = shuffled(it.o, it.a);
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.q)));
      choice(stage, s.options, s.answer, { explain: it.e }).then((ok) => done(ok ? 1 : 0));
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, act) }));
}

export const runSynonyms = (root, n = 6) => mcRun(root, SYNONYMS, n, '🔎 近义词辨析：选最准确的词', 'word');
export const runCollocations = (root, n = 6) => mcRun(root, COLLOCATIONS, n, '🧩 词语搭配：选最合适的', 'word');

// ---------- 换个好词：60 秒内说/写出尽量多的替换词 ----------
export function runUpgrade(root) {
  const it = pick(forStage(UPGRADES, 3));
  return new Promise((resolve) => {
    const found = new Set();
    const list = h('div', { class: 'word-grid' });
    const timer = h('div', { class: 'timer small-timer' }, '60');
    const input = h('input', { class: 'wide-input', placeholder: '写一个词，按回车（或点"加入"）' });
    const fb = h('div', { class: 'muted small center' });
    const norm = (w) => cleanZh(w);
    function tryWord(w) {
      w = norm(w);
      if (!w) return;
      const hit = it.alts.find((a) => norm(a) === w || (w.length >= 2 && w.includes(norm(a))));
      if (hit && !found.has(hit)) {
        found.add(hit);
        list.append(h('span', { class: 'word-chip learned' }, hit));
        sfx.coin();
        fb.textContent = `✅ ${hit}`;
      } else if (hit) fb.textContent = `"${hit}"已经说过啦`;
      else if (w !== norm(it.plain)) {
        list.append(h('span', { class: 'word-chip mine' }, w));
        found.add(w);
        sfx.pop();
        fb.textContent = `"${w}"不在墨墨的词单里，但如果用得准，也算你厉害！`;
      }
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { tryWord(input.value); input.value = ''; } });
    let listening = false;
    const mic = hasASR ? btn('🎤 说出来', async () => {
      if (listening) return;
      listening = true;
      mic.classList.add('listening');
      const { alts } = await recognize({ timeout: 8000, maxAlternatives: 3 });
      listening = false;
      mic.classList.remove('listening');
      (alts[0] || '').split(/[，,、\s]+/).forEach(tryWord);
    }, 'soft') : null;
    root.replaceChildren(h('div', { class: 'activity' },
      h('h2', {}, '🔁 换个好词'),
      h('div', { class: 'say-card' }, h('div', { class: 'muted' }, '把这句话里的'), h('div', { class: 'say-text huge' }, `"${it.plain}"`), h('div', { class: 'muted' }, '换成更准确、更生动的说法：'), h('p', {}, it.ctx)),
      timer,
      h('div', { class: 'row' }, input, btn('加入', () => { tryWord(input.value); input.value = ''; }, 'primary'), mic),
      fb, list));
    input.focus();
    let left = 60;
    const iv = setInterval(() => {
      if (!timer.isConnected) return clearInterval(iv); // 已离开这个页面
      left--;
      timer.textContent = String(left);
      if (left <= 10) timer.classList.add('hurry');
      if (left <= 0) end();
    }, 1000);
    function end() {
      clearInterval(iv);
      const got = [...found].filter((w) => it.alts.includes(w));
      const missed = it.alts.filter((a) => !found.has(a));
      const score = Math.min(1, found.size / 6);
      markDone('upgrade:' + it.plain, score);
      root.replaceChildren(h('div', { class: 'activity' },
        h('h2', {}, `你想到了 ${found.size} 个！`),
        h('div', { class: 'word-grid' }, [...found].map((w) => h('span', { class: 'word-chip learned' }, w, ' ', collectBtn('word', w)))),
        missed.length ? h('div', { class: 'panel' }, h('h3', {}, '墨墨的词单里还有：'), h('div', { class: 'word-grid' }, missed.map((w) => h('span', { class: 'word-chip' }, w, ' ', collectBtn('word', w))))) : null,
        note('把喜欢的词收藏进素材本，下次写作时就用上它！'),
        h('div', { class: 'row center' }, btn('完成 ✓', () => resolve({ score, xp: addXP(5 + got.length * 2 + found.size, 'word') }), 'primary big'))));
    }
  });
}

// ---------- 好词宝库 ----------
function banks(root) {
  const list = WORD_BANKS.filter((b) => b.lv <= state.settings.stage + 1);
  root.replaceChildren(
    h('p', { class: 'intro' }, note('按主题积累的好词。点 🔊 听，点 ☆ 收藏到素材本。')),
    list.map((b) => h('div', { class: 'panel' },
      h('h3', {}, b.icon, ' ', b.title, ' ', btn('🔊 全部', () => speak(b.words.join('，')), 'chip tiny')),
      h('div', { class: 'word-grid' }, b.words.map((w) => h('span', { class: 'word-chip' }, h('span', { onclick: () => speak(w) }, w), ' ', collectBtn('word', w)))))));
}
