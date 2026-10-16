// Render each text overlay in overlays.html to a transparent 1080x1920 PNG.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const ids = ['t1', 't2', 'legend', 't3', 't4a', 't4b', 't5', 't6'];
fs.mkdirSync(path.join(root, 'overlays'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(path.join(root, 'overlays.html')).href);
await page.evaluate(() => document.fonts.ready);
for (const id of ids) {
  await page.evaluate(id => document.querySelectorAll('.ov').forEach(e => e.classList.toggle('on', e.id === id)), id);
  await page.screenshot({ path: path.join(root, 'overlays', `${id}.png`), omitBackground: true });
}
await browser.close();
console.log('overlays:', ids.join(', '));
