// ✏️ 造句擂台
import { h, btn, note, sample, shuffle, pick, sfx } from '../ui.js';
import { speak, recognize, hasASR } from '../speech.js';
import { choice, runSequence, finishScreen, collectBtn, speakBtn } from '../components.js';
import { addXP, markUsed, addMaterial } from '../state.js';
import { JOIN, RHETORIC, RHETORIC_TYPES, TRANSFORM, UPGRADE_SENT, EXPAND, SICK, CONNECTIVES } from '../data/sentences.js';
import { forStage, shuffled, menuGrid } from './common.js';
import { cleanZh, sameSentence, analyzeWriting, hanCount } from '../score.js';
import { ALL_IDIOMS, GOOD_WORDS } from '../data/words.js';

export function page(root, nav, params = {}) {
  nav.title('✏️ 造句擂台');
  const done = (r, title) => finishScreen(root, { score: r.score, xp: r.xp, title, onDone: () => nav.go('sentences') });
  const modes = {
    join: () => runJoin(root, 6).then((r) => done(r, '连词成句 🧱')),
    rhet: () => runRhetoric(root, 8).then((r) => done(r, '修辞侦探 🎭')),
    trans: () => runTransform(root, 6).then((r) => done(r, '句式魔术师 🪄')),
    sick: () => runSick(root, 6).then((r) => done(r, '病句医生 🩺')),
    conn: () => runConnectives(root, 6).then((r) => done(r, '关联词小能手 🔗')),
    up: () => runUpgradeSentence(root, 3).then((r) => done(r, '句子升级 🚀')),
    exp: () => runExpand(root, 3).then((r) => done(r, '扩句高手 🌱')),
  };
  if (modes[params.m]) return modes[params.m]();
  root.replaceChildren(
    h('p', { class: 'intro' }, note('句子是文章的骨肉。先把句子说通顺，再说生动、说有力。')),
    menuGrid([
      { icon: '🚀', title: '句子升级', sub: '平淡句 → 生动句', onClick: () => nav.go('sentences', { m: 'up' }) },
      { icon: '🌱', title: '扩句', sub: '让句子更具体', onClick: () => nav.go('sentences', { m: 'exp' }) },
      { icon: '🧱', title: '连词成句', sub: '排成通顺的句子', onClick: () => nav.go('sentences', { m: 'join' }) },
      { icon: '🎭', title: '修辞侦探', sub: '比喻拟人排比……', onClick: () => nav.go('sentences', { m: 'rhet' }) },
      { icon: '🪄', title: '句式变换', sub: '把字句·被字句·反问句', onClick: () => nav.go('sentences', { m: 'trans' }) },
      { icon: '🔗', title: '关联词', sub: '因为所以·虽然但是', onClick: () => nav.go('sentences', { m: 'conn' }) },
      { icon: '🩺', title: '病句医院', sub: '找毛病、开药方', onClick: () => nav.go('sentences', { m: 'sick' }) },
    ]));
}

// ---------- 连词成句：按顺序点词语 ----------
export function runJoin(root, n = 5) {
  const items = sample(forStage(JOIN, n), n);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🧱 连词成句：按顺序点一点'),
    renderItem(stage, it, done) {
      const picked = [];
      const line = h('div', { class: 'join-line' });
      const pool = h('div', { class: 'word-grid' });
      const res = h('div');
      const draw = () => {
        line.replaceChildren(picked.length ? picked.map((p, i) => h('button', { class: 'word-chip learned', type: 'button', onclick: () => { picked.splice(i, 1); draw(); } }, p)) : note('点下面的词语，排成一句话'));
        pool.replaceChildren(shuffledParts.filter((p) => !picked.includes(p)).map((p) => h('button', { class: 'word-chip', type: 'button', onclick: () => { picked.push(p); draw(); if (picked.length === it.parts.length) check(); } }, p)));
      };
      let shuffledParts = shuffle(it.parts);
      if (shuffledParts.join('') === it.parts.join('')) shuffledParts = shuffledParts.reverse();
      function check() {
        const ok = sameSentence(picked.join(''), it.ans);
        ok ? sfx.ok() : sfx.bad();
        res.replaceChildren(h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') }, ok ? '✅ 通顺！' : '💡 参考答案：', ok ? '' : it.ans), h('div', { class: 'row center' }, speakBtn(it.ans, '🔊 读一读')));
        done(ok ? 1 : 0);
      }
      stage.append(line, pool, res);
      draw();
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, 'sentence') }));
}

export function runRhetoric(root, n = 6) {
  const items = sample(forStage(RHETORIC, n), n);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🎭 这句话用了什么修辞？'),
    renderItem(stage, it, done) {
      const wrong = sample(RHETORIC_TYPES.filter((t) => t !== it.a), 2);
      const opts = shuffle([it.a, ...wrong]);
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.s), h('div', { class: 'row center' }, speakBtn(it.s))));
      choice(stage, opts, opts.indexOf(it.a), { explain: it.e }).then((ok) => {
        stage.append(h('div', { class: 'row center' }, collectBtn('sentence', it.s, it.a)));
        done(ok ? 1 : 0);
      });
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, 'sentence') }));
}

function mc(root, list, n, title, render) {
  const items = sample(forStage(list, n), n);
  return runSequence(root, {
    items,
    head: h('h2', {}, title),
    renderItem(stage, it, done) {
      const s = shuffled(it.o, it.a);
      stage.append(render(it));
      choice(stage, s.options, s.answer, { explain: it.e }).then((ok) => done(ok ? 1 : 0));
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, 'sentence') }));
}

export const runTransform = (root, n = 5) => mc(root, TRANSFORM, n, '🪄 句式变换', (it) => h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.q), h('div', { class: 'muted' }, '👉 ', it.ask)));
export const runConnectives = (root, n = 5) => mc(root, CONNECTIVES, n, '🔗 选出合适的关联词', (it) => h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.q)));
export const runSick = (root, n = 5) => mc(root, SICK, n, '🩺 病句医院：哪一句改对了？', (it) => h('div', { class: 'say-card' }, h('div', { class: 'muted small' }, '病人：'), h('div', { class: 'say-text' }, it.s), note('病因可能是：用词不当、搭配不当、成分残缺、重复啰嗦、前后矛盾……也可能没有病！', 'small')));

// ---------- 开放题：句子升级 / 扩句 ----------
function openSentence(stage, { base, hint, models, onDone, minGrow = 1.5 }) {
  const input = h('textarea', { class: 'dict-input', rows: 3, placeholder: '在这里写，或者点🎤说出来…' });
  const res = h('div');
  const mic = hasASR ? btn('🎤 说出来', async () => {
    mic.disabled = true;
    mic.classList.add('listening');
    mic.textContent = '👂 正在听…';
    const { alts } = await recognize({ timeout: 20000 });
    mic.disabled = false;
    mic.classList.remove('listening');
    mic.textContent = '🎤 再说一次';
    if (alts[0]) input.value = alts[0] + (/[。！？]$/.test(alts[0]) ? '' : '。');
  }, 'soft') : null;
  let submitted = false;
  const submit = btn('✓ 写好了', () => {
    const text = input.value.trim();
    if (hanCount(text) < 3) return;
    const a = analyzeWriting(text, { idioms: ALL_IDIOMS, goodWords: GOOD_WORDS });
    const grow = hanCount(text) / Math.max(1, hanCount(base));
    const used = markUsed(text);
    const good = [];
    if (grow >= minGrow) good.push(`比原句具体多了（${hanCount(base)} 字 → ${hanCount(text)} 字）`);
    good.push(...a.praise);
    if (used.length) good.push('素材本里的词用出来了：' + used.join('、'));
    const score = Math.min(1, (grow >= minGrow ? 0.5 : grow >= 1.2 ? 0.3 : 0.1) + Math.min(a.praise.length, 2) * 0.2 + (used.length ? 0.1 : 0));
    sfx.ok();
    res.replaceChildren(
      h('div', { class: 'explain ok' }, good.length ? ['👍 ', good.join('；')] : '写好了！和墨墨的示范比一比，看看还能加点什么？'),
      a.tips.length ? h('div', { class: 'explain bad' }, '💡 ', a.tips[0]) : null,
      h('div', { class: 'panel' }, h('div', { class: 'muted small' }, '墨墨的示范（不是唯一答案）：'), models.map((m) => h('p', {}, m, ' ', speakBtn(m), ' ', collectBtn('sentence', m)))),
      h('div', { class: 'row center' }, btn('📒 把我的句子收进素材本', (e) => { addMaterial('mine', text); e.target.disabled = true; e.target.textContent = '✓ 已收藏'; }, 'soft small')));
    if (!submitted) {
      submitted = true;
      onDone(score);
    }
  }, 'primary');
  stage.append(
    h('div', { class: 'say-card' }, h('div', { class: 'muted small' }, '原句'), h('div', { class: 'say-text' }, base), h('div', { class: 'note' }, '💡 ', hint)),
    input, h('div', { class: 'row center' }, mic, submit), res);
}

export function runUpgradeSentence(root, n = 3) {
  const items = sample(forStage(UPGRADE_SENT, n), n);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🚀 句子升级：让平淡的句子活起来'),
    renderItem: (stage, it, done) => openSentence(stage, { base: it.plain, hint: it.hint, models: it.good, onDone: done }),
  }).then((score) => ({ score, xp: addXP(n * 5 + score * n * 4, 'sentence') }));
}

export function runExpand(root, n = 3) {
  const items = sample(forStage(EXPAND, n), n);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🌱 扩句：给句子加上"什么样的、在哪里、怎么样"'),
    renderItem: (stage, it, done) => openSentence(stage, { base: it.base, hint: it.hint, models: [it.good], onDone: done, minGrow: 2 }),
  }).then((score) => ({ score, xp: addXP(n * 4 + score * n * 4, 'sentence') }));
}
