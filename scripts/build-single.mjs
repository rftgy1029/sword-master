// 게임 전체를 HTML 파일 하나로 묶는다: npm run build:single
// vite build --mode single 결과(dist-single/)의 JS·CSS를 index.html 안에 넣고,
// 실행 중에 읽는 public/ 파일(3D 모델·효과 이미지·PDF 글꼴)은 data URL 표로 함께 넣는다.
// 결과: standalone/sword-master.html (인터넷 없이 브라우저로 바로 열 수 있다)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist-single');
const output = join(root, 'standalone', 'sword-master.html');
const TYPES = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const dataUrl = (file) => `data:${TYPES[extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

// public/ 중 코드가 publicAsset()으로 읽는 폴더만 넣는다(라이선스 문서·manifest는 실행에 쓰지 않는다).
const assets = {};
for (const [folder, ext] of [['models', '.glb'], ['effects', '.png'], ['fonts', '.ttf']]) {
  for (const name of readdirSync(join(root, 'public', folder)).filter((n) => n.endsWith(ext)).sort()) {
    assets[`${folder}/${name}`] = dataUrl(join(root, 'public', folder, name));
  }
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const inlineScript = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const scripts = [...html.matchAll(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g)];
const styles = [...html.matchAll(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g)];
if (scripts.length !== 1) throw new Error(`앱 스크립트는 하나여야 합니다: ${scripts.length}개`);
for (const [tag, path] of styles) html = html.replace(tag, () => `<style>\n${readFileSync(join(dist, path), 'utf8')}\n</style>`);
const table = `<script>window.__SWORD_MASTER_ASSETS__=${JSON.stringify(assets)};</script>`;
const [tag, path] = scripts[0];
html = html.replace(tag, () => `${table}\n<script type="module">\n${inlineScript(readFileSync(join(dist, path), 'utf8'))}\n</script>`);
html = html.replace(/<link rel="icon" href="\.\/([^"]*favicon[^"]*\.svg)"/, (_, icon) =>
  `<link rel="icon" href="${dataUrl(join(icon.startsWith('assets/') ? dist : root, icon))}"`);

// 남은 외부 파일 참조가 있으면 한 파일로 열 수 없으므로 멈춘다.
const leftovers = [...new Set([...html.matchAll(/["'(]\.\/(?:assets|models|effects|fonts)\/[^"')]+/g)].map((m) => m[0].slice(1)))];
if (leftovers.length) throw new Error(`HTML 밖의 파일을 아직 참조합니다: ${leftovers.slice(0, 5).join(', ')}`);
if (readdirSync(join(dist, 'assets')).some((n) => n.endsWith('.js') && n !== path.slice(7))) throw new Error('분리된 JS 조각이 남아 있습니다.');

mkdirSync(join(root, 'standalone'), { recursive: true });
writeFileSync(output, html);
console.log(`standalone/sword-master.html · ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB · public 파일 ${Object.keys(assets).length}개 포함`);
