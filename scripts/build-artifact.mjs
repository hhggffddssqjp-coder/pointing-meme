// 把 dist/ 轉成可以發布成 Claude Artifact 的版本，輸出到 dist-artifact/
// - CSS、JS 直接內嵌進頁面（Artifact 只允許少數 CDN 的外部腳本）
// - 拿掉 <!doctype>、<html>、<head>、<body>（發布時會自動包上）
// - templates.json 只留下圖片確實存在的底圖
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const OUT = 'dist-artifact';

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

const inlined = html
  .replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) => {
    return `<style>\n${readFileSync(join(DIST, file), 'utf8')}\n</style>`;
  })
  .replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) => {
    const js = readFileSync(join(DIST, file), 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script type="module">\n${js}\n</script>`;
  });

if (/src="\.\/assets\/|href="\.\/assets\//.test(inlined)) {
  throw new Error('還有沒內嵌到的 assets 檔案，請檢查 dist/index.html 的格式');
}

const head = inlined.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
const body = inlined.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
const title = head.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>互指梗圖產生器</title>';
const restOfHead = head
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'templates'), { recursive: true });
writeFileSync(join(OUT, 'index.html'), `${title}\n${restOfHead.trim()}\n${body.trim()}\n`);

const config = JSON.parse(readFileSync(join(DIST, 'templates', 'templates.json'), 'utf8'));
const kept = [];
const missing = [];
for (const t of config.templates) {
  const src = join(DIST, 'templates', t.file);
  if (existsSync(src)) {
    copyFileSync(src, join(OUT, 'templates', t.file));
    kept.push(t);
  } else {
    missing.push(t.file);
  }
}
writeFileSync(join(OUT, 'templates', 'templates.json'), JSON.stringify({ templates: kept }, null, 2) + '\n');

console.log(`dist-artifact/ 完成：${kept.length} 張底圖（${kept.map((t) => t.file).join('、')}）`);
if (missing.length) console.log(`略過沒有圖片的底圖：${missing.join('、')}`);
