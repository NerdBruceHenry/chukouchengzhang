// 应用外壳：路由、首页、顶栏、练习计时、首次使用引导。
import { h, btn, clear, modal, toast, sfx } from './ui.js';
import { state, save, streak, rank, dayRec, srsDue } from './state.js';
import { addSeconds } from './state.js';
import { stopSpeaking, stopRecognize, voicesReady, hasASR } from './speech.js';
import { STAGES, stageOf } from './data/stages.js';
import * as daily from './views/daily.js';
import * as words from './views/words.js';
import * as poems from './views/poems.js';
import * as sentences from './views/sentences.js';
import * as reading from './views/reading.js';
import * as writing from './views/writing.js';
import * as speaking from './views/speaking.js';
import * as talk from './views/talk.js';
import * as ai from './views/ai.js';
import * as material from './views/material.js';
import * as review from './views/review.js';
import * as growth from './views/growth.js';
import * as parent from './views/parent.js';

const ROUTES = {
  daily: daily.page,
  words: words.page,
  poems: poems.page,
  sentences: sentences.page,
  reading: reading.page,
  writing: writing.page,
  speaking: speaking.page,
  talk: talk.page,
  ai: ai.page,
  material: material.page,
  review: review.page,
  growth: growth.page,
  parent: parent.page,
};

const APP = '出口成章';
const main = document.getElementById('main');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const statsEl = document.getElementById('stats');

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [route, qs] = raw.split('?');
  return { route: route || 'home', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
const hashFor = (route, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return '#/' + route + (qs ? '?' + qs : '');
};

const nav = {
  go(route, params = {}) {
    const target = route === 'home' ? '#/' : hashFor(route, params);
    if (location.hash === target || (route === 'home' && (location.hash === '' || location.hash === '#/'))) render();
    else location.hash = target;
  },
  title(t) {
    titleEl.textContent = t;
    document.title = t + ' · ' + APP;
  },
};

let current = 'home';
function render() {
  stopSpeaking();
  stopRecognize();
  const { route, params } = parseHash();
  current = route;
  document.body.dataset.route = route;
  clear(main);
  window.scrollTo(0, 0);
  backBtn.hidden = route === 'home';
  backBtn.onclick = () => (Object.keys(params).length && route !== 'daily' ? nav.go(route) : nav.go('home'));
  const fn = ROUTES[route];
  if (!fn) {
    nav.title(APP);
    home();
  } else fn(main, nav, params);
  renderStats();
}

function renderStats() {
  const r = rank();
  statsEl.replaceChildren(
    h('span', { title: '连续打卡天数' }, '🔥', streak()),
    h('span', { title: '经验' }, r.icon, state.xp),
    h('span', { title: '墨锭（金币）' }, '🪙', state.coins));
}
document.addEventListener('kcz:stats', renderStats);

// ---------------- 首页 ----------------
const MASCOT_SAYS = ['多读多写多说，自然出口成章！', '今天想用上哪个新词？', '好文章是改出来的～', '说话前先想一想：我最想让对方记住什么？', '腹有诗书气自华！', '把"很好"换个说法试试？'];

function home() {
  const r = rank();
  const d = dayRec();
  const goalSec = state.settings.dailyGoal * 60;
  const pct = Math.min(100, Math.round((d.sec / goalSec) * 100));
  const questDone = d.quest;
  const due = srsDue(99).length;
  const st = stageOf(state.settings.stage);
  const name = state.settings.kidName;
  const greet = questDone ? `今天的任务完成啦${name ? '，' + name : ''}！🎉` : `${name ? name + '，' : ''}你好！今天也来练练笔、说说话吧～`;

  const tile = (icon, title, sub, route, badge) => h('button', { class: 'tile', type: 'button', onclick: () => nav.go(route) },
    h('div', { class: 'tile-icon' }, icon), h('div', { class: 'tile-title' }, title), h('div', { class: 'tile-zh' }, sub),
    badge ? h('div', { class: 'badge hot' }, badge) : null);

  main.replaceChildren(
    h('div', { class: 'hero' },
      h('div', { class: 'mascot bounce', onclick: () => { sfx.pop(); toast(MASCOT_SAYS[Math.floor(Math.random() * MASCOT_SAYS.length)]); } }, '🖌️'),
      h('div', { class: 'hero-body' },
        h('div', { class: 'hero-greet' }, greet),
        h('div', { class: 'rank' }, r.icon, ' ', h('b', {}, r.name), r.next ? h('span', { class: 'muted small' }, ` → ${r.next.icon} ${r.next.name} 还差 ${r.next.xp - state.xp} 经验`) : null),
        h('div', { class: 'pbar' }, h('div', { class: 'pfill', style: { width: Math.round(r.progress * 100) + '%' } })),
        h('div', { class: 'small' }, `⏱️ 今天 ${Math.round(d.sec / 60)} / ${state.settings.dailyGoal} 分钟`, h('div', { class: 'pbar thin' }, h('div', { class: 'pfill goal', style: { width: pct + '%' } }))))),
    h('button', { class: 'quest-btn' + (questDone ? ' done' : ''), type: 'button', onclick: () => nav.go('daily') },
      h('span', { class: 'quest-icon' }, questDone ? '🏆' : '📜'),
      h('span', {}, h('b', {}, questDone ? '今日任务完成！' : '今日任务'), h('br'), h('span', { class: 'zh' }, questDone ? '明天继续，打卡别断哦' : '约 15 分钟 · 积累→组织→输出 · 完成开宝箱')),
      h('span', { class: 'quest-go' }, questDone ? '✓' : '▶')),
    h('h3', { class: 'section-title' }, '积累'),
    h('div', { class: 'grid' },
      tile('📚', '词语工坊', '成语·近义词·换个好词', 'words'),
      tile('🏮', '诗词经典', '每日一诗·飞花令', 'poems'),
      tile('📒', '我的素材本', '积累的好词好句', 'material', state.material.length ? String(state.material.length) : null),
      tile('🔁', '复习', '记忆曲线', 'review', due ? String(due) : null)),
    h('h3', { class: 'section-title' }, '组织'),
    h('div', { class: 'grid' },
      tile('✏️', '造句擂台', '修辞·病句·句子升级', 'sentences'),
      tile('🔍', '阅读侦探', '分级阅读·阅读策略', 'reading')),
    h('h3', { class: 'section-title' }, '输出'),
    h('div', { class: 'grid' },
      tile('📝', '写作工坊', '结构·技法·小练笔', 'writing'),
      tile('🎤', '口才训练营', '即兴说·演讲·复述', 'speaking'),
      tile('🤝', '沟通情境', '会说话，更会沟通', 'talk'),
      tile('🤖', 'AI 小老师', '批改作文·点评演讲', 'ai')),
    h('div', { class: 'home-foot' },
      h('span', { class: `lv lv${st.n}` }, `${st.icon} ${st.name} · ${st.grade}`),
      btn('📈 成长档案', () => nav.go('growth'), 'soft small'),
      btn('👨‍👩‍👧 家长中心', () => nav.go('parent'), 'soft small')),
    !hasASR ? h('p', { class: 'warn small' }, '提示：这个浏览器不支持中文语音识别，口语练习会改用"录音 + 自评"。推荐 iPad / iPhone 的 Safari，或电脑上的 Chrome、Edge。') : null);
}

// ---------------- 练习计时 ----------------
let lastInput = Date.now();
['pointerdown', 'keydown', 'touchstart', 'input'].forEach((ev) => window.addEventListener(ev, () => (lastInput = Date.now()), { passive: true }));
setInterval(() => {
  if (!['home', 'parent', 'growth'].includes(current) && document.visibilityState === 'visible' && Date.now() - lastInput < 90000) addSeconds(5);
}, 5000);

// ---------------- 首次使用 ----------------
async function onboarding() {
  if (state.settings.onboarded) return;
  let chosen = 1;
  const name = h('input', { placeholder: '你的名字或小名（可以不填）', class: 'wide-input', maxlength: '12' });
  const stageBtns = h('div', { class: 'list' }, STAGES.map((s) => {
    const b = btn([`${s.icon} ${s.name} · ${s.grade}`, h('div', { class: 'small muted' }, s.goal)], () => {
      chosen = s.n;
      stageBtns.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    }, 'wide level-opt' + (s.n === 1 ? ' on' : ''));
    return b;
  }));
  await modal(h('div', {},
    h('div', { class: 'center' }, h('div', { class: 'mascot big' }, '🖌️'), h('h2', {}, '欢迎来到「出口成章」！'),
      h('p', {}, '我是墨墨，一支会说话的小毛笔。我会陪你积累好词好句、练习写作和说话，有一天让你也能出口成章、妙笔生花！')),
    name,
    h('p', {}, '选择你现在的阶段（家长可以随时在家长中心调整）：'),
    stageBtns,
    h('p', { class: 'small muted' }, '口语练习需要麦克风：第一次说话时，请在弹窗中点"允许"。')),
  [{ label: '开始吧！🚀', value: true, cls: 'primary big' }]);
  state.settings.stage = chosen;
  state.settings.kidName = name.value.trim();
  state.settings.onboarded = true;
  save();
  render();
}

// ---------------- 启动 ----------------
window.addEventListener('hashchange', render);
voicesReady();
render();
onboarding();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
