// 📈 成长档案：能力雷达、写作量、口头表达曲线、打卡热力图、徽章
import { h, btn, note } from '../ui.js';
import { state, rank, streak, srsStats, addDays, today } from '../state.js';
import { BADGES } from '../data/badges.js';

const AXES = [
  { k: 'word', name: '词语积累', acts: ['word', 'review'] },
  { k: 'poem', name: '诗词文化', acts: ['poem'] },
  { k: 'sentence', name: '遣词造句', acts: ['sentence'] },
  { k: 'reading', name: '阅读理解', acts: ['reading'] },
  { k: 'write', name: '书面表达', acts: ['write', 'ai'] },
  { k: 'speak', name: '口头表达', acts: ['speak'] },
  { k: 'talk', name: '沟通能力', acts: ['talk'] },
];

export function actTotals() {
  const t = {};
  for (const d of Object.values(state.days)) for (const [k, v] of Object.entries(d.acts || {})) t[k] = (t[k] || 0) + v;
  return t;
}

function radar(values) {
  const n = values.length;
  const R = 110;
  const cx = 150;
  const cy = 140;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ring = (f) => values.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  const svg = el('svg', { viewBox: '0 0 300 285', class: 'radar', role: 'img', 'aria-label': '能力雷达图' });
  [0.25, 0.5, 0.75, 1].forEach((f) => svg.append(el('polygon', { points: ring(f), class: 'radar-ring' })));
  values.forEach((v, i) => {
    const [x, y] = pt(i, R);
    svg.append(el('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'radar-axis' }));
    const [lx, ly] = pt(i, R + 20);
    svg.append(el('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', class: 'radar-label' }, v.name));
  });
  svg.append(el('polygon', { points: values.map((v, i) => pt(i, R * Math.max(0.06, v.f)).join(',')).join(' '), class: 'radar-area' }));
  return svg;
}

function bars(points, label) {
  if (points.length < 2) return note('多练几次，这里会画出你的进步曲线。', 'small');
  const max = Math.max(...points.map((p) => p.v), 1);
  return h('div', { class: 'bars' }, points.map((p) => h('div', { class: 'bar-col', title: `${p.d}：${p.v}${label}` },
    h('div', { class: 'bar', style: { height: Math.round((p.v / max) * 100) + '%' } }),
    h('div', { class: 'bar-v' }, String(p.v)))));
}

export function page(root, nav) {
  nav.title('📈 成长档案');
  const r = rank();
  const t = actTotals();
  const vals = AXES.map((a) => {
    const n = a.acts.reduce((s, k) => s + (t[k] || 0), 0);
    return { name: a.name, n, f: Math.min(1, Math.sqrt(n / 60)) };
  });
  const chars = state.works.reduce((a, w) => a + (w.chars || 0), 0);
  const st = srsStats();
  const talks = state.talks.slice(-12);
  const days = [];
  for (let i = 7 * 12 - 1; i >= 0; i--) days.push(addDays(today(), -i));
  const owned = new Set(state.badges);

  root.replaceChildren(
    h('div', { class: 'hero' }, h('div', { class: 'mascot' }, r.icon), h('div', { class: 'hero-body' },
      h('div', { class: 'hero-greet' }, r.name, '　', h('span', { class: 'small muted' }, `${state.xp} 经验 · 连续 ${streak()} 天`)),
      h('div', { class: 'pbar' }, h('div', { class: 'pfill', style: { width: Math.round(r.progress * 100) + '%' } })))),
    h('div', { class: 'stat-row' },
      stat(chars, '累计写了多少字'), stat(state.works.length, '篇作品'), stat(state.talks.length, '次口头表达'), stat(st.mastered + '/' + st.total, '牢记/复习卡')),
    h('div', { class: 'panel center' }, h('h3', {}, '🕸️ 七项表达能力'), radar(vals), note('越往外，说明这项练得越多。哪个角缩着，就多去练练它！', 'small')),
    h('div', { class: 'panel' }, h('h3', {}, '🎤 口头表达：每次说了多少字'), bars(talks.map((x) => ({ d: x.date, v: x.chars })), '字')),
    h('div', { class: 'panel' }, h('h3', {}, '😶 口头禅越来越少了吗？'), bars(talks.map((x) => ({ d: x.date, v: x.fillers })), '次')),
    h('div', { class: 'panel' }, h('h3', {}, '📅 最近 12 周'),
      h('div', { class: 'heat' }, days.map((d) => {
        const rec = state.days[d];
        const lvl = !rec ? 0 : rec.quest ? 3 : rec.sec >= 600 ? 2 : rec.sec > 0 ? 1 : 0;
        return h('i', { class: 'h' + lvl, title: `${d}${rec ? `：${Math.round(rec.sec / 60)} 分钟` : ''}` });
      }))),
    h('div', { class: 'panel' }, h('h3', {}, `🏅 徽章墙（${owned.size}/${BADGES.length}）`),
      h('div', { class: 'badge-grid' }, BADGES.map((b) => h('div', { class: 'badge-item' + (owned.has(b.id) ? '' : ' locked'), title: b.desc }, h('div', { class: 'badge-e' }, owned.has(b.id) ? b.icon : '🔒'), h('div', { class: 'small' }, b.name), h('div', { class: 'tiny muted' }, b.desc))))),
    h('div', { class: 'row center' }, btn('📂 作品集', () => nav.go('writing', { m: 'works' }), 'soft'), btn('📒 素材本', () => nav.go('material'), 'soft')));
}

function stat(n, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'small' }, label));
}
