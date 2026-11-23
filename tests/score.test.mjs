import test from 'node:test';
import assert from 'node:assert/strict';
import { compareZh, countFillers, richness, fluency, analyzeWriting, hasParallelism, cleanZh, sameSentence, splitSentences } from '../js/score.js';
import { clipId } from '../js/audio-keys.js';

test('compareZh: 完全读对', () => {
  const r = compareZh('床前明月光，疑是地上霜。', '床前明月光疑是地上霜');
  assert.equal(r.score, 1);
  assert.equal(r.missed, 0);
  assert.equal(r.chars.filter((c) => c.st === 'punct').length, 2);
});

test('compareZh: 漏读的字标红', () => {
  const r = compareZh('举头望明月', '举头明月');
  assert.equal(r.missed, 1);
  assert.equal(r.chars.find((c) => c.ch === '望').st, 'miss');
  assert.ok(r.score < 1 && r.score > 0.6);
});

test('countFillers: 统计口头禅，不重复计算', () => {
  const f = countFillers('嗯，然后我就是说，然后那个那个……');
  assert.equal(f.found['然后'], 2);
  assert.equal(f.found['那个'], 2);
  assert.equal(f.found['就是说'], 1);
  assert.equal(f.found['就是'], undefined);
});

test('richness: 重复越多越低', () => {
  assert.ok(richness('我很高兴我很高兴我很高兴我很高兴') < richness('春天来了，小草绿了，桃花开了，燕子飞回来了'));
});

test('fluency: 字数和语速', () => {
  const f = fluency('今天我们去公园玩，画蛇添足的故事很有意思。', 30, ['画蛇添足']);
  assert.equal(f.chars, 19);
  assert.equal(f.cpm, 38);
  assert.deepEqual(f.idioms, ['画蛇添足']);
});

test('hasParallelism', () => {
  assert.ok(hasParallelism('青春是一首歌，青春是一幅画，青春是一团火。'));
  assert.ok(!hasParallelism('我今天很开心。'));
});

test('analyzeWriting: 识别修辞、感官、成语和"然后"', () => {
  const a = analyzeWriting('太阳像个大火球。我听见知了在叫，闻到西瓜的香味，尝了一口真甜。我们兴高采烈。然后我们回家，然后吃饭，然后睡觉。', { idioms: ['兴高采烈'] });
  assert.ok(a.rhetoric.includes('比喻'));
  assert.ok(a.senses.length >= 3);
  assert.deepEqual(a.idioms, ['兴高采烈']);
  assert.ok(a.tips.some((t) => t.includes('然后')));
  assert.ok(a.score > 0 && a.score <= 1);
});

test('cleanZh / sameSentence / splitSentences', () => {
  assert.equal(cleanZh('你好，世界！'), '你好世界');
  assert.ok(sameSentence('我把房间收拾得干干净净。', '我把房间收拾得干干净净'));
  assert.equal(splitSentences('一。二！三？').length, 3);
});

test('clipId 与生成脚本一致（FNV-1a）', () => {
  assert.equal(clipId('Awesome!'), '351b29c7');
  assert.equal(clipId('  a  b '), clipId('a b'));
});
