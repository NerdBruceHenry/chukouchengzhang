// 🏮 诗词经典：读诗、节奏朗读、接下句、飞花令
import { h, btn, note, sample, shuffle, pick, sfx, toast } from '../ui.js';
import { speak, recognize, hasASR } from '../speech.js';
import { choice, runSequence, finishScreen, readCard, collectBtn, speakBtn } from '../components.js';
import { state, addXP, markDone, srsAdd, today } from '../state.js';
import { POEMS, poemLines, rhythm, FEIHUA_KEYS } from '../data/poems.js';
import { forStage, listItem, lvTag, starsOf } from './common.js';
import { cleanZh } from '../score.js';

export function page(root, nav, params = {}) {
  nav.title('🏮 诗词经典');
  if (params.id) {
    const p = POEMS.find((x) => x.id === params.id);
    if (p) return poemPage(root, p, nav);
  }
  if (params.m === 'feihua') return runFeihua(root).then((r) => finishScreen(root, { score: r.score, xp: r.xp, title: '飞花令 🌸', onDone: () => nav.go('poems') }));
  if (params.m === 'next') return runNextLine(root, 8).then((r) => finishScreen(root, { score: r.score, xp: r.xp, title: '接下句 🏮', onDone: () => nav.go('poems') }));

  let lv = state.settings.stage;
  const box = h('div');
  const pod = poemOfDay();
  function render() {
    const list = POEMS.filter((p) => p.lv === lv);
    box.replaceChildren(
      h('div', { class: 'row wrap center' }, [1, 2, 3, 4, 5, 6].map((n) => btn(String(n), () => { lv = n; render(); }, 'chip' + (n === lv ? ' on' : '')))),
      h('div', { class: 'row center' }, lvTag(lv), note(`${list.length} 首`, 'small')),
      h('div', { class: 'list' }, list.map((p) => listItem({ icon: state.srs[p.id] ? '✅' : '📜', title: `《${p.t}》`, sub: `${p.d}·${p.a}　${poemLines(p)[0]}…`, done: starsOf(state.done[p.id]), onClick: () => nav.go('poems', { id: p.id }) }))));
  }
  root.replaceChildren(
    h('button', { class: 'quest-btn', type: 'button', onclick: () => nav.go('poems', { id: pod.id }) },
      h('span', { class: 'quest-icon' }, '🌅'), h('span', {}, h('b', {}, '每日一诗：《' + pod.t + '》'), h('br'), h('span', { class: 'zh' }, `${pod.d}·${pod.a}`)), h('span', { class: 'quest-go' }, '▶')),
    h('div', { class: 'row center' },
      btn('🌸 飞花令', () => nav.go('poems', { m: 'feihua' }), 'primary'),
      btn('🔗 接下句', () => nav.go('poems', { m: 'next' }), 'soft')),
    box);
  render();
}

/** 每日一诗：按日期在本阶段诗词中轮换，没背过的优先 */
export function poemOfDay() {
  const pool = forStage(POEMS, 6);
  const fresh = pool.filter((p) => !state.srs[p.id]);
  const list = fresh.length ? fresh : pool;
  const n = Number(today().replace(/-/g, ''));
  return list[n % list.length];
}

function poemText(p, withRhythm) {
  return h('div', { class: 'poem' },
    h('div', { class: 'poem-title' }, p.t),
    h('div', { class: 'poem-author' }, `${p.d}·${p.a}`),
    poemLines(p).reduce((rows, line) => {
      const last = rows[rows.length - 1];
      if (!last || /[。？！；]$/.test(last[last.length - 1])) rows.push([line]);
      else last.push(line);
      return rows;
    }, []).map((row) => h('div', { class: 'poem-line' }, row.map((l) => h('span', { onclick: () => speak(l) }, withRhythm ? rhythm(l) : l)))));
}

function poemPage(root, p, nav) {
  let showRhythm = false;
  const textBox = h('div');
  const draw = () => textBox.replaceChildren(poemText(p, showRhythm));
  draw();
  const card = readCard({
    text: p.text, title: '读一读：读准字音，读出节奏和感情',
    onScore: (s, best) => {
      markDone(p.id, best);
      if (s >= 0.7) srsAdd({ id: p.id, type: 'poem', front: `《${p.t}》${p.a}`, back: poemLines(p).slice(0, 2).join('') });
    },
  });
  root.replaceChildren(h('div', { class: 'activity' },
    h('div', { class: 'say-card' }, textBox,
      h('div', { class: 'row center wrap' },
        btn('🔊 听朗读', () => speak(p.text), 'soft'),
        btn('🐢 慢速', () => speak(p.text, { rate: 0.6 }), 'soft'),
        btn('🎼 节奏线', (e) => { showRhythm = !showRhythm; e.target.classList.toggle('on', showRhythm); draw(); }, 'chip'),
        collectBtn('poem', `${poemLines(p).slice(-2).join('')}——${p.a}《${p.t}》`)),
      h('p', { class: 'small' }, h('b', {}, '大意：'), p.m)),
    note('点任意一句可以单独听。打开"节奏线"，按 / 停顿，读起来更有韵味。', 'small'),
    card.node,
    h('div', { class: 'row center' },
      btn('🧠 背诵挑战', () => runRecite(root, p).then((r) => finishScreen(root, { score: r.score, xp: r.xp, title: `《${p.t}》背诵挑战`, onDone: () => nav.go('poems', { id: p.id }) })), 'primary'),
      btn('📜 返回诗单', () => nav.go('poems'), 'soft'))));
}

/** 每日任务里的诗：先听读两遍，再做接句挑战 */
export function runPoemStep(root, p) {
  return new Promise((resolve) => {
    root.replaceChildren(h('div', { class: 'activity' },
      h('div', { class: 'say-card' }, poemText(p, true),
        h('div', { class: 'row center' }, btn('🔊 听朗读', () => speak(p.text), 'soft'), btn('🐢 慢速', () => speak(p.text, { rate: 0.6 }), 'soft')),
        h('p', { class: 'small' }, h('b', {}, '大意：'), p.m)),
      note('跟着朗读，按 / 停顿，读两遍。然后挑战：上一句接下一句！', 'small'),
      h('div', { class: 'row center' }, btn('🧠 开始挑战', () => runRecite(root, p).then(resolve), 'primary big'))));
    speak(p.text);
  });
}

/** 背诵挑战：逐句选出下一句 */
export function runRecite(root, p) {
  const lines = poemLines(p);
  const others = POEMS.filter((x) => x !== p).flatMap(poemLines);
  const steps = lines.slice(0, -1).map((l, i) => ({ prev: l, next: lines[i + 1] })).slice(0, 6);
  if (!steps.length) return Promise.resolve({ score: 1, xp: 0 });
  return runSequence(root, {
    items: steps,
    head: h('h2', {}, `🧠 《${p.t}》下一句是？`),
    renderItem(stage, it, done) {
      const len = cleanZh(it.next).length;
      const wrong = sample(others.filter((l) => cleanZh(l).length === len && l !== it.next), 2);
      const opts = shuffle([it.next, ...wrong]);
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.prev, ' ……')));
      choice(stage, opts, opts.indexOf(it.next)).then((ok) => done(ok ? 1 : 0));
    },
  }).then((score) => {
    markDone(p.id, Math.max(state.done[p.id] || 0, score));
    if (score >= 0.8) srsAdd({ id: p.id, type: 'poem', front: `《${p.t}》${p.a}`, back: poemLines(p).slice(0, 2).join('') });
    return { score, xp: addXP(6 + score * 10, 'poem') };
  });
}

/** 接下句：混合本阶段的诗 */
export function runNextLine(root, n = 6) {
  const pool = forStage(POEMS, 8);
  const pairs = pool.flatMap((p) => { const ls = poemLines(p); return ls.slice(0, -1).map((l, i) => ({ p, prev: l, next: ls[i + 1] })); }).filter((x) => /[，、]$/.test(x.prev));
  const items = sample(pairs, n);
  const allLines = POEMS.flatMap(poemLines);
  return runSequence(root, {
    items,
    head: h('h2', {}, '🔗 接下句'),
    renderItem(stage, it, done) {
      const len = cleanZh(it.next).length;
      const wrong = sample(allLines.filter((l) => cleanZh(l).length === len && l !== it.next), 2);
      const opts = shuffle([it.next, ...wrong]);
      stage.append(h('div', { class: 'say-card' }, h('div', { class: 'say-text' }, it.prev, ' ……'), note(`《${it.p.t}》${it.p.a}`, 'small')));
      choice(stage, opts, opts.indexOf(it.next)).then((ok) => {
        stage.append(h('div', { class: 'row center' }, speakBtn(it.prev + it.next, '🔊 听这两句')));
        done(ok ? 1 : 0);
      });
    },
  }).then((score) => ({ score, xp: addXP(n * 2 + score * n * 2, 'poem') }));
}

// ---------- 飞花令：轮流说出带"令字"的诗句 ----------
export function runFeihua(root) {
  const key = pick(FEIHUA_KEYS);
  const bank = [...new Map(POEMS.flatMap((p) => poemLines(p).map((l) => [cleanZh(l), { line: l, p }]))).values()].filter((x) => cleanZh(x.line).includes(key));
  const used = new Set();
  let kidScore = 0;
  let rounds = 0;
  return new Promise((resolve) => {
    const log = h('div', { class: 'chat' });
    const panel = h('div');
    const add = (who, text, sub) => {
      log.append(h('div', { class: 'bubble ' + who }, h('div', { class: 'bubble-text' }, text), sub ? h('div', { class: 'muted small' }, sub) : null));
      log.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    root.replaceChildren(h('div', { class: 'activity' },
      h('h2', {}, '🌸 飞花令'),
      h('div', { class: 'say-card' }, h('div', { class: 'muted' }, '今天的令字'), h('div', { class: 'say-text huge' }, key), note('轮流说出带这个字的诗句，说不出来就输啦！', 'small')),
      log, panel));

    function find(text) {
      const t = cleanZh(text);
      if (!t.includes(key)) return null;
      return bank.find((x) => { const c = cleanZh(x.line); return t.includes(c) || (t.length >= 5 && c.includes(t)); });
    }
    function kidTurn() {
      const input = h('input', { class: 'wide-input', placeholder: `输入一句带"${key}"的诗` });
      const submit = (text) => {
        const hit = find(text);
        if (!hit) {
          if (cleanZh(text).includes(key) && cleanZh(text).length >= 5) {
            add('me', text, '墨墨的诗库里没找到这句，算你过关（请爸爸妈妈帮忙核对哦）');
            kidScore++;
            rounds++;
            return setTimeout(botTurn, 600);
          }
          sfx.bad();
          toast(cleanZh(text).includes(key) ? '这句好像不太对，再想想？' : `要带"${key}"字哦`);
          return;
        }
        if (used.has(cleanZh(hit.line))) return toast('这句已经说过啦，换一句！');
        used.add(cleanZh(hit.line));
        add('me', hit.line, `《${hit.p.t}》${hit.p.a}`);
        sfx.ok();
        kidScore++;
        rounds++;
        setTimeout(botTurn, 600);
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(input.value); });
      const mic = hasASR ? btn('🎤 说出诗句', async () => {
        mic.disabled = true;
        mic.classList.add('listening');
        const { alts } = await recognize({ timeout: 10000 });
        mic.disabled = false;
        mic.classList.remove('listening');
        const best = alts.find((a) => find(a)) || alts[0];
        if (best) submit(best);
      }, 'primary') : null;
      panel.replaceChildren(h('div', { class: 'reply-panel' },
        h('div', { class: 'row center' }, mic),
        h('div', { class: 'row' }, input, btn('说完了', () => submit(input.value), 'soft')),
        h('div', { class: 'row center' }, btn('🏳️ 想不出来了', () => end(), 'chip'))));
    }
    function botTurn() {
      const left = bank.filter((x) => !used.has(cleanZh(x.line)));
      if (!left.length || rounds >= 12) {
        add('bot', '墨墨想不出来啦，你赢了！🎉');
        return setTimeout(end, 1200);
      }
      const pickOne = pick(left);
      used.add(cleanZh(pickOne.line));
      add('bot', pickOne.line, `《${pickOne.p.t}》${pickOne.p.a}`);
      speak(pickOne.line).then(kidTurn);
    }
    function end() {
      const score = Math.min(1, kidScore / 5);
      const tips = bank.filter((x) => !used.has(cleanZh(x.line))).slice(0, 6);
      panel.replaceChildren(h('div', { class: 'panel' },
        h('h3', {}, `你说出了 ${kidScore} 句！`),
        tips.length ? [h('p', { class: 'muted small' }, '还可以说这些：'), tips.map((x) => h('div', { class: 'small' }, x.line, ' ', note(`《${x.p.t}》`)))] : null,
        h('div', { class: 'row center' }, btn('完成 ✓', () => resolve({ score, xp: addXP(5 + kidScore * 4, 'poem') }), 'primary big'))));
    }
    // 孩子先说
    kidTurn();
  });
}
