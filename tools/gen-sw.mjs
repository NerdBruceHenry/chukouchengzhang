// 生成 sw.js 的缓存文件列表：node tools/gen-sw.mjs
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';
const join = posix.join;
import { createHash } from 'node:crypto';

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = ['index.html', 'manifest.webmanifest', 'icon.svg', ...walk('css'), ...walk('js'), ...(existsSync('audio/manifest.json') ? ['audio/manifest.json'] : [])].sort();
const hash = createHash('sha1');
files.forEach((f) => hash.update(readFileSync(f)));
const version = 'kcz-' + hash.digest('hex').slice(0, 10);
const tpl = readFileSync('tools/sw.template.js', 'utf8')
  .replace('__VERSION__', version)
  .replace('__FILES__', ['./', ...files.map((f) => './' + f)].map((f) => JSON.stringify(f)).join(',\n  '));
writeFileSync('sw.js', tpl);
console.log(`sw.js: ${files.length} files, ${version}`);
