// 🔍 阅读侦探
import { h, btn, note, shuffle, sfx, pick } from '../ui.js';
import { speak, speakLines, stopSpeaking } from '../speech.js';
import { choice, progressBar, finishScreen, readCard, collectBtn } from '../components.js';
import { state, addXP, markDone } from '../state.js';
import { READINGS, SKILLS } from '../data/readings.js';
import { forStage, listItem, lvTag, starsOf, shuffled } from './common.js';

export function page(root, nav, params = {}) {
  nav.title('🔍 阅读侦探');
  if (params.id) {
    const r = READINGS.find((x) => x.id === params.id);
    if (r) return runReading(root, r).then((res) => finishScreen(root, { score: res.score, xp: res.xp, title: '读完啦！📖', extra: res.extra, onDone: () => nav.go('reading') }));
  }
  let lv = state.settings.stage;
  const box = h('div');
  function render() {
    const list = READINGS.filter((r) => r.lv === lv);
    box.replaceChildren(
      h('div', { class: 'row wrap center' }, [1, 2, 3, 4, 5, 6].map((n) => btn(String(n), () => { lv = n; render(); }, 'chip' + (n === lv ? ' on' : '')))),
      h('div', { class: 'row center' }, lvTag(lv), note(`${list.length} 篇`, 'small')),
      h('div', { class: 'list' }, list.map((r) => listItem({ icon: r.classical ? '📜' : '📖', title: r.title, sub: r.text[0].slice(0, 26) + '…', done: starsOf(state.done['reading:' + r.id]), onClick: () => nav.go('reading', { id: r.id }) }))));
  }
  root.replaceChildren(
    h('p', { class: 'intro' }, note('读懂一篇文章，要像侦探一样找线索。每道题都标了用到的"阅读策略"，做多了你就会了。')),
    h('div', { class: 'skill-row' }, Object.entries(SKILLS).map(([k, v]) => h('span', { class: 'skill-tag', title: v.tip }, v.icon, k))),
    box);
  render();
}

export function pickReading() {
  const pool = forStage(READINGS, 4);
  const fresh = pool.filter((r) => !state.done['reading:' + r.id]);
  return pick(fresh.length ? fresh : pool);
}

export function runReading(root, r) {
  return new Promise((resolve) => {
    let right = 0;
    const paras = r.text.map((t) => h('p', { class: 'story-line' }, t));
    paras.forEach((p, i) => p.addEventListener('click', () => speak(r.text[i].replace(/【[^】]+】/, ''))));
    const playAll = async () => {
      await speakLines(r.text.map((t) => t.replace(/【[^】]+】/, '')), { gap: 400, onLine: (i) => paras.forEach((p, k) => p.classList.toggle('reading', k === i)) });
    };
    const readBox = h('div');
    root.replaceChildren(h('div', { class: 'activity' },
      h('div', { class: 'scene-head' }, h('span', { class: 'scene-icon' }, r.classical ? '📜' : '📖'), h('div', {}, h('b', {}, r.title), ' ', lvTag(r.lv))),
      h('div', { class: 'tip-card' }, h('div', { class: 'tip-title' }, '🕵️ 读前猜一猜'), note(`看题目"${r.title}"，你猜文章会写什么？想一想再往下读。`)),
      h('div', { class: 'story-text' }, paras),
      h('div', { class: 'row center wrap' },
        btn('🔊 听全文', playAll, 'soft'),
        btn('⏹', () => stopSpeaking(), 'soft'),
        btn('🎤 朗读一段', () => {
          const t = r.text.find((x) => !x.startsWith('【')) || r.text[0];
          const seg = t.length > 90 ? t.slice(0, t.indexOf('。', 40) + 1 || 90) : t;
          readBox.replaceChildren(readCard({ text: seg, title: '朗读：读准、读顺、读出感情' }).node);
        }, 'soft')),
      readBox,
      h('div', { class: 'row center' }, btn('开始答题 ➜', () => quiz(), 'primary big'))));

    function quiz() {
      stopSpeaking();
      let i = 0;
      right = 0;
      const prog = progressBar(r.q.length);
      const stage = h('div');
      const peek = h('details', { class: 'story-peek' }, h('summary', {}, '📖 回到原文找线索'), r.text.map((t) => h('p', { class: 'small' }, t)));
      root.replaceChildren(h('div', { class: 'activity' }, h('h3', {}, r.title), prog.node, stage, peek));
      function show() {
        prog.set(i);
        const q = r.q[i];
        const sk = SKILLS[q.skill] || { icon: '❓', tip: '' };
        const s = shuffled(q.o, q.a);
        stage.replaceChildren(
          h('div', { class: 'skill-tag big' }, sk.icon, ' ', q.skill, '　', h('span', { class: 'muted small' }, sk.tip)),
          h('h3', {}, q.q));
        choice(stage, s.options, s.answer, { explain: q.e }).then((ok) => {
          if (ok) right++;
          stage.append(h('div', { class: 'row end' }, btn(i + 1 < r.q.length ? '下一题 ➜' : '完成 ✓', () => {
            i++;
            if (i < r.q.length) show();
            else end();
          }, 'primary')));
        });
      }
      show();
    }

    function end() {
      const score = right / r.q.length;
      markDone('reading:' + r.id, score);
      const sentences = r.text.join('').split(/(?<=[。！？])/).filter((s) => s.length >= 12 && s.length <= 60 && !s.includes('【'));
      const extra = h('div', {},
        h('p', { class: 'center' }, `答对 ${right} / ${r.q.length} 题`),
        sentences.length ? h('div', { class: 'panel' }, h('h3', {}, '💎 摘抄好句到素材本'), sentences.slice(0, 4).map((s) => h('p', { class: 'small' }, s, ' ', collectBtn('sentence', s.trim(), `《${r.title}》`)))) : null,
        h('div', { class: 'tip-card' }, h('div', { class: 'tip-title' }, '🗣️ 读后说一说'), note('用一两句话，把这篇文章讲给家人听：谁 + 做了什么 + 结果怎样（或：作者的观点是……）。')));
      sfx.win();
      resolve({ score, xp: addXP(8 + right * 4, 'reading'), extra });
    }
  });
}
