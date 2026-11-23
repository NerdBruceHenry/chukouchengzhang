// 内容格式检查：加新内容时跑 npm test，能发现答案下标越界、重复等错误。
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDIOMS, SYNONYMS, COLLOCATIONS, UPGRADES, WORD_BANKS } from '../js/data/words.js';
import { POEMS, poemLines, rhythm } from '../js/data/poems.js';
import { JOIN, RHETORIC, RHETORIC_TYPES, TRANSFORM, SICK, CONNECTIVES, UPGRADE_SENT, EXPAND } from '../js/data/sentences.js';
import { READINGS, SKILLS } from '../js/data/readings.js';
import { STRUCTURES, PROMPTS, IMITATE } from '../js/data/writing.js';
import { TOPICS, SPEECHES, RETELL, PICTURES, TWISTERS, FRAMES } from '../js/data/speaking.js';
import { SCENES } from '../js/data/scenes.js';
import { BADGES } from '../js/data/badges.js';

const lvOk = (x) => Number.isInteger(x.lv) && x.lv >= 1 && x.lv <= 6;
const mcOk = (name, list, needLv = true) => list.forEach((x, i) => {
  if (needLv) assert.ok(lvOk(x), `${name}[${i}] 阶段`);
  assert.ok(Array.isArray(x.o) && x.o.length >= 2, `${name}[${i}] 选项`);
  assert.ok(x.a >= 0 && x.a < x.o.length, `${name}[${i}] 答案下标`);
  assert.equal(new Set(x.o).size, x.o.length, `${name}[${i}] 选项重复`);
});

test('成语：不重复、四字以上、有意思和例句', () => {
  assert.equal(new Set(IDIOMS.map((i) => i.w)).size, IDIOMS.length);
  IDIOMS.forEach((i) => { assert.ok(i.w.length >= 4 && i.m && i.ex && lvOk(i), i.w); });
  assert.ok(IDIOMS.length >= 150);
});

test('选择题格式', () => {
  mcOk('SYNONYMS', SYNONYMS);
  mcOk('COLLOCATIONS', COLLOCATIONS);
  mcOk('TRANSFORM', TRANSFORM);
  mcOk('SICK', SICK);
  mcOk('CONNECTIVES', CONNECTIVES);
  READINGS.forEach((r) => mcOk(r.id, r.q, false));
});

test('诗词：能拆成诗句，节奏线正确', () => {
  assert.equal(new Set(POEMS.map((p) => p.id)).size, POEMS.length);
  POEMS.forEach((p) => {
    assert.ok(lvOk(p) && p.a && p.m, p.t);
    const lines = poemLines(p);
    assert.ok(lines.length >= 2, p.t);
    assert.equal(lines.join(''), p.text, p.t + ' 拆句后应能还原');
  });
  assert.equal(rhythm('床前明月光，'), '床前/明月光，');
  assert.equal(rhythm('飞流直下三千尺，'), '飞流/直下/三千尺，');
  assert.ok(POEMS.length >= 100);
});

test('造句题', () => {
  JOIN.forEach((j) => assert.equal(j.parts.join(''), j.ans.replace(/[，。！？]/g, '').replace(/[，]/g, ''), j.ans));
  RHETORIC.forEach((r) => assert.ok(RHETORIC_TYPES.includes(r.a), r.s));
  [...UPGRADE_SENT, ...EXPAND].forEach((x) => assert.ok(lvOk(x)));
  UPGRADES.forEach((u) => assert.ok(u.alts.length >= 8, u.plain));
  WORD_BANKS.forEach((b) => assert.ok(b.words.length >= 8, b.title));
});

test('阅读：策略标签有效、id 唯一', () => {
  assert.equal(new Set(READINGS.map((r) => r.id)).size, READINGS.length);
  READINGS.forEach((r) => { assert.ok(lvOk(r), r.id); r.q.forEach((q) => assert.ok(SKILLS[q.skill], `${r.id} ${q.skill}`)); });
  assert.ok(READINGS.length >= 28);
});

test('写作与口才', () => {
  [...STRUCTURES, ...PROMPTS, ...IMITATE, ...TOPICS, ...SPEECHES, ...RETELL, ...PICTURES, ...TWISTERS].forEach((x) => assert.ok(lvOk(x)));
  [...TOPICS, ...SPEECHES].forEach((t) => assert.ok(FRAMES[t.frame], t.q));
  RETELL.forEach((r) => r.keys.forEach((k) => assert.ok(r.text.includes(k), `${r.title} 关键词"${k}"不在原文中`)));
});

test('沟通情境：每步有且只有一个最佳回应', () => {
  assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length);
  SCENES.forEach((s) => s.steps.forEach((st, i) => {
    assert.equal(st.options.filter((o) => o.ok === 2).length, 1, `${s.id} 第${i + 1}步`);
    st.options.forEach((o) => assert.ok([0, 1, 2].includes(o.ok) && o.why));
  }));
});

test('徽章 id 唯一', () => {
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});
