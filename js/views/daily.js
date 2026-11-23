// 📜 每日任务（约 15 分钟）：积累 → 组织 → 阅读/沟通 → 输出 → 复习，完成开宝箱
import { h, btn, note, pick, sfx, confetti, modal } from '../ui.js';
import { finishScreen } from '../components.js';
import { state, save, today, dayRec, srsDue, addCoins, addXP } from '../state.js';
import * as words from './words.js';
import * as poems from './poems.js';
import * as sentences from './sentences.js';
import * as reading from './reading.js';
import * as talk from './talk.js';
import * as speaking from './speaking.js';
import * as writing from './writing.js';
import * as review from './review.js';
import { PROMPTS } from '../data/writing.js';
import { forStage } from './common.js';

function makePlan() {
  const n = Number(today().replace(/-/g, ''));
  const wordStep = pick(['iq', 'syn', 'col', 'fill']);
  const sentStep = pick(['rhet', 'sick', 'trans', 'up', 'join', 'conn']);
  const third = n % 2 ? 'reading' : 'talk';
  const out = n % 3 === 0 ? 'write' : pick(['impromptu', 'speech', 'retell', 'write']);
  const steps = [
    { kind: 'words', m: wordStep, icon: '📚', name: '词语热身' },
    { kind: 'poem', icon: '🏮', name: '每日一诗' },
    { kind: 'sentences', m: sentStep, icon: '✏️', name: '造句擂台' },
    third === 'reading' ? { kind: 'reading', icon: '🔍', name: '阅读侦探' } : { kind: 'talk', icon: '🤝', name: '沟通情境' },
    { kind: 'out', m: out, icon: out === 'write' ? '📝' : '🎤', name: { write: '小练笔', impromptu: '即兴说', speech: '一分钟演讲', retell: '复述故事' }[out] },
  ];
  if (srsDue(1).length) steps.push({ kind: 'review', icon: '🔁', name: '复习' });
  return { date: today(), steps, done: [] };
}

function plan() {
  if (!state.plan || state.plan.date !== today()) {
    state.plan = makePlan();
    save();
  }
  return state.plan;
}

export function page(root, nav) {
  nav.title('📜 今日任务');
  const p = plan();
  const next = p.steps.findIndex((_, i) => !p.done.includes(i));
  const allDone = next === -1;
  root.replaceChildren(
    h('p', { class: 'intro' }, note('每天大约 15 分钟。顺序是：先积累词语和诗句，再练句子，然后读一读或练沟通，最后动笔或开口——把学到的用出来！')),
    h('div', { class: 'quest-path' }, p.steps.map((s, i) => {
      const done = p.done.includes(i);
      return h('button', { class: 'quest-step' + (done ? ' done' : i === next ? ' current' : ''), type: 'button', onclick: () => run(i) },
        h('span', { class: 'quest-dot' }, done ? '✓' : s.icon), h('span', {}, h('b', {}, s.name)));
    })),
    allDone
      ? (dayRec().quest ? h('div', { class: 'panel center' }, h('h3', {}, '🏆 今天的任务全部完成！'), note('明天再来，连续打卡会有徽章哦。')) : h('div', { class: 'row center' }, btn('🎁 打开宝箱', openChest, 'primary big')))
      : h('div', { class: 'row center' }, btn(next === 0 ? '▶ 开始' : '▶ 继续', () => run(next), 'primary big')));

  async function run(i) {
    const s = p.steps[i];
    const r = await runStep(root, s);
    if (!p.done.includes(i)) p.done.push(i);
    save();
    finishScreen(root, { score: r.score ?? 1, xp: r.xp ?? 0, title: `${s.icon} ${s.name} 完成！`, extra: r.extra, onDone: () => page(root, nav) });
  }

  async function openChest() {
    const d = dayRec();
    d.quest = true;
    const coins = 20 + Math.floor(Math.random() * 21);
    addCoins(coins);
    addXP(20, 'quest');
    save();
    confetti(90);
    sfx.win();
    await modal(h('div', { class: 'center' }, h('div', { class: 'sticker-big' }, '🎁'), h('h2', {}, '今日任务完成！'), h('p', {}, `获得 🪙 ${coins} 墨锭 和 20 经验`), note('坚持每天练，出口成章不是梦！')), [{ label: '太好了！', value: 1, cls: 'primary' }]);
    page(root, nav);
  }
}

function runStep(root, s) {
  switch (s.kind) {
    case 'words': return ({ iq: words.runIdiomQuiz, syn: words.runSynonyms, col: words.runCollocations, fill: words.runIdiomFill }[s.m])(root, 5);
    case 'poem': return poems.runPoemStep(root, poems.poemOfDay());
    case 'sentences': return ({ rhet: sentences.runRhetoric, sick: sentences.runSick, trans: sentences.runTransform, join: sentences.runJoin, conn: sentences.runConnectives, up: (r) => sentences.runUpgradeSentence(r, 2) }[s.m])(root, 4);
    case 'reading': return reading.runReading(root, reading.pickReading());
    case 'talk': return talk.runScene(root, talk.pickScene());
    case 'out':
      if (s.m === 'write') return writing.writeEditor(root, { ...pick(forStage(PROMPTS, 3)), kind: 'practice' });
      if (s.m === 'speech') return speaking.runSpeech(root);
      if (s.m === 'retell') return speaking.runRetell(root);
      return speaking.runImpromptu(root);
    case 'review': {
      const due = srsDue(10);
      return due.length ? review.runReview(root, due) : Promise.resolve({ score: 1, xp: 0 });
    }
    default: return Promise.resolve({ score: 1, xp: 0 });
  }
}
