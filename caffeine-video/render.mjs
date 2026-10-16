// Capture the scene frame-by-frame with headless Chromium and encode an MP4.
//   node render.mjs                      -> caffeine-trick.mp4 (with audio.wav if present)
//   node render.mjs --stills 2,5.8,14    -> PNG stills into ./frames for review
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const range = args.includes('--range') ? args[args.indexOf('--range') + 1].split(',').map(Number) : null;
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(root, 'caffeine-trick.mp4');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
// serve three.js from node_modules instead of the CDN
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', route => {
  const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
  route.fulfill({ path: path.join(root, 'node_modules/three', rel), contentType: 'text/javascript' });
});
await page.goto(`http://localhost:${port}/index.html?render=1`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const TOTAL = await page.evaluate(() => window.TOTAL);
const stage = await page.$('#stage');

if (stillsArg) {
  fs.mkdirSync(path.join(root, 'frames'), { recursive: true });
  for (const s of stillsArg.split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), s);
    await stage.screenshot({ path: path.join(root, 'frames', `still_${s.toFixed(2)}.png`) });
    console.log('still', s);
  }
} else {
  const [a, b] = range || [0, TOTAL];
  const n = Math.round((b - a) * FPS);
  const audio = path.join(root, 'audio.wav');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(fs.existsSync(audio) && !range ? ['-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.seek(t), a + i / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
server.close();
