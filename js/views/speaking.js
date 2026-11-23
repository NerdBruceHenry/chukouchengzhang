// 🎤 口才训练营
import { h, btn, note, pick, sfx } from '../ui.js';
import { speak, speakLines } from '../speech.js';
import { finishScreen, runTimedTalk, readCard, runSequence, speakBtn } from '../components.js';
import { state, addXP, markDone } from '../state.js';
import { FRAMES, TOPICS, SPEECHES, RETELL, PICTURES, TWISTERS, PAUSES } from '../data/speaking.js';
import { forStage, menuGrid, listItem, starsOf } from './common.js';
import { cleanZh } from '../score.js';
import { aiAvailable, reviewSpeech } from './ai.js';

export function page(root, nav, params = {}) {
  nav.title('🎤 口才训练营');
  const back = () => nav.go('speaking');
  const done = (r, title) => finishScreen(root, { score: r.score, xp: r.xp, title, extra: r.extra, onDone: back });
  const modes = {
    imp: () => runImpromptu(root).then((r) => done(r, '即兴说完成！🎙️')),
    speech: () => runSpeech(root).then((r) => done(r, '一分钟演讲 🎤')),
    retell: () => runRetell(root).then((r) => done(r, '复述完成！📖')),
    pic: () => runPicture(root).then((r) => done(r, '看图说话 🖼️')),
    tw: () => twisters(root),
    pause: () => runPauses(root).then((r) => done(r, '停顿与重音 🎵')),
  };
  if (modes[params.m]) return modes[params.m]();
  const talks = state.talks.slice(-5);
  root.replaceChildren(
    h('p', { class: 'intro' }, note('会说话 = 敢说 + 有条理 + 有内容 + 有感染力。每次说完都会统计字数、语速、口头禅和用词丰富度，录音也会保存下来，看得见自己的进步。')),
    menuGrid([
      { icon: '🎙️', title: '即兴说', sub: '看题马上说', onClick: () => nav.go('speaking', { m: 'imp' }) },
      { icon: '🎤', title: '一分钟演讲', sub: '框架 + 开场白', onClick: () => nav.go('speaking', { m: 'speech' }) },
      { icon: '📖', title: '复述故事', sub: '听两遍，讲出来', onClick: () => nav.go('speaking', { m: 'retell' }) },
      { icon: '🖼️', title: '看图说话', sub: '把画面讲成故事', onClick: () => nav.go('speaking', { m: 'pic' }) },
      { icon: '🌀', title: '绕口令', sub: '练字音、练嘴皮', onClick: () => nav.go('speaking', { m: 'tw' }) },
      { icon: '🎵', title: '停顿与重音', sub: '同一句话不同意思', onClick: () => nav.go('speaking', { m: 'pause' }) },
    ]),
    talks.length ? h('div', { class: 'history' }, h('h3', {}, '📈 最近几次'),
      h('table', {}, h('tr', {}, h('th', {}, '日期'), h('th', {}, '字数'), h('th', {}, '字/分'), h('th', {}, '口头禅')),
        talks.reverse().map((t) => h('tr', {}, h('td', {}, t.date.slice(5)), h('td', {}, t.chars), h('td', {}, t.cpm), h('td', {}, t.fillers))))) : null);
}

function frameBox(key) {
  const f = FRAMES[key];
  if (!f) return null;
  return h('div', { class: 'frame' }, h('div', { class: 'small muted' }, '🧭 说话框架：', f.name), h('ol', {}, f.steps.map((s) => h('li', {}, s))));
}

function scoreTalk(f, secs, target) {
  if (!f.chars) return 0.4;
  const len = Math.min(1, f.chars / (target * secs / 60));
  return Math.max(0.2, Math.min(1, len * 0.6 + Math.min(f.rich / 0.8, 1) * 0.2 + (f.fillers <= 3 ? 0.2 : f.fillers <= 6 ? 0.1 : 0) + (f.idioms.length ? 0.05 : 0)));
}
const targetCpm = () => [100, 130, 150, 170, 180, 190][state.settings.stage - 1];

export async function runImpromptu(root, topic) {
  const t = topic || pick(forStage(TOPICS, 4));
  const secs = state.settings.stage <= 2 ? 45 : state.settings.stage <= 4 ? 60 : 90;
  const card = h('div', { class: 'prompt-card' },
    h('div', { class: 'prompt-q' }, t.q, ' ', speakBtn(t.q)),
    frameBox(t.frame),
    h('div', { class: 'starters' }, h('span', { class: 'muted small' }, '开头可以这样说：'), t.starters.map((s) => h('div', { class: 'starter' }, '💬 ', s))));
  const r = await runTimedTalk(root, { card, seconds: secs, kind: 'impromptu', title: t.q });
  const score = scoreTalk(r.f, r.sec, targetCpm());
  markDone('talk:' + t.q, score);
  return { score, xp: addXP(10 + Math.min(r.f.chars, 300) / 6, 'speak'), extra: withAI(r, t.q) };
}

export async function runSpeech(root, item) {
  const sp = item || pick(forStage(SPEECHES, 3));
  const outline = h('textarea', { class: 'dict-input', rows: 4, placeholder: '先写个提纲（关键词就行）：\n1. \n2. \n3. ' });
  const card = h('div', { class: 'prompt-card' },
    h('div', { class: 'muted small' }, '一分钟演讲'),
    h('div', { class: 'prompt-q' }, sp.q),
    frameBox(sp.frame),
    h('div', { class: 'example' }, h('div', { class: 'muted small' }, '🎬 开场白示范：'), sp.open, ' ', speakBtn(sp.open)),
    h('p', { class: 'small' }, '💡 ', sp.tip),
    outline);
  const r = await runTimedTalk(root, { card, seconds: 60, kind: 'speech', title: sp.q });
  const score = scoreTalk(r.f, r.sec, targetCpm());
  markDone('speech:' + sp.q, score);
  return { score, xp: addXP(15 + Math.min(r.f.chars, 300) / 5, 'speak'), extra: withAI(r, sp.q) };
}

function withAI(r, topic) {
  if (!aiAvailable() || !r.text || r.f.chars < 20) return r.summary;
  const box = h('div');
  const b = btn('🤖 请 AI 小老师点评', async () => {
    b.disabled = true;
    b.textContent = '🤖 正在听你说的…';
    const fb = await reviewSpeech(r.text, topic, r.f);
    b.remove();
    box.replaceChildren(fb.error ? h('p', { class: 'warn' }, fb.error) : h('div', { class: 'tip-card ai-fb left' }, h('div', { class: 'tip-title' }, '🤖 AI 小老师'), fb.text.split('\n').filter(Boolean).map((l) => h('p', {}, l))));
  }, 'soft');
  return h('div', {}, r.summary, h('div', { class: 'row center' }, b), box);
}

export async function runRetell(root, story) {
  const st = story || pick(forStage(RETELL, 3));
  // 先听两遍
  await new Promise((go) => {
    let plays = 0;
    const playBtn = btn('▶ 听故事', async () => {
      playBtn.disabled = true;
      await speak(st.text);
      plays++;
      playBtn.disabled = false;
      playBtn.textContent = '▶ 再听一遍';
      if (plays >= 1) nextBtn.disabled = false;
    }, 'primary big');
    const nextBtn = btn('我准备好了，开始复述 ➜', go, 'soft');
    nextBtn.disabled = true;
    root.replaceChildren(h('div', { class: 'activity' },
      h('h2', {}, '📖 复述：', st.title),
      note('认真听，记住：谁？在哪里？发生了什么？结果怎样？可以听两遍。'),
      h('div', { class: 'row center' }, playBtn),
      h('details', { class: 'story-peek' }, h('summary', {}, '👀 看文字（越少看越厉害）'), h('p', {}, st.text)),
      h('div', { class: 'row center' }, nextBtn)));
  });
  const card = h('div', { class: 'prompt-card' }, h('div', { class: 'prompt-q' }, '用自己的话讲讲《', st.title, '》'), frameBox('story'));
  const r = await runTimedTalk(root, { card, seconds: 75, kind: 'retell', title: st.title });
  const t = cleanZh(r.text);
  const hit = st.keys.filter((k) => t.includes(k));
  const cover = hit.length / st.keys.length;
  const score = r.text ? Math.min(1, cover * 0.7 + scoreTalk(r.f, r.sec, targetCpm()) * 0.3) : 0.5;
  markDone('retell:' + st.title, score);
  const extra = h('div', {},
    r.text ? h('div', { class: 'panel' }, h('h3', {}, `🔑 关键信息讲到了 ${hit.length} / ${st.keys.length}`),
      h('div', { class: 'word-grid' }, st.keys.map((k) => h('span', { class: 'word-chip' + (hit.includes(k) ? ' learned' : ' missed') }, k)))) : null,
    r.summary);
  return { score, xp: addXP(10 + hit.length * 2, 'speak'), extra };
}

export async function runPicture(root) {
  const p = pick(forStage(PICTURES, 3));
  const card = h('div', { class: 'prompt-card' },
    h('div', { class: 'prompt-q' }, '🖼️ 看图讲故事：', p.title),
    h('div', { class: 'comic' }, p.frames.map((f, i) => h('div', { class: 'comic-frame' }, h('div', { class: 'small muted' }, `图${i + 1}`), h('div', { class: 'comic-e' }, f)))),
    h('p', { class: 'small' }, '💡 ', p.hint),
    note('要讲清楚：时间、地点、人物、起因、经过、结果，还可以加上人物说的话和心里想的。', 'small'));
  const r = await runTimedTalk(root, { card, seconds: state.settings.stage <= 1 ? 45 : 60, kind: 'picture', title: p.title });
  const score = scoreTalk(r.f, r.sec, targetCpm());
  return { score, xp: addXP(10 + Math.min(r.f.chars, 250) / 6, 'speak'), extra: r.summary };
}

function twisters(root) {
  const list = TWISTERS.filter((t) => t.lv <= state.settings.stage + 1);
  const box = h('div');
  root.replaceChildren(h('p', { class: 'intro' }, note('先慢后快：先用慢速读准每个字，再一点点加快。普通话的平翘舌、前后鼻音、n 和 l，都靠它练！')),
    h('div', { class: 'list' }, list.map((t) => listItem({ icon: '🌀', title: t.text.slice(0, 14) + '…', sub: t.focus, done: starsOf(state.done['tw:' + t.text]), onClick: () => {
      box.replaceChildren(readCard({ text: t.text, title: '🎯 ' + t.focus, onScore: (s, best) => { markDone('tw:' + t.text, best); if (s >= 0.8) addXP(5, 'speak'); } }).node);
      box.scrollIntoView({ behavior: 'smooth' });
    } }))), box);
}

export function runPauses(root) {
  const items = forStage(PAUSES, 3).slice(0, 4);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🎵 停顿和重音会改变意思'),
    renderItem(stage, it, done) {
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.plain)));
      if (it.versions) {
        stage.append(h('p', { class: 'small muted' }, '"/" 表示停顿。听一听、读一读：'),
          it.versions.map((v) => h('div', { class: 'panel' }, h('b', {}, v.mark), ' ', speakBtn(v.mark.replace(/\//g, '，')), h('div', { class: 'small' }, '👉 意思：', v.mean))));
      } else {
        stage.append(h('p', { class: 'small muted' }, '重音放在不同的词上，强调的意思就不同。试着读出来：'),
          it.stress.map((s) => h('div', { class: 'panel' }, it.plain.split(s.word).map((part, i, arr) => [part, i < arr.length - 1 ? h('b', { class: 'stress' }, s.word) : null]), h('div', { class: 'small' }, '👉 ', s.mean))));
      }
      stage.append(h('div', { class: 'row center' }, btn('我读会了 ✓', () => { sfx.ok(); done(1); }, 'primary')));
    },
  }).then((score) => ({ score, xp: addXP(items.length * 3, 'speak') }));
}
