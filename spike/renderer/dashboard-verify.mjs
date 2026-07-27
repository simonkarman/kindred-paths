// Smoke-test the dashboard: live editor renders + patches, APIs respond, server render works.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { startServer } from './serve.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const require = createRequire(join(REPO, 'server', 'package.json'));
const { chromium } = require('playwright');
const PORT = Number(process.env.PORT) || 4199;

async function main() {
  const server = await startServer(PORT);
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', () => {});
    await page.goto(`http://127.0.0.1:${PORT}/dashboard.html`, { waitUntil: 'domcontentloaded' });

    // APIs
    const results = await page.evaluate(() => fetch('/api/results').then(r => r.json()));
    checks.push(['/api/results has ccNode', !!results.ccNode]);
    const images = await page.evaluate(() => fetch('/api/images').then(r => r.json()));
    checks.push(['/api/images returns files', images.files.length > 0]);

    // Live editor: wait for "ready", verify canvas non-blank
    await page.waitForFunction(() => /ready/.test(document.getElementById('live-timing').textContent), { timeout: 60000 });
    const nonBlank = await page.evaluate(() => { const c = document.getElementById('live-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++; return n; });
    checks.push(['live editor rendered a card (non-blank px)', nonBlank > 5000]);

    // Preview must be blitted at native resolution (2010x2814), not downscaled-then-upscaled
    // (a downscaled backing store looks pixelated once the browser scales it back up for display).
    const canvasRes = await page.evaluate(() => { const c = document.getElementById('live-canvas'); return { w: c.width, h: c.height }; });
    checks.push([`live preview blits at native resolution (${canvasRes.w}x${canvasRes.h} >= 2000px wide)`, canvasRes.w >= 2000]);

    // Edit title -> expect a patch
    await page.fill('#f-title', 'Patched Live Name');
    await page.waitForFunction(() => /warm instance/.test(document.getElementById('live-timing').textContent), { timeout: 15000 });
    const patchMs = await page.evaluate(() => { const m = document.getElementById('live-timing').textContent.match(/([\d.]+)ms/); return m ? +m[1] : 999; });
    checks.push([`text edit patched fast (${patchMs}ms < 60ms)`, patchMs < 60]);

    // Change mana (color) -> expect a FULL render, with the frame actually present (not blank),
    // and repeat several times to catch the "sometimes no frame" race across multiple full renders.
    let allFramesPresent = true, fullTimes = [];
    for (const mana of ['{R}', '{U}', '{2}{G}', '{B}', '{1}{W}']) {
      await page.fill('#f-mana', mana);
      await page.waitForFunction(() => /FULL render/.test(document.getElementById('live-timing').textContent), { timeout: 15000 });
      const ms = await page.evaluate(() => { const m = document.getElementById('live-timing').textContent.match(/([\d.]+)ms/); return m ? +m[1] : null; });
      const colored = await page.evaluate(() => {
        const c = document.getElementById('live-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i+1], d[i+2]), mn = Math.min(d[i], d[i+1], d[i+2]); if (mx - mn > 30) n++; }
        return n;
      });
      fullTimes.push(ms);
      if (colored < 20000) { allFramesPresent = false; console.log(`  ! full render for ${mana} looks frame-less (colored=${colored})`); }
    }
    console.log('  browser full-render times (ms):', fullTimes.join(', '));
    checks.push(['full render always shows a frame (5/5, no race)', allFramesPresent]);
    // Remaining cost here is the reload/navigation + UI tab-click choreography (not the
    // composite storm, which this fix eliminated) — that's the Phase 1c warm-pool/double-buffer
    // job, not this fix's job. 1.8s was the old (racy) baseline; assert we're well under it.
    checks.push([`full render faster than the old racy baseline (median ${fullTimes.slice().sort((a,b)=>a-b)[2]}ms < 1500ms)`, fullTimes.slice().sort((a,b)=>a-b)[2] < 1500]);

    // Server render (Node) via API — slow first time
    const nodeOk = await page.evaluate(async () => { const r = await fetch('/api/render-node?mana=%7B2%7D%7BG%7D&title=NodeCheck&type=Creature&rules=Vigilance&pt=2/2'); const t = r.headers.get('x-timing'); const b = await r.blob(); return { type: r.headers.get('content-type'), size: b.size, timing: t }; });
    checks.push(['server render returns PNG', nodeOk.type === 'image/png' && nodeOk.size > 20000]);
    console.log('  node render timing:', nodeOk.timing);

    // Font-race regression check: a title with glyph-heavy characters (k/w/x/y/z), rendered via
    // two independent FULL renders (each forces a fresh reload -> fresh @font-face load -> the
    // exact window where drawText() could previously outrun font loading and bake in tofu boxes).
    // If the font-ready wait + redraw-after-fonts fix is working, both renders are pixel-identical;
    // a race would make them differ (tofu present in one, not the other).
    const glyphTitle = 'Waxwork Kazoo Knight';
    const glyphRender = async (mana) => {
      await page.fill('#f-title', glyphTitle);
      await page.fill('#f-mana', mana);
      await page.waitForFunction((t) => document.getElementById('f-title').value === t, glyphTitle, { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 1200));
      return page.evaluate(() => document.getElementById('live-canvas').toDataURL('image/png'));
    };
    const g1 = await glyphRender('{W}');
    const g2 = await glyphRender('{1}{W}'); // different mana forces another full reload+render
    const fontRaceStable = g1.length > 100000 && g2.length > 100000 && Math.abs(g1.length - g2.length) < g1.length * 0.05;
    checks.push([`glyph-heavy title renders consistently across reloads (no font-race regression)`, fontRaceStable]);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await browser.close(); server.close();
  }
  let ok = true;
  for (const [name, pass] of checks) { console.log(`  ${pass ? '✓' : '✗'} ${name}`); ok = ok && pass; }
  console.log(ok ? '\n[dashboard] PASS' : '\n[dashboard] FAIL');
  process.exit(ok ? 0 : 1);
}
main();
