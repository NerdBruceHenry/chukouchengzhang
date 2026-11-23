// 📒 我的素材本：积累 → 运用。词语被自己用出来 2 次以上才算"掌握"。
import { h, btn, note, modal, toast } from '../ui.js';
import { speak } from '../speech.js';
import { state, addMaterial, removeMaterial } from '../state.js';

const KINDS = [
  { k: 'all', name: '全部' },
  { k: 'word', name: '好词' },
  { k: 'idiom', name: '成语' },
  { k: 'sentence', name: '好句' },
  { k: 'poem', name: '诗句' },
  { k: 'mine', name: '我的句子' },
];

export function page(root, nav) {
  nav.title('📒 我的素材本');
  let kind = 'all';
  const box = h('div');
  const input = h('input', { class: 'wide-input', placeholder: '读书时看到的好词好句，记在这里…' });
  const isWord = (m) => m.kind === 'word' || m.kind === 'idiom';
  function render() {
    const list = state.material.filter((m) => kind === 'all' || m.kind === kind).slice().reverse();
    const words = state.material.filter(isWord);
    const mastered = words.filter((m) => (state.used[m.text] || 0) >= 2).length;
    box.replaceChildren(
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(state.material.length)), h('div', { class: 'small' }, '条素材')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(words.filter((m) => state.used[m.text]).length)), h('div', { class: 'small' }, '个词用出来过')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(mastered)), h('div', { class: 'small' }, '个已掌握'))),
      h('div', { class: 'row wrap center' }, KINDS.map((x) => btn(x.name, () => { kind = x.k; render(); }, 'chip' + (x.k === kind ? ' on' : '')))),
      list.length ? h('div', { class: 'list' }, list.map((m) => {
        const used = state.used[m.text] || 0;
        return h('div', { class: 'mat-item' },
          h('div', { class: 'mat-text', onclick: () => speak(m.text) }, m.text),
          m.note ? h('div', { class: 'muted small' }, m.note) : null,
          h('div', { class: 'row' },
            isWord(m) ? h('span', { class: 'small ' + (used >= 2 ? 'ok-text' : 'muted') }, used >= 2 ? `✅ 已掌握（用出 ${used} 次）` : used ? `用出 ${used} 次，再用一次就掌握！` : '还没用过，写作/说话时试试') : null,
            h('span', { class: 'grow' }),
            btn('🔊', () => speak(m.text), 'chip tiny'),
            btn('🗑️', async () => {
              const ok = await modal(h('p', {}, `从素材本删除"${m.text.slice(0, 20)}"？`), [{ label: '取消', value: false }, { label: '删除', value: true, cls: 'danger' }]);
              if (ok) { removeMaterial(m.id); render(); }
            }, 'chip tiny')));
      })) : h('p', { class: 'empty' }, '这里还是空的。在词语工坊、诗词、阅读里点"☆ 收藏"，或者在上面自己记下来。'));
  }
  root.replaceChildren(
    h('p', { class: 'intro' }, note('积累不是目的，用出来才是本事！写作和说话时用上这里的词，墨墨会自动记一次"用出来"，用两次就算真正掌握了。')),
    h('div', { class: 'row' }, input, btn('记下', () => {
      const t = input.value.trim();
      if (!t) return;
      const k = /[，。！？；]/.test(t) || t.length > 8 ? 'sentence' : t.length === 4 ? 'idiom' : 'word';
      if (addMaterial(k, t, '自己摘抄')) toast('记下啦 📒');
      input.value = '';
      render();
    }, 'primary')),
    box);
  render();
}
