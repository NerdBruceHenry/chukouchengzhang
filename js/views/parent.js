// 👨‍👩‍👧 家长中心（乘法题验证）
import { h, btn, note, toast, modal } from '../ui.js';
import { chineseVoices, voicesReady, speak, listRecordings, deleteRecording, playBlob, hasASR, hasRecorder } from '../speech.js';
import { state, save, exportData, importData, srsStats, streak } from '../state.js';
import { STAGES } from '../data/stages.js';
import { actTotals } from './growth.js';

let unlocked = false;

export function page(root, nav) {
  nav.title('👨‍👩‍👧 家长中心');
  if (!unlocked) return gate(root, nav);
  const s = state.settings;
  const set = (k, v) => { s[k] = v; save(); };
  const field = (label, control, hint) => h('div', { class: 'field' }, h('div', { class: 'field-label' }, label), control, hint ? h('div', { class: 'muted small' }, hint) : null);

  const stageSel = h('select', { onchange: (e) => set('stage', Number(e.target.value)) }, STAGES.map((x) => h('option', { value: x.n, selected: x.n === s.stage }, `${x.icon} ${x.name}（${x.grade}）`)));
  const goal = h('select', { onchange: (e) => set('dailyGoal', Number(e.target.value)) }, [10, 15, 20, 30, 45].map((m) => h('option', { value: m, selected: m === s.dailyGoal }, `${m} 分钟`)));
  const rate = h('input', { type: 'range', min: '0.7', max: '1.3', step: '0.05', value: s.rate, oninput: (e) => set('rate', Number(e.target.value)) });
  const voiceSel = h('select', { onchange: (e) => set('voiceURI', e.target.value) }, h('option', {}, '加载中…'));
  voicesReady().then(() => {
    const vs = chineseVoices();
    voiceSel.replaceChildren(...vs.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, `${v.name}${v.localService ? '' : '（在线）'}`)));
    if (!vs.length) voiceSel.replaceChildren(h('option', {}, '未找到中文语音'));
  });
  const key = h('input', { type: 'password', class: 'wide-input', value: s.apiKey, placeholder: 'sk-ant-…', autocomplete: 'off', onchange: (e) => set('apiKey', e.target.value.trim()) });
  const model = h('select', { onchange: (e) => set('model', e.target.value) }, [['claude-opus-5-5', 'Claude Opus 5.5（推荐，批改最细致）'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5（更快更省）']].map(([v, n]) => h('option', { value: v, selected: v === s.model }, n)));

  const t = actTotals();
  const st = srsStats();
  const chars = state.works.reduce((a, w) => a + (w.chars || 0), 0);
  const days = Object.values(state.days);
  const mins = Math.round(days.reduce((a, d) => a + d.sec, 0) / 60);
  const recBox = h('div', {}, note('加载中…', 'small'));
  listRecordings().then((list) => {
    recBox.replaceChildren(list.length ? list.slice(0, 20).map((r) => h('div', { class: 'rec-row' },
      h('div', { class: 'grow' }, h('b', {}, r.title || '录音'), h('div', { class: 'muted small' }, `${new Date(r.at).toLocaleString('zh-CN')} · ${r.sec || '?'} 秒${r.chars ? ` · ${r.chars} 字 · ${r.cpm} 字/分` : ''}`), r.text ? h('div', { class: 'small' }, r.text.slice(0, 60) + (r.text.length > 60 ? '…' : '')) : null),
      btn('▶', () => playBlob(r.blob), 'chip'),
      btn('🗑️', async () => { await deleteRecording(r.id); page(root, nav); }, 'chip'))) : note('还没有录音。孩子在口才训练营说话时会自动保存（最多 40 条）。', 'small'));
  });

  root.replaceChildren(
    h('div', { class: 'panel' }, h('h3', {}, '📊 学习概况'),
      h('div', { class: 'stat-row' },
        stat(mins, '累计分钟'), stat(streak(), '连续天数'), stat(Object.values(state.days).filter((d) => d.quest).length, '完成任务天数'), stat(state.xp, '经验')),
      h('div', { class: 'stat-row' },
        stat(chars, '写作字数'), stat(state.talks.length, '口头表达'), stat(state.material.length, '素材'), stat(`${st.mastered}/${st.total}`, '牢记/复习卡')),
      h('p', { class: 'small' }, `各模块练习次数：词语 ${t.word || 0} · 诗词 ${t.poem || 0} · 造句 ${t.sentence || 0} · 阅读 ${t.reading || 0} · 写作 ${t.write || 0} · 口才 ${t.speak || 0} · 沟通 ${t.talk || 0}`),
      btn('📈 查看成长档案', () => nav.go('growth'), 'soft small')),
    h('div', { class: 'panel' }, h('h3', {}, '⚙️ 设置'),
      field('成长阶段', stageSel, '决定各模块默认出现的内容难度；孩子仍可以在各模块里选择其他阶段。'),
      field('每日目标', goal),
      field('朗读语速', rate, '1 为自然语速；初学可调慢。'),
      field('备用朗读声音', h('div', { class: 'row' }, voiceSel, btn('试听', () => speak('你好，我是墨墨，我们一起练习表达吧！', { tts: true }), 'chip')), '课程内容优先播放预先生成的自然普通话音频；这里的声音只在没有预录音频时使用（例如 AI 小老师的回复）。')),
    h('div', { class: 'panel' }, h('h3', {}, '🤖 AI 小老师（可选）'),
      h('p', { class: 'small' }, '填写你自己的 Anthropic API Key 后，孩子可以请 AI 批改作文、点评演讲、练习辩论。AI 只给亮点和一两条建议，不会代写。'),
      field('API Key', key, 'Key 只保存在这台设备的浏览器里，只会发送给 Anthropic（api.anthropic.com），不会发给任何其他地方。在共用设备上请谨慎填写。'),
      field('模型', model),
      s.apiKey ? btn('清除 API Key', () => { set('apiKey', ''); key.value = ''; toast('已清除'); }, 'chip') : null),
    h('div', { class: 'panel' }, h('h3', {}, '🎧 孩子的录音'), recBox),
    h('div', { class: 'panel' }, h('h3', {}, '💾 数据备份'),
      note('所有进度只保存在这台设备的浏览器里。换设备或清理浏览器前，请先导出备份。', 'small'),
      h('div', { class: 'row wrap' },
        btn('⬇️ 导出备份', () => {
          const blob = new Blob([exportData()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `出口成章备份_${new Date().toISOString().slice(0, 10)}.json` });
          document.body.append(a);
          a.click();
          a.remove();
        }, 'soft'),
        btn('⬆️ 导入备份', () => {
          const inp = h('input', { type: 'file', accept: 'application/json' });
          inp.onchange = async () => {
            const f = inp.files[0];
            if (!f) return;
            const ok = await modal(h('p', {}, '导入会覆盖当前设备上的全部进度，确定吗？'), [{ label: '取消', value: false }, { label: '覆盖导入', value: true, cls: 'danger' }]);
            if (!ok) return;
            try { importData(await f.text()); toast('导入成功'); location.reload(); } catch { toast('文件格式不对'); }
          };
          inp.click();
        }, 'soft'))),
    h('div', { class: 'panel' }, h('h3', {}, '💡 给家长的建议'),
      h('ol', { class: 'small' },
        h('li', {}, '每天 15 分钟、固定时间，比周末突击两小时有效。'),
        h('li', {}, '多听孩子说：吃饭时请孩子讲讲今天的"即兴说"话题或读到的故事，认真听、多追问"然后呢？为什么？"。'),
        h('li', {}, '夸具体的地方："你用了"迫不及待"，特别准！"比"写得真好"有用得多。'),
        h('li', {}, '改作文一次只改一处，让孩子自己动手改，别替他重写。'),
        h('li', {}, '家长自己也读书、也表达：孩子是看着你说话长大的。')),
      h('p', { class: 'muted small' }, `设备支持：语音识别 ${hasASR ? '✅' : '❌（会改用录音自评）'}，录音 ${hasRecorder ? '✅' : '❌'}。推荐 iPad / iPhone 的 Safari，或电脑上的 Chrome、Edge。`)),
    h('div', { class: 'row center' }, btn('🔒 退出家长中心', () => { unlocked = false; nav.go('home'); }, 'soft')));
}

function stat(n, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'small' }, label));
}

function gate(root, nav) {
  const a = 6 + Math.floor(Math.random() * 7);
  const b = 6 + Math.floor(Math.random() * 7);
  const inp = h('input', { type: 'number', inputmode: 'numeric', class: 'wide-input', placeholder: '答案' });
  const go = () => {
    if (Number(inp.value) === a * b) { unlocked = true; page(root, nav); } else { toast('答案不对哦'); inp.value = ''; }
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.replaceChildren(h('div', { class: 'panel center' }, h('h3', {}, '请家长回答'), h('div', { class: 'say-text huge' }, `${a} × ${b} = ?`), inp, h('div', { class: 'row center' }, btn('进入', go, 'primary'))));
  inp.focus();
}
