// 🔁 复习：按记忆曲线（1→2→4→7→15→30→60 天）复习学过的成语和诗词
import { h, btn, note, sfx } from '../ui.js';
import { speak } from '../speech.js';
import { finishScreen, progressBar } from '../components.js';
import { state, srsDue, srsGrade, srsStats, addXP } from '../state.js';

export function page(root, nav) {
  nav.title('🔁 复习');
  const due = srsDue(20);
  const st = srsStats();
  if (!due.length) {
    root.replaceChildren(h('div', { class: 'panel center' },
      h('div', { class: 'mascot big' }, '🎉'),
      h('h3', {}, '今天没有要复习的啦！'),
      h('p', {}, `复习库里一共 ${st.total} 张卡，已牢牢记住 ${st.mastered} 张。`),
      note('学习成语、背会诗词后，它们会自动进入复习计划。'),
      h('div', { class: 'row center' }, btn('📚 去学新成语', () => nav.go('words', { m: 'idioms' }), 'primary'), btn('🏮 去读诗', () => nav.go('poems'), 'soft'))));
    return;
  }
  runReview(root, due).then((r) => finishScreen(root, { score: r.score, xp: r.xp, title: '复习完成！🧠', onDone: () => nav.go('home') }));
}

export function runReview(root, cards) {
  return new Promise((resolve) => {
    let i = 0;
    let ok = 0;
    const prog = progressBar(cards.length);
    const stage = h('div');
    root.replaceChildren(h('div', { class: 'activity' }, h('h2', {}, '🔁 先回忆，再看答案'), prog.node, stage));
    function show() {
      prog.set(i);
      const c = cards[i];
      const ask = c.type === 'poem' ? '背出这首诗的开头两句' : c.type === 'idiom' ? '说出它的意思，再用它说一句话' : '想一想它的意思';
      const back = h('div', { class: 'hidden-ans' });
      stage.replaceChildren(
        h('div', { class: 'say-card' }, h('div', { class: 'muted small' }, ask), h('div', { class: 'say-text huge' }, c.front)),
        h('div', { class: 'row center' }, btn('👀 看答案', () => {
          back.replaceChildren(h('div', { class: 'panel' }, h('p', {}, c.back), c.ex ? h('p', { class: 'small muted' }, '例：', c.ex) : null, btn('🔊', () => speak(c.back), 'chip tiny')),
            h('div', { class: 'row center' },
              btn('😀 记得', () => grade(true), 'primary'),
              btn('😅 忘了', () => grade(false), 'soft')));
          back.classList.remove('hidden-ans');
        }, 'soft big')),
        back);
      if (c.type !== 'poem') speak(c.front);
      function grade(g) {
        srsGrade(c.id, g);
        g ? sfx.ok() : sfx.pop();
        if (g) ok++;
        i++;
        if (i < cards.length) show();
        else resolve({ score: ok / cards.length, xp: addXP(cards.length * 2 + ok, 'review') });
      }
    }
    show();
  });
}
