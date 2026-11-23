// 进度、设置、间隔重复、素材本、作品集，全部存在本机 localStorage。

const KEY = 'kcz.v1';

const DEFAULTS = {
  settings: {
    stage: 1, // 1-6 成长阶段
    voiceURI: '', // 备用朗读声音（没有预生成音频时）
    rate: 1, // 朗读语速（1 = 自然语速）
    dailyGoal: 15, // 分钟
    apiKey: '',
    model: 'claude-opus-5-5',
    kidName: '',
    onboarded: false,
  },
  xp: 0,
  coins: 0,
  days: {}, // 'YYYY-MM-DD' → { sec, xp, acts, quest }
  srs: {}, // 复习卡
  done: {}, // 'reading:xxx' → 最好成绩 0-1
  used: {}, // 素材本里的词被孩子自己用出来的次数 → 掌握
  material: [], // 素材本 { id, kind:'word'|'idiom'|'sentence'|'poem'|'mine', text, note, at }
  works: [], // 作品集：写作 { id, kind, title, text, words, at, feedback }
  talks: [], // 口头表达记录 { date, kind, title, sec, chars, cpm, fillers, rich, idioms }
  badges: [],
  plan: null,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return { ...structuredClone(DEFAULTS), ...raw, settings: { ...DEFAULTS.settings, ...(raw.settings || {}) } };
    }
  } catch { /* storage blocked or corrupt */ }
  return structuredClone(DEFAULTS);
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* 隐私模式等 */ }
}

export function exportData() {
  return JSON.stringify(state, null, 1);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object' || !data.settings) throw new Error('bad file');
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, structuredClone(DEFAULTS), data, { settings: { ...DEFAULTS.settings, ...data.settings } });
  save();
}

// ---------- 日期 ----------
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const today = () => dateKey();
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

export function dayRec(key = today()) {
  if (!state.days[key]) state.days[key] = { sec: 0, xp: 0, acts: {}, quest: false };
  return state.days[key];
}

// ---------- 奖励 ----------
const emit = () => document.dispatchEvent(new CustomEvent('kcz:stats'));

export function addXP(n, act) {
  n = Math.max(0, Math.round(n));
  state.xp += n;
  const d = dayRec();
  d.xp += n;
  if (act) d.acts[act] = (d.acts[act] || 0) + 1;
  save();
  emit();
  return n;
}

export function addCoins(n) {
  state.coins += n;
  save();
  emit();
}

export function addSeconds(sec) {
  dayRec().sec += sec;
  save();
}

function dayCounts(key) {
  const d = state.days[key];
  return !!d && (d.quest || d.sec >= 300);
}

export function streak() {
  let key = today();
  let n = 0;
  if (!dayCounts(key)) key = addDays(key, -1);
  while (dayCounts(key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function markDone(id, score) {
  const prev = state.done[id] || 0;
  if (score > prev) state.done[id] = Math.round(score * 100) / 100;
  save();
}

export const RANKS = [
  { xp: 0, name: '小书童', icon: '🧒' },
  { xp: 120, name: '识字郎', icon: '🔤' },
  { xp: 350, name: '小秀才', icon: '📜' },
  { xp: 900, name: '妙笔生', icon: '🖌️' },
  { xp: 2000, name: '小诗人', icon: '🏮' },
  { xp: 3800, name: '辩才', icon: '🎙️' },
  { xp: 6500, name: '小翰林', icon: '📚' },
  { xp: 10500, name: '才子', icon: '🌟' },
  { xp: 16500, name: '状元', icon: '🎓' },
  { xp: 25000, name: '文曲星', icon: '✨' },
];
export function rank(xp = state.xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return { ...RANKS[i], index: i, next, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

// ---------- 间隔重复（莱特纳盒子） ----------
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

/** item: { id, type:'word'|'idiom'|'poem'|'sentence', front, back, ex? } */
export function srsAdd(item) {
  if (state.srs[item.id]) return false;
  state.srs[item.id] = { ...item, box: 1, due: addDays(today(), 1), seen: 0, ok: 0 };
  save();
  return true;
}

export function srsDue(limit = 20) {
  const t = today();
  return Object.values(state.srs)
    .filter((c) => c.due <= t)
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due))
    .slice(0, limit);
}

export function srsGrade(id, ok) {
  const c = state.srs[id];
  if (!c) return;
  c.seen++;
  if (ok) {
    c.ok++;
    c.box = Math.min(c.box + 1, INTERVALS.length - 1);
  } else {
    c.box = 1;
  }
  c.due = addDays(today(), ok ? INTERVALS[c.box] : 1);
  save();
}

export function srsStats() {
  const all = Object.values(state.srs);
  return { total: all.length, mastered: all.filter((c) => c.box >= 5).length, due: srsDue(999).length };
}

// ---------- 素材本 ----------
export function addMaterial(kind, text, note = '') {
  text = String(text).trim();
  if (!text) return false;
  if (state.material.some((m) => m.text === text)) return false;
  state.material.push({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind, text, note, at: Date.now() });
  save();
  return true;
}

export function removeMaterial(id) {
  state.material = state.material.filter((m) => m.id !== id);
  save();
}

/**
 * "积累 → 运用"：孩子自己写的/说的话里用上了素材本里的词，就记一次"用出来"。
 * 返回这次新用上的词。
 */
export function markUsed(text) {
  const hits = [];
  for (const m of state.material) {
    if (m.kind === 'sentence' || m.kind === 'poem' || m.kind === 'mine') continue;
    if (m.text.length >= 2 && text.includes(m.text)) {
      state.used[m.text] = (state.used[m.text] || 0) + 1;
      hits.push(m.text);
    }
  }
  if (hits.length) save();
  return hits;
}

export function addWork(work) {
  const w = { id: 'w' + Date.now().toString(36), at: Date.now(), ...work };
  state.works.push(w);
  if (state.works.length > 300) state.works.shift();
  save();
  return w;
}

export function addTalk(rec) {
  state.talks.push({ date: today(), ...rec });
  if (state.talks.length > 300) state.talks.shift();
  save();
}
