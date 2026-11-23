// 通用组件：朗读卡、选择题、进度条、结束页、计时说话、加入素材本按钮。
import { h, btn, note, sfx, praise, stars, sleep, toast } from './ui.js';
import { speak, recognize, hasASR, hasRecorder, startRecording, playBlob, stopRecognize, LiveTranscriber, saveRecording } from './speech.js';
import { compareZh, fluency } from './score.js';
import { state, save, addMaterial, markUsed, addTalk } from './state.js';
import { ALL_IDIOMS } from './data/words.js';
import { checkBadges } from './data/badges.js';

let recordDuringASR = true;

export function playButtons(text, opts = {}) {
  return h('div', { class: 'row center' },
    btn('🔊 听示范', () => speak(text, { voice: opts.voice }), 'soft'),
    btn('🐢 慢速', () => speak(text, { rate: 0.6, voice: opts.voice }), 'soft'));
}

export const speakBtn = (text, label = '🔊', opts = {}) => btn(label, (e) => { e.stopPropagation(); speak(text, opts); }, 'chip tiny');

/** "收藏到素材本" 小按钮 */
export function collectBtn(kind, text, noteText = '') {
  const has = () => state.material.some((m) => m.text === text);
  const b = btn(has() ? '★ 已收藏' : '☆ 收藏', (e) => {
    e.stopPropagation();
    if (addMaterial(kind, text, noteText)) {
      sfx.coin();
      toast('已放进素材本 📒，写作和说话时用上它！');
    }
    b.textContent = '★ 已收藏';
    b.disabled = true;
  }, 'chip tiny');
  if (has()) b.disabled = true;
  return b;
}

function colorChars(chars) {
  return h('div', { class: 'heard-zh' }, chars.map((c) => h('span', { class: 'c ' + c.st }, c.ch)));
}

/**
 * 朗读卡：听示范 → 自己读 → 逐字反馈（绿=读对，红=漏读/读错）。
 * opts: { text, title, tip, autoplay, onScore(score, best), voice }
 */
export function readCard(opts) {
  const { text } = opts;
  let best = 0;
  let lastBlob = null;
  const result = h('div', { class: 'say-result' });
  const live = h('div', { class: 'live' });
  const micBtn = btn(hasASR ? '🎤 我来读' : '🎤 录音', () => (hasASR ? doRecognize() : doSelfCheck()), 'primary big');

  async function doRecognize() {
    micBtn.disabled = true;
    micBtn.classList.add('listening');
    micBtn.textContent = '👂 正在听…';
    live.textContent = '';
    result.replaceChildren();
    let rec = hasRecorder && recordDuringASR ? await startRecording() : null;
    const timeout = Math.min(60000, 6000 + text.length * 450);
    let { alts, error } = await recognize({ onInterim: (t) => (live.textContent = t), timeout });
    lastBlob = rec ? await rec.stop() : null;
    if (rec && error === 'audio-capture') {
      recordDuringASR = false;
      rec = null;
      lastBlob = null;
      ({ alts, error } = await recognize({ onInterim: (t) => (live.textContent = t), timeout }));
    }
    micBtn.disabled = false;
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎤 再读一次';
    live.textContent = '';
    if (error === 'not-allowed' || error === 'service-not-allowed') return result.append(h('p', { class: 'warn' }, '麦克风被禁止了。请在浏览器设置里允许使用麦克风。'));
    if (error && error !== 'aborted') return result.append(h('p', { class: 'warn' }, `语音识别出错（${error}）。请检查网络后再试。`));
    if (!alts.length) return result.append(h('p', { class: 'muted' }, '没听到声音，大声一点再试一次～'));
    const r = alts.map((a) => ({ ...compareZh(text, a), heard: a })).sort((a, b) => b.score - a.score)[0];
    showResult(r.score, r);
  }

  let selfRec = null;
  async function doSelfCheck() {
    if (selfRec) {
      const rec = selfRec;
      selfRec = null;
      lastBlob = await rec.stop();
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤 再录一次';
      await speak(text, { voice: opts.voice });
      await playBlob(lastBlob);
      result.append(h('p', {}, '和示范比一比：读得流利、有感情吗？'),
        h('div', { class: 'row center' }, btn('😀 很像', () => showResult(1)), btn('🙂 差不多', () => showResult(0.7)), btn('😅 还要练', () => showResult(0.3))));
      return;
    }
    result.replaceChildren();
    selfRec = await startRecording();
    if (!selfRec) return result.append(h('p', { class: 'warn' }, '这个浏览器不支持录音。建议用 iPad / iPhone 的 Safari 或电脑上的 Chrome、Edge。'));
    micBtn.textContent = '⏹ 读完了';
    micBtn.classList.add('listening');
  }

  function showResult(score, detail) {
    best = Math.max(best, score);
    result.replaceChildren();
    if (detail) result.append(colorChars(detail.chars));
    const st = stars(score);
    result.append(h('div', { class: 'praise' }, h('span', { class: 'stars' }, st.text), ' ', praise(score)));
    if (detail && detail.missed) result.append(note(`红色的字没听清（${detail.missed} 个）。听一遍慢速，再试试！`, 'small'));
    if (lastBlob) result.append(h('div', { class: 'row center' }, btn('🔁 我的 vs 示范', async () => { await speak(text, { voice: opts.voice }); await playBlob(lastBlob); }, 'soft small')));
    score >= 0.65 ? sfx.ok() : sfx.bad();
    opts.onScore?.(score, best);
  }

  const node = h('div', { class: 'say-card' },
    opts.title ? h('div', { class: 'muted small' }, opts.title) : null,
    h('div', { class: 'say-text zh-text' + (text.length > 24 ? ' long' : '') }, text),
    opts.tip ? h('div', { class: 'note' }, opts.tip) : null,
    playButtons(text, opts),
    h('div', { class: 'row center' }, micBtn),
    live,
    result);
  if (opts.autoplay) setTimeout(() => speak(text, { voice: opts.voice }), 250);
  return { node, get best() { return best; }, stop: stopRecognize };
}

/** 选择题。孩子作答后 resolve(true/false)；可带解析。 */
export function choice(container, options, correct, { explain, onAnswer } = {}) {
  return new Promise((resolve) => {
    const box = h('div', { class: 'choices' });
    options.forEach((opt, i) => {
      const b = btn(opt, () => {
        const ok = i === correct;
        box.querySelectorAll('button').forEach((x, j) => {
          x.disabled = true;
          if (j === correct) x.classList.add('right');
        });
        if (!ok) b.classList.add('wrong');
        ok ? sfx.ok() : sfx.bad();
        if (explain) container.appendChild(h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') }, ok ? '✅ ' : '💡 ', explain));
        onAnswer?.(ok);
        resolve(ok);
      }, 'choice');
      box.appendChild(b);
    });
    container.appendChild(box);
  });
}

export function progressBar(total) {
  const fill = h('div', { class: 'pfill' });
  const label = h('span', { class: 'plabel' });
  const node = h('div', { class: 'progress' }, h('div', { class: 'pbar' }, fill), label);
  return {
    node,
    set(i) {
      fill.style.width = `${Math.round((i / total) * 100)}%`;
      label.textContent = `${Math.min(i + 1, total)}/${total}`;
    },
  };
}

export function finishScreen(root, { title = '完成啦！', score, xp, extra, onDone }) {
  const st = stars(score);
  const fresh = checkBadges(state);
  if (fresh.length) {
    save();
    setTimeout(() => fresh.forEach((b, i) => setTimeout(() => toast(`🏅 获得新徽章：${b.icon} ${b.name}！`, 3000), i * 3200)), 600);
  }
  root.replaceChildren(h('div', { class: 'finish' },
    h('div', { class: 'mascot big bounce' }, '🖌️'),
    h('h2', {}, title),
    h('div', { class: 'stars huge' }, st.text),
    h('p', {}, `+${xp} 经验`),
    extra || null,
    h('div', { class: 'row center' }, btn('继续 ➜', onDone, 'primary big'))));
  sfx.win();
}

/** 一题一题过的通用流程。items 逐个交给 renderItem(stage, item, done(score))。 */
export function runSequence(root, { items, head, renderItem }) {
  return new Promise((resolve) => {
    const prog = progressBar(items.length);
    const stage = h('div');
    const scores = [];
    root.replaceChildren(h('div', { class: 'activity' }, head || null, prog.node, stage));
    let i = 0;
    function show() {
      prog.set(i);
      stage.replaceChildren();
      let answered = false;
      renderItem(stage, items[i], (score) => {
        if (answered) return;
        answered = true;
        scores.push(score);
        stage.appendChild(h('div', { class: 'row end' }, btn(i + 1 < items.length ? '下一题 ➜' : '完成 ✓', () => {
          i++;
          if (i < items.length) show();
          else resolve(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
        }, 'primary')));
      }, i);
    }
    show();
  });
}

/**
 * 计时说话（即兴说、一分钟演讲、复述、看图说话……）：
 * 先看题目准备，点"开始"后才倒数计时、录音、语音转文字；结束后给出字数、语速、口头禅、丰富度。
 * opts: { card, seconds, kind, title, prepSeconds }
 * 返回 { text, sec, f, blob, summary }
 */
export function runTimedTalk(root, opts) {
  const { card, seconds = 60, kind = 'talk', title = '' } = opts;
  return new Promise(async (resolve) => {
    const timer = h('div', { class: 'timer' }, String(seconds));
    const transcript = h('div', { class: 'transcript' }, h('span', { class: 'muted' }, hasASR ? '你说的话会显示在这里…' : '（这个浏览器不支持语音转文字，只录音）'));
    const controls = h('div', { class: 'row center' });
    const hint = h('p', { class: 'muted small center' }, '先看看题目，想好怎么说（可以先在心里列个提纲），准备好了再点"开始"。');
    root.replaceChildren(h('div', { class: 'activity' }, card, timer, hint, transcript, controls));
    await new Promise((go) => controls.replaceChildren(btn('▶ 开始', go, 'primary big')));
    hint.remove();
    controls.replaceChildren();
    for (const n of ['3', '2', '1', '开始！']) {
      timer.textContent = n;
      sfx.pop();
      await sleep(700);
    }
    if (!timer.isConnected) return; // 倒数时离开了页面
    let rec = await startRecording();
    let live = new LiveTranscriber((t) => (transcript.textContent = t));
    live.start();
    let finished = false;
    setTimeout(async () => {
      if (rec && live.error === 'audio-capture' && !finished) {
        await rec.stop();
        rec = null;
        live = new LiveTranscriber((t) => (transcript.textContent = t));
        live.start();
      }
    }, 1500);
    const t0 = Date.now();
    let left = seconds;
    timer.textContent = String(left);
    const stopBtn = btn('⏹ 说完了', () => finish(), 'soft');
    controls.replaceChildren(stopBtn);
    const iv = setInterval(() => {
      if (!timer.isConnected) {
        // 已离开这个页面：停止录音和识别，不再显示结果
        clearInterval(iv);
        finished = true;
        live.stop();
        rec?.stop();
        return;
      }
      left--;
      timer.textContent = String(Math.max(0, left));
      if (left <= 10) timer.classList.add('hurry');
      if (left <= 0) finish();
    }, 1000);

    async function finish() {
      if (finished) return;
      finished = true;
      clearInterval(iv);
      stopBtn.disabled = true;
      timer.textContent = '⏳';
      const text = await live.stop();
      const blob = rec ? await rec.stop() : null;
      const sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
      const f = fluency(text, sec, ALL_IDIOMS);
      const usedMat = markUsed(text);
      if (hasASR) addTalk({ kind, title, sec, chars: f.chars, cpm: f.cpm, fillers: f.fillers, rich: f.rich, idioms: f.idioms.length });
      saveRecording({ kind, title, text, sec, ...f }, blob);
      const prev = state.talks.filter((t) => t.kind === kind).slice(-2, -1)[0];
      const summary = h('div', { class: 'talk-summary' },
        hasASR ? h('div', { class: 'stat-row' },
          stat(f.chars, '说了多少字'),
          stat(f.cpm, '字 / 分钟'),
          stat(f.fillers, '口头禅'),
          stat(Math.round(f.rich * 100) + '%', '用词丰富度')) : null,
        f.idioms.length ? h('p', { class: 'center' }, '🏅 用上了成语：', f.idioms.join('、')) : null,
        usedMat.length ? h('p', { class: 'center' }, '📒 素材本里的词用出来了：', usedMat.join('、')) : null,
        Object.keys(f.fillerList).length ? h('p', { class: 'muted small center' }, '口头禅明细：', Object.entries(f.fillerList).map(([k, v]) => `"${k}"×${v}`).join('  ')) : null,
        hasASR && prev ? h('p', { class: 'center small' }, f.chars > prev.chars ? `🚀 比上次多说了 ${f.chars - prev.chars} 个字！` : `上次说了 ${prev.chars} 个字，继续加油！`) : null,
        h('p', { class: 'muted small center' }, talkTip(f)),
        text ? h('details', {}, h('summary', {}, '📝 我说的话'), h('p', {}, text)) : null,
        blob ? h('div', { class: 'row center' }, btn('▶ 听听自己', () => playBlob(blob), 'soft')) : null);
      resolve({ text, sec, f, blob, summary, usedMat });
    }
  });
}

function stat(n, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'small' }, label));
}

export function talkTip(f) {
  if (f.chars < 30) return '小目标：下次多说几句！可以用"第一……第二……最后……"帮自己往下说。';
  if (f.fillers >= 5) return '"嗯、然后、那个"有点多。想不出来时，停一下、吸口气，比说口头禅更显得从容。';
  if (f.cpm > 280) return '说得有点快，适当停顿，听的人才跟得上、记得住。';
  if (f.cpm < 120) return '可以说得再连贯一些：先想好下一句的开头再停顿。';
  if (f.rich < 0.6) return '有些词重复了，试着换个说法，比如"很好"→"精彩、出色、了不起"。';
  if (!f.idioms.length) return '说得很流畅！下次试着用上一个成语或者素材本里的好词。';
  return '太棒了！有内容、有文采，正在向"出口成章"靠近！';
}
