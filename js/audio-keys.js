// app（js/speech.js）和生成脚本（tools/collect-texts.mjs）共用：句子 + 声音 → 预生成音频的文件名。

// Kokoro-82M-v1.1-zh 的声音（https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh，Apache-2.0）
export const VOICES = {
  main: 'zf_078', // 墨墨：知性、温和的女声，用于示范朗读
  female: 'zf_077', // 情境对话里的女性角色
  male: 'zm_010', // 情境对话里的男性角色
};

// 慢速音频的语速（1.0 = 自然语速）
export const SLOW_SPEED = 0.7;

const FEMALE = /^(妈妈|奶奶|外婆|姥姥|姐姐|妹妹|阿姨|女|王老师|李老师|班主任|小美|小雨|小婷|朵朵|琳琳|同桌小雨)/;
/** 情境对话角色用哪种声音 */
export function roleVoice(role = '') {
  return FEMALE.test(role) ? 'female' : 'male';
}

export function normText(text) {
  return String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** 32 位 FNV-1a（按 UTF-16 编码单元）→ 8 位十六进制 */
export function clipId(text) {
  let h = 0x811c9dc5;
  const s = normText(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
