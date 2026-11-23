// 🏅 徽章：每个都对应一个看得见的好习惯
const acts = (s) => {
  const t = {};
  for (const d of Object.values(s.days)) for (const [k, v] of Object.entries(d.acts || {})) t[k] = (t[k] || 0) + v;
  return t;
};
const streakOf = (s) => {
  const keys = Object.keys(s.days).filter((k) => s.days[k].quest || s.days[k].sec >= 300).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const d = new Date(k);
    run = prev && (d - prev) / 86400000 <= 1.01 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
};
const chars = (s) => s.works.reduce((a, w) => a + (w.chars || 0), 0);
const usedWords = (s) => Object.values(s.used).filter((n) => n >= 2).length;
const quests = (s) => Object.values(s.days).filter((d) => d.quest).length;
const poemsLearned = (s) => Object.keys(s.srs).filter((k) => k.startsWith('poem:')).length;
const idiomsLearned = (s) => Object.keys(s.srs).filter((k) => k.startsWith('idiom:')).length;

export const BADGES = [
  { id: 'first', icon: '🌱', name: '第一步', desc: '完成第一个每日任务', test: (s) => quests(s) >= 1 },
  { id: 'week', icon: '🔥', name: '一周不断', desc: '连续打卡 7 天', test: (s) => streakOf(s) >= 7 },
  { id: 'month', icon: '🏆', name: '月度坚持', desc: '连续打卡 30 天', test: (s) => streakOf(s) >= 30 },
  { id: 'idiom20', icon: '🏮', name: '成语小达人', desc: '学会 20 个成语', test: (s) => idiomsLearned(s) >= 20 },
  { id: 'idiom80', icon: '🐉', name: '成语大王', desc: '学会 80 个成语', test: (s) => idiomsLearned(s) >= 80 },
  { id: 'poem10', icon: '📜', name: '小诗人', desc: '背会 10 首诗词', test: (s) => poemsLearned(s) >= 10 },
  { id: 'poem50', icon: '🌙', name: '腹有诗书', desc: '背会 50 首诗词', test: (s) => poemsLearned(s) >= 50 },
  { id: 'mat30', icon: '📒', name: '积累家', desc: '素材本收藏 30 条', test: (s) => s.material.length >= 30 },
  { id: 'use10', icon: '🎯', name: '学以致用', desc: '10 个素材词被自己用出两次以上', test: (s) => usedWords(s) >= 10 },
  { id: 'write1k', icon: '✍️', name: '千字文', desc: '累计写作 1000 字', test: (s) => chars(s) >= 1000 },
  { id: 'write10k', icon: '🖌️', name: '妙笔生花', desc: '累计写作 10000 字', test: (s) => chars(s) >= 10000 },
  { id: 'talk10', icon: '🎙️', name: '敢说敢讲', desc: '完成 10 次口头表达', test: (s) => s.talks.length >= 10 },
  { id: 'nofill', icon: '😎', name: '从容不迫', desc: '一次说 150 字以上、口头禅不超过 1 次', test: (s) => s.talks.some((t) => t.chars >= 150 && t.fillers <= 1) },
  { id: 'reader', icon: '🔍', name: '阅读侦探', desc: '读完 10 篇文章', test: (s) => Object.keys(s.done).filter((k) => k.startsWith('reading:')).length >= 10 },
  { id: 'talker', icon: '🤝', name: '沟通高手', desc: '完成 10 个沟通情境', test: (s) => Object.keys(s.done).filter((k) => k.startsWith('scene:')).length >= 10 },
  { id: 'doctor', icon: '🩺', name: '病句医生', desc: '造句擂台练习 20 次', test: (s) => (acts(s).sentence || 0) >= 20 },
];

/** 返回新获得的徽章 */
export function checkBadges(s) {
  const owned = new Set(s.badges);
  const fresh = BADGES.filter((b) => !owned.has(b.id) && b.test(s));
  if (fresh.length) s.badges.push(...fresh.map((b) => b.id));
  return fresh;
}
