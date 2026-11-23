// 各模块共用的小工具
import { h, shuffle } from '../ui.js';
import { state } from '../state.js';

/** 适合当前阶段的内容：本阶段和上一阶段为主；太少时放宽到下一阶段。 */
export function forStage(list, min = 4) {
  const s = state.settings.stage;
  let fit = list.filter((x) => x.lv <= s && x.lv >= s - 1);
  if (fit.length < min) fit = list.filter((x) => x.lv <= s + 1);
  if (fit.length < min) fit = list.slice();
  return fit;
}

/** 选择题选项打乱，返回 { options, answer } */
export function shuffled(options, answer) {
  const order = shuffle(options.map((_, i) => i));
  return { options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

export function menuGrid(items) {
  return h('div', { class: 'grid' }, items.map((it) => h('button', { class: 'tile', type: 'button', onclick: it.onClick },
    h('div', { class: 'tile-icon' }, it.icon),
    h('div', { class: 'tile-title' }, it.title),
    it.sub ? h('div', { class: 'tile-zh' }, it.sub) : null,
    it.badge ? h('div', { class: 'badge hot' }, it.badge) : null)));
}

export function listItem({ icon, title, sub, done, onClick }) {
  return h('button', { class: 'list-item', type: 'button', onclick: onClick },
    h('span', { class: 'li-icon' }, icon || '•'),
    h('span', { class: 'li-body' }, h('b', {}, title), sub ? h('div', { class: 'muted small' }, sub) : null),
    done != null ? h('span', { class: 'li-done' }, done) : null);
}

export const lvTag = (lv) => h('span', { class: `lv lv${lv}` }, ['🌱', '🌿', '🌳', '🚀', '🔭', '🌌'][lv - 1] + ' ' + ['萌芽', '抽枝', '成林', '启航', '远望', '星辰'][lv - 1]);

export function starsOf(score) {
  if (score == null) return '';
  const n = score >= 0.9 ? 3 : score >= 0.65 ? 2 : score >= 0.35 ? 1 : 0;
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}
