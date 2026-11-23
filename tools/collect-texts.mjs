// 收集 app 里所有会被朗读的中文，供 tools/gen_audio.py 预生成自然的普通话音频。
//   node tools/collect-texts.mjs   → tools/texts.json
// slow: true 的条目还会生成一版慢速音频（页面上有"🐢 慢速"按钮的内容）。
import { writeFileSync } from 'node:fs';
import { IDIOMS, WORD_BANKS, UPGRADES } from '../js/data/words.js';
import { POEMS, poemLines } from '../js/data/poems.js';
import { JOIN, RHETORIC, UPGRADE_SENT, EXPAND } from '../js/data/sentences.js';
import { READINGS } from '../js/data/readings.js';
import { STRUCTURES, OPENINGS, ENDINGS, TECHNIQUES } from '../js/data/writing.js';
import { TOPICS, SPEECHES, RETELL, TWISTERS, PAUSES } from '../js/data/speaking.js';
import { SCENES } from '../js/data/scenes.js';
import { normText, roleVoice } from '../js/audio-keys.js';

const items = new Map();
function add(text, { voice = 'main', slow = false } = {}) {
  if (typeof text !== 'string') return;
  const t = normText(text);
  if (!t || !/[一-鿿]/.test(t)) return;
  const key = voice + '|' + t;
  const prev = items.get(key);
  items.set(key, { text: t, voice, slow: slow || prev?.slow || false });
}

// 朗读卡（有慢速按钮）里出现的长文本
const readSeg = (t) => (t.length > 90 ? t.slice(0, t.indexOf('。', 40) + 1 || 90) : t);

for (const i of IDIOMS) { add(i.w); add(i.ex); add(i.story); }
for (const b of WORD_BANKS) { b.words.forEach((w) => add(w)); add(b.words.join('，')); }
for (const u of UPGRADES) add(u.ctx);
for (const p of POEMS) {
  add(p.text, { slow: true });
  poemLines(p).forEach((l) => add(l));
}
JOIN.forEach((j) => add(j.ans));
RHETORIC.forEach((r) => add(r.s));
UPGRADE_SENT.forEach((u) => u.good.forEach((g) => add(g)));
EXPAND.forEach((e) => add(e.good));
for (const r of READINGS) {
  const paras = r.text.map((t) => t.replace(/【[^】]+】/, ''));
  paras.forEach((t) => add(t));
  const first = r.text.find((x) => !x.startsWith('【')) || r.text[0];
  add(readSeg(first), { slow: true });
}
STRUCTURES.forEach((s) => add(s.example.replace(/\n/g, '')));
[...OPENINGS, ...ENDINGS].forEach((o) => add(o.ex));
TECHNIQUES.forEach((t) => add(t.good));
TOPICS.forEach((t) => add(t.q));
SPEECHES.forEach((s) => add(s.open));
RETELL.forEach((r) => add(r.text));
TWISTERS.forEach((t) => add(t.text, { slow: true }));
PAUSES.forEach((p) => (p.versions || []).forEach((v) => add(v.mark.replace(/\//g, '，'))));
for (const s of SCENES) {
  for (const st of s.steps) {
    if (!/^（.*）$/.test(st.say)) add(st.say, { voice: roleVoice(s.role) });
    const best = st.options.find((o) => o.ok === 2);
    add(best.t, { slow: true });
  }
}
// 固定的几句
add('你好，我是墨墨，我们一起练习表达吧！');

const list = [...items.values()];
writeFileSync(new URL('./texts.json', import.meta.url), JSON.stringify(list));
const chars = list.reduce((a, x) => a + x.text.length, 0);
const slowChars = list.filter((x) => x.slow).reduce((a, x) => a + x.text.length, 0);
console.log(`${list.length} 条，${chars} 字（其中 ${list.filter((x) => x.slow).length} 条 / ${slowChars} 字另有慢速版）`);
