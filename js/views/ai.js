// 🤖 AI 小老师（可选）：批改作文、点评口头表达、辩论陪练。基于 Anthropic Claude。
// 家长在家长中心填入自己的 API Key；Key 只保存在本机浏览器，只发送给 Anthropic API。
import { h, btn, note, toast, pick } from '../ui.js';
import { speak, recognize, hasASR, stopSpeaking } from '../speech.js';
import { state, addXP, markUsed } from '../state.js';
import { stageOf } from '../data/stages.js';
import { hanCount } from '../score.js';
import { menuGrid } from './common.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.137.0/+esm';
// 支持服务器端拒答回退（server-side fallback）的模型
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];

let sdk = null;
async function client() {
  if (!sdk) sdk = (await import(SDK_URL)).default;
  return { Anthropic: sdk, api: new sdk({ apiKey: state.settings.apiKey, dangerouslyAllowBrowser: true }) };
}

export const aiAvailable = () => !!state.settings.apiKey;

function who() {
  const st = stageOf(state.settings.stage);
  return `孩子目前处于"${st.name}"阶段（${st.grade}）。这个阶段的目标：${st.goal}`;
}

const BASE = `你是"墨墨"，一位温暖、专业的中文表达老师，陪伴中国孩子提升写作和口语表达能力，目标是让孩子"出口成章"。
原则：
- 先肯定，再建议；建议要具体、可操作，并且只挑最重要的一两点，不要一次指出太多问题。
- 绝不替孩子重写全文，也不代写。示范时最多改写一两句，让孩子看到"可以怎么改"，再由孩子自己动手。
- 语言亲切、简洁，适合孩子阅读，不用 Markdown 标题、表格或加粗符号，用普通段落和"1. 2."这样的编号即可。
- 内容积极健康；不询问孩子的真实姓名、学校、住址等个人信息。`;

async function ask(system, messages, maxTokens = 4000) {
  const { Anthropic, api } = await client();
  const model = state.settings.model || 'claude-opus-5-5';
  const params = { model, max_tokens: maxTokens, system, messages, output_config: { effort: 'medium' } };
  try {
    const resp = FALLBACK_MODELS.includes(model)
      ? await api.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await api.messages.create(params);
    if (resp.stop_reason === 'refusal') return { text: '这个内容墨墨不方便点评，我们换一篇试试吧。' };
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { text, content: resp.content };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'API Key 无效，请爸爸妈妈在"家长中心"检查。' };
    if (e instanceof Anthropic.PermissionDeniedError) return { error: '这个 API Key 没有权限使用所选模型。' };
    if (e instanceof Anthropic.NotFoundError) return { error: '找不到所选模型，请在家长中心换一个模型。' };
    if (e instanceof Anthropic.RateLimitError) return { error: '请求太频繁或额度用完了，稍后再试。' };
    if (e instanceof Anthropic.APIConnectionError) return { error: '连不上 Claude 服务器，请检查网络（需要能访问 api.anthropic.com）。' };
    if (e instanceof Anthropic.APIError) return { error: `服务出错（${e.status}）：${e.message}` };
    return { error: '出错了：' + (e?.message || e) };
  }
}

export function reviewWriting(text, title) {
  const system = `${BASE}\n${who()}\n\n现在请批改孩子的一篇习作。按下面的格式回复：
亮点：说出两个具体的亮点（引用孩子的原句）。
可以更好：只提一处最值得改的地方，说明为什么，并示范怎么改这一句。
好词推荐：推荐两三个适合这篇文章、孩子这个阶段能用上的好词或成语。
墨墨想问你：提一个能启发孩子把文章写得更具体、更深入的问题。
最后给一句鼓励。总长度控制在 300 字以内。`;
  return ask(system, [{ role: 'user', content: `题目：${title}\n\n${text}` }]);
}

export function reviewSpeech(text, topic, f) {
  const system = `${BASE}\n${who()}\n\n现在请点评孩子的一段口头表达（由语音识别转成文字，可能有个别错字或缺标点，请忽略这些识别误差）。
统计数据：${f.chars} 字，语速约 ${f.cpm} 字/分钟，口头禅 ${f.fillers} 次，用到的成语：${f.idioms.join('、') || '无'}。
按下面的格式回复：
说得好的地方：两点，具体。
结构：用一句话说说条理是否清楚，可以怎样用"第一、第二、最后"或"观点-理由-例子"让它更清楚。
升级一句：挑孩子说的一句话，示范一个更有表现力的说法。
下次试试：一个具体的小目标。
总长度控制在 250 字以内。`;
  return ask(system, [{ role: 'user', content: `话题：${topic}\n\n孩子说的话：${text}` }]);
}

// ---------- 页面 ----------
export function page(root, nav, params = {}) {
  nav.title('🤖 AI 小老师');
  if (!aiAvailable()) {
    root.replaceChildren(h('div', { class: 'panel' },
      h('h3', {}, '需要家长先设置'),
      h('p', {}, 'AI 小老师使用 Anthropic 的 Claude 模型，可以批改作文、点评演讲、陪你练辩论。'),
      h('p', {}, '请爸爸妈妈到"家长中心 → AI 小老师"填写自己的 Anthropic API Key。Key 只保存在这台设备上，只会发送给 Anthropic。'),
      btn('👨‍👩‍👧 去家长中心', () => nav.go('parent'), 'primary')));
    return;
  }
  if (params.m === 'essay') return essayPage(root, nav);
  if (params.m === 'debate') return debatePage(root, nav);
  root.replaceChildren(
    h('p', { class: 'intro' }, note('墨墨会先夸你，再给你一两条最重要的建议——但不会替你写。改不改、怎么改，由你自己决定！')),
    menuGrid([
      { icon: '📝', title: '作文批改', sub: '亮点 + 一处修改', onClick: () => nav.go('ai', { m: 'essay' }) },
      { icon: '⚔️', title: '辩论陪练', sub: '墨墨站在你的对立面', onClick: () => nav.go('ai', { m: 'debate' }) },
      { icon: '🎤', title: '演讲点评', sub: '在口才训练营说完后点评', onClick: () => nav.go('speaking', { m: 'speech' }) },
    ]));
}

function essayPage(root, nav) {
  const title = h('input', { class: 'wide-input', placeholder: '题目' });
  const ta = h('textarea', { class: 'editor', rows: 10, placeholder: '把作文粘贴或写在这里…' });
  const out = h('div');
  const recent = state.works.slice(-5).reverse();
  root.replaceChildren(h('div', { class: 'activity left' },
    recent.length ? h('div', { class: 'row wrap' }, note('从作品集选：', 'small'), recent.map((w) => btn(w.title, () => { title.value = w.title; ta.value = w.text; }, 'chip'))) : null,
    title, ta,
    h('div', { class: 'row end' }, btn('🤖 请墨墨批改', async (e) => {
      if (hanCount(ta.value) < 20) return toast('至少写 20 个字哦');
      e.target.disabled = true;
      e.target.textContent = '🤖 正在认真读…';
      const r = await reviewWriting(ta.value.trim(), title.value.trim() || '无题');
      e.target.disabled = false;
      e.target.textContent = '🤖 再批改一次';
      if (r.error) return out.replaceChildren(h('p', { class: 'warn' }, r.error));
      markUsed(ta.value);
      addXP(10, 'ai');
      out.replaceChildren(h('div', { class: 'tip-card ai-fb' }, h('div', { class: 'tip-title' }, '🤖 墨墨的批改'), r.text.split('\n').filter(Boolean).map((l) => h('p', {}, l))));
    }, 'primary')),
    out));
}

const DEBATE_TOPICS = ['小学生应该每天写日记吗？', '考试成绩能代表学习能力吗？', '养宠物利大于弊吗？', '网络让人更亲近还是更疏远？', '读纸质书比读电子书更好吗？', '人工智能会让学生变懒吗？', '班干部应该轮流当吗？', '假期应该多上兴趣班还是多玩？'];

function debatePage(root, nav) {
  let topic = pick(DEBATE_TOPICS);
  let side = '';
  const msgs = [];
  let turns = 0;
  const chat = h('div', { class: 'chat' });
  const panel = h('div');
  const bubble = (who, text) => {
    chat.append(h('div', { class: 'bubble ' + who }, h('div', { class: 'bubble-text' }, text)));
    chat.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };
  const system = () => `${BASE}\n${who()}\n\n你在陪孩子练习辩论。辩题："${topic}"。孩子的立场是"${side}"，你持相反立场。
规则：
- 每次回复先用一句话回应孩子的论点（承认其中合理的部分），再提出你的一个反驳或新论据，最后抛出一个问题让孩子回应。总共不超过 80 字。
- 论据要讲道理、举例子，示范好的辩论方式；不要人身攻击，不要说"你错了"。
- 如果孩子的发言有明显的逻辑漏洞（以偏概全、偷换概念等），在最后单独加一行："教练提示：……"，用一句话温和指出，并提示怎么补强。否则不要加这一行。
- 回复是要朗读出来的，只用纯文本。`;

  function setup() {
    root.replaceChildren(h('div', { class: 'activity' },
      h('h2', {}, '⚔️ 辩论陪练'),
      h('div', { class: 'say-card' }, h('div', { class: 'muted small' }, '辩题'), h('div', { class: 'say-text' }, topic), btn('🔀 换一个', () => { topic = pick(DEBATE_TOPICS.filter((t) => t !== topic)); setup(); }, 'chip')),
      h('p', { class: 'center' }, '你选哪一方？'),
      h('div', { class: 'row center' }, btn('👍 正方：是/应该', () => start('正方（支持）'), 'primary'), btn('👎 反方：不是/不应该', () => start('反方（反对）'), 'soft'))));
  }
  function start(s) {
    side = s;
    root.replaceChildren(h('div', { class: 'activity' }, h('div', { class: 'tip-card' }, `辩题：${topic}　你是${side}`), chat, panel));
    bubble('bot', `好，我站在对立面！你先说说你的观点和理由吧。（提示：观点 + 理由 + 例子）`);
    kidTurn();
  }
  function kidTurn() {
    const input = h('textarea', { class: 'dict-input', rows: 2, placeholder: '写下你的论点…' });
    const send = async () => {
      const text = input.value.trim();
      if (hanCount(text) < 4) return toast('多说一点理由吧');
      stopSpeaking();
      bubble('me', text);
      msgs.push({ role: 'user', content: text });
      markUsed(text);
      panel.replaceChildren(h('p', { class: 'muted center' }, '墨墨在思考…'));
      const r = await ask(system(), msgs, 2000);
      if (r.error) {
        msgs.pop();
        panel.replaceChildren(h('p', { class: 'warn' }, r.error));
        return setTimeout(kidTurn, 1500);
      }
      msgs.push({ role: 'assistant', content: r.content });
      turns++;
      const [main, coach] = r.text.split(/\n?教练提示[:：]/);
      bubble('bot', main.trim());
      if (coach) chat.append(h('div', { class: 'explain bad small' }, '🧑‍🏫 教练提示：', coach.trim()));
      speak(main.trim(), { voice: 'male' });
      addXP(5, 'ai');
      if (turns >= 6) {
        panel.replaceChildren(h('div', { class: 'panel center' }, h('p', {}, '辩了 6 个回合，太精彩了！试着用一句话总结你的立场吧。'), btn('结束 ✓', () => nav.go('ai'), 'primary')));
      } else kidTurn();
    };
    const mic = hasASR ? btn('🎤 说出来', async () => {
      mic.disabled = true;
      mic.classList.add('listening');
      const { alts } = await recognize({ timeout: 20000 });
      mic.disabled = false;
      mic.classList.remove('listening');
      if (alts[0]) input.value = alts[0];
    }, 'soft') : null;
    panel.replaceChildren(h('div', { class: 'reply-panel' }, input, h('div', { class: 'row end' }, mic, btn('发送 ➜', send, 'primary'))));
  }
  setup();
}
