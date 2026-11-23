// 纯函数：中文朗读比对、口头表达流利度、写作"表达力"分析。有单元测试（tests/score.test.mjs）。

const PUNCT = /[\s，。！？、；：“”‘’"'（）()《》〈〉【】\[\]…—\-·,.!?;:~～]/g;
export const cleanZh = (s) => String(s || '').replace(PUNCT, '');
const HAN = /[㐀-鿿]/g;
export const hanCount = (s) => (String(s || '').match(HAN) || []).length;

/** 最长公共子序列对齐：返回目标文字每个字是否被读出来。 */
export function compareZh(target, said) {
  const a = [...cleanZh(target)];
  const b = [...cleanZh(said)];
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const hit = ok.filter(Boolean).length;
  const extra = Math.max(0, m - hit);
  const score = n ? Math.max(0, hit / n - Math.min(0.2, extra / Math.max(n, 1) / 2)) : 0;
  // 把对齐结果映射回原文（保留标点）
  const chars = [];
  let k = 0;
  for (const ch of String(target)) {
    if (ch.replace(PUNCT, '') === '') chars.push({ ch, st: 'punct' });
    else chars.push({ ch, st: ok[k++] ? 'ok' : 'miss' });
  }
  return { score: Math.min(1, score), chars, missed: n - hit };
}

// 口头禅：说话时用来"填空"的词
export const FILLERS = ['嗯', '呃', '额', '那个', '然后', '就是说', '就是', '这个这个', '反正', '对吧'];

export function countFillers(text) {
  const t = cleanZh(text);
  const found = {};
  let total = 0;
  let rest = t;
  for (const f of FILLERS) {
    const n = rest.split(f).length - 1;
    if (n) {
      found[f] = n;
      total += n;
      rest = rest.split(f).join('');
    }
  }
  return { total, found };
}

/** 词汇丰富度：不同"双字组合"占全部双字组合的比例（0-1）。中文没有空格分词，用双字组合近似。 */
export function richness(text) {
  const t = cleanZh(text).replace(/[^㐀-鿿]/g, '');
  if (t.length < 4) return 0;
  const grams = [];
  for (let i = 0; i < t.length - 1; i++) grams.push(t.slice(i, i + 2));
  return Math.round((new Set(grams).size / grams.length) * 100) / 100;
}

export function findIdioms(text, idioms) {
  const t = cleanZh(text);
  return idioms.filter((w) => w.length >= 4 && t.includes(w));
}

/** 口头表达：字数、语速（字/分钟）、口头禅、丰富度、用到的成语 */
export function fluency(text, sec, idioms = []) {
  const chars = hanCount(text);
  const cpm = Math.round(chars / Math.max(sec, 1) * 60);
  const f = countFillers(text);
  return { chars, cpm, fillers: f.total, fillerList: f.found, rich: richness(text), idioms: findIdioms(text, idioms) };
}

// ---------- 写作分析（不需要 AI 的即时反馈） ----------
const SIMILE = /(像|好像|好似|仿佛|宛如|如同|犹如|似的|一般)/;
const PERSONIFY = /(笑着|笑了|眨着|眨眼|招手|点头|跳舞|唱歌|睡着|醒来|哭泣|害羞|调皮|低着头|伸懒腰|窃窃私语|欢迎|拥抱)/;
const SENSES = { 看: /(看见|看到|望|瞧|只见|映入眼帘|颜色|红|绿|金黄|闪闪)/, 听: /(听见|听到|声|响|嗡嗡|哗哗|叽叽喳喳|沙沙)/, 闻: /(闻|香|味道|气味|芬芳|臭)/, 尝: /(尝|甜|酸|苦|辣|咸|鲜|可口)/, 触: /(摸|软|硬|滑|粗糙|凉|烫|暖|冰)/ };
const CONNECT = /(首先|其次|然后|接着|最后|因为|所以|虽然|但是|不但|而且|即使|如果|只要|只有|一方面|另一方面|总之|由此可见|换句话说|例如|比如)/g;

export function splitSentences(text) {
  return String(text || '').split(/[。！？!?…]+|\n+/).map((s) => s.trim()).filter((s) => hanCount(s) > 0);
}

/** 排比：连续三个分句以相同的两个字开头 */
export function hasParallelism(text) {
  const clauses = String(text).split(/[，。；！？,;!?\n]+/).map((s) => cleanZh(s)).filter((s) => s.length >= 3);
  for (let i = 0; i + 2 < clauses.length; i++) {
    const p = clauses[i].slice(0, 2);
    if (/^(然后|接着|就是|那个|还有|而且)$/.test(p)) continue;
    if (clauses[i + 1].startsWith(p) && clauses[i + 2].startsWith(p)) return true;
  }
  return false;
}

export function analyzeWriting(text, { idioms = [], goodWords = [] } = {}) {
  const chars = hanCount(text);
  const sentences = splitSentences(text);
  const paras = String(text).split(/\n\s*\n|\n/).filter((p) => hanCount(p) > 0).length;
  const avgLen = sentences.length ? Math.round(chars / sentences.length) : 0;
  const lens = sentences.map(hanCount);
  const variety = lens.length > 2 ? Math.round(Math.sqrt(lens.reduce((a, l) => a + (l - avgLen) ** 2, 0) / lens.length)) : 0;
  const senses = Object.entries(SENSES).filter(([, re]) => re.test(text)).map(([k]) => k);
  const usedIdioms = findIdioms(text, idioms);
  const usedGood = goodWords.filter((w) => w.length >= 2 && text.includes(w));
  const connectors = [...new Set(String(text).match(CONNECT) || [])];
  const rhetoric = [];
  if (SIMILE.test(text)) rhetoric.push('比喻');
  if (PERSONIFY.test(text)) rhetoric.push('拟人');
  if (hasParallelism(text)) rhetoric.push('排比');
  if (/[？?]/.test(text) && /难道|怎么能|岂不|何尝/.test(text)) rhetoric.push('反问');
  const punct = new Set((String(text).match(/[，。！？：；“”…—]/g) || [])).size;
  const fillers = countFillers(text).found;
  const repeatThen = (String(text).match(/然后/g) || []).length;

  // 表达力：每一项都看得见、改得了
  const tips = [];
  const praise = [];
  if (usedIdioms.length) praise.push(`用上了成语：${usedIdioms.join('、')}`);
  if (rhetoric.length) praise.push(`用了${rhetoric.join('、')}的修辞`);
  if (senses.length >= 3) praise.push(`调动了${senses.length}种感官（${senses.join('、')}），画面感很强`);
  if (usedGood.length) praise.push(`用上了好词：${usedGood.slice(0, 5).join('、')}`);
  if (variety >= 6) praise.push('句子有长有短，读起来有节奏');
  if (connectors.length >= 3) praise.push(`关联词让条理很清楚（${connectors.slice(0, 4).join('、')}）`);

  if (repeatThen >= 3) tips.push(`"然后"用了${repeatThen}次，可以换成"接着、随后、过了一会儿、紧接着"，或者干脆删掉`);
  if (avgLen > 38) tips.push('有的句子太长了，试着在意思完整的地方断开，一句话只说一件事');
  if (sentences.length >= 4 && variety < 3) tips.push('句子长短都差不多，加一个短句（比如"我愣住了。"）会更有力量');
  if (!rhetoric.length && chars >= 60) tips.push('试着加一个比喻或拟人，让画面活起来');
  if (senses.length <= 1 && chars >= 80) tips.push('除了"看到的"，再写写听到的、闻到的、摸到的');
  if (punct <= 2 && chars >= 60) tips.push('标点可以更丰富：对话用引号，强烈的感情用感叹号');
  if (fillers['反正'] || fillers['就是']) tips.push('书面表达里少用"反正、就是"这类口头语');

  const score = Math.min(1,
    Math.min(chars / 150, 1) * 0.3
    + Math.min(rhetoric.length / 2, 1) * 0.15
    + Math.min(senses.length / 3, 1) * 0.15
    + Math.min((usedIdioms.length + usedGood.length) / 3, 1) * 0.15
    + Math.min(variety / 6, 1) * 0.1
    + Math.min(connectors.length / 3, 1) * 0.1
    + (repeatThen >= 3 ? 0 : 0.05));
  return { chars, sentences: sentences.length, paras, avgLen, variety, senses, idioms: usedIdioms, good: usedGood, connectors, rhetoric, praise, tips, score: Math.round(score * 100) / 100 };
}

/** 连词成句 / 句子重组：去掉标点后比较 */
export const sameSentence = (a, b) => cleanZh(a) === cleanZh(b);
