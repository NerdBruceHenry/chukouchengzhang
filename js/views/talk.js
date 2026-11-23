// 🤝 沟通情境
import { h, btn, note, shuffle, pick, sfx } from '../ui.js';
import { speak, recognize, hasASR } from '../speech.js';
import { finishScreen } from '../components.js';
import { state, addXP, markDone } from '../state.js';
import { SCENES, METHODS } from '../data/scenes.js';
import { roleVoice } from '../audio-keys.js';
import { forStage, listItem, lvTag, starsOf } from './common.js';
import { compareZh } from '../score.js';

export function page(root, nav, params = {}) {
  nav.title('🤝 沟通情境');
  if (params.id) {
    const sc = SCENES.find((s) => s.id === params.id);
    if (sc) return runScene(root, sc).then((r) => finishScreen(root, { score: r.score, xp: r.xp, title: '沟通小达人 🤝', extra: r.extra, onDone: () => nav.go('talk') }));
  }
  const s = state.settings.stage;
  root.replaceChildren(
    h('p', { class: 'intro' }, note('会说话，不只是说得漂亮，更是让对方愿意听、听得进。每个情境选出最得体的回应，再亲口说一遍。')),
    h('details', { class: 'panel' }, h('summary', {}, h('b', {}, '🧰 沟通工具箱（6 个好方法）')),
      METHODS.map((m) => h('div', { class: 'method' }, h('b', {}, m.icon, ' ', m.name), h('div', { class: 'small' }, m.tip)))),
    h('div', { class: 'list' }, SCENES.filter((x) => x.lv <= s + 1).map((x) => listItem({ icon: x.icon, title: x.title, sub: x.setup.slice(0, 28) + '…', done: starsOf(state.done['scene:' + x.id]), onClick: () => nav.go('talk', { id: x.id }) }))));
}

export function pickScene() {
  const pool = forStage(SCENES, 4);
  const fresh = pool.filter((x) => !state.done['scene:' + x.id]);
  return pick(fresh.length ? fresh : pool);
}

export function runScene(root, sc) {
  return new Promise((resolve) => {
    const voice = roleVoice(sc.role);
    const chat = h('div', { class: 'chat' });
    const panel = h('div');
    const scores = [];
    root.replaceChildren(h('div', { class: 'activity' },
      h('div', { class: 'scene-head' }, h('span', { class: 'scene-icon' }, sc.icon), h('div', {}, h('b', {}, sc.title), ' ', lvTag(sc.lv), h('div', { class: 'small muted' }, '对方：', sc.role))),
      h('div', { class: 'tip-card' }, '📍 ', sc.setup),
      chat, panel));
    const bubble = (who, text, extra) => {
      chat.append(h('div', { class: 'bubble ' + who }, h('div', { class: 'bubble-text' }, text), extra || null));
      chat.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    let idx = 0;
    async function step() {
      if (idx >= sc.steps.length) return end();
      const st = sc.steps[idx];
      const isAction = /^（.*）$/.test(st.say);
      bubble('bot', st.say, h('span', { class: 'small muted' }, sc.role, ' ', !isAction ? btn('🔊', () => speak(st.say, { voice }), 'chip tiny') : null));
      if (!isAction) await speak(st.say, { voice });
      choose(st);
    }
    function choose(st) {
      const opts = shuffle(st.options);
      panel.replaceChildren(h('div', { class: 'reply-panel' }, h('div', { class: 'muted small' }, '你会怎么回应？'),
        opts.map((o) => btn(o.t, () => picked(st, o), 'choice wide'))));
    }
    function picked(st, o) {
      const best = st.options.find((x) => x.ok === 2);
      const cls = o.ok === 2 ? 'ok' : o.ok === 1 ? 'mid' : 'bad';
      o.ok === 2 ? sfx.ok() : o.ok === 0 ? sfx.bad() : sfx.pop();
      const fb = h('div', { class: 'explain ' + (cls === 'mid' ? 'bad' : cls) }, ['🙂 还可以：', '🤔 不太好：', '🌟 很棒：'][[1, 0, 2].indexOf(o.ok)], o.why);
      const say = best.t;
      const res = h('div');
      const mic = btn(hasASR ? '🎤 把最好的说法说一遍' : '我在心里读了一遍 ✓', async () => {
        if (!hasASR) return next(1);
        mic.disabled = true;
        mic.classList.add('listening');
        mic.textContent = '👂 正在听…';
        const { alts } = await recognize({ timeout: 15000 });
        mic.disabled = false;
        mic.classList.remove('listening');
        mic.textContent = '🎤 再说一次';
        const r = alts.map((a) => compareZh(say, a)).sort((a, b) => b.score - a.score)[0];
        if (!r) return res.replaceChildren(note('没听到，再试一次～'));
        res.replaceChildren(h('div', { class: 'heard-zh' }, r.chars.map((c) => h('span', { class: 'c ' + c.st }, c.ch))), h('div', { class: 'small' }, r.score >= 0.7 ? '👍 说得很好！' : '可以再自然一点，用自己的话说也行～'));
        if (r.score >= 0.5) skip.textContent = '下一步 ➜';
      }, 'primary');
      const skip = btn('跳过 ➜', () => next(1), 'soft');
      const next = () => {
        scores.push(o.ok / 2);
        bubble('me', say);
        idx++;
        step();
      };
      skip.onclick = next;
      panel.replaceChildren(fb,
        o.ok !== 2 ? h('div', { class: 'panel' }, h('div', { class: 'small muted' }, '🌟 更好的说法：'), h('p', {}, best.t), h('div', { class: 'small' }, best.why)) : null,
        h('div', { class: 'row center' }, btn('🔊 听一听', () => speak(say), 'soft small'), mic, skip), res);
    }
    function end() {
      const score = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
      markDone('scene:' + sc.id, score);
      const m = METHODS[Math.floor(Math.random() * METHODS.length)];
      panel.replaceChildren();
      resolve({ score, xp: addXP(8 + score * 10, 'talk'), extra: h('div', { class: 'tip-card' }, h('div', { class: 'tip-title' }, '🧰 沟通小妙招：', m.icon, ' ', m.name), h('p', { class: 'small' }, m.tip)) });
    }
    step();
  });
}
