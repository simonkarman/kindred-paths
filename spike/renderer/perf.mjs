// Phase 0.5 — performance decomposition.
// Boots ONE warm CardConjurer, then times each render operation with DIRECT draw calls
// (drawText/drawCard/autoFrame), bypassing CC's built-in 500ms debounce, no reload, no sleeps.
// Goal: separate CardConjurer's intrinsic draw cost from the removable scaffolding, and show
// the real interactive-edit ceiling. Not a go/no-go gate — we're committed to this renderer.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { startServer } from './serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const require = createRequire(join(REPO, 'server', 'package.json'));
const { chromium } = require('playwright');
const PORT = Number(process.env.PORT) || 4199;
const N = Number(process.env.N) || 15;

const SPECS = {
  vanilla: {
    name: 'Perf Vanilla', manaCost: '{2}{G}', typeLine: 'Creature — Elf Ranger',
    rules: 'Vigilance', pt: '3/3',
  },
  denseRules: {
    name: 'Perf Archmage', manaCost: '{2}{W}{U}', typeLine: 'Creature — Human Wizard',
    rules: 'Flying, vigilance, lifelink\nWhen Perf Archmage enters the battlefield, draw two cards, then discard a card.\n{2}{W}{U}, {T}: Tap target creature. Its controller loses 2 life and you gain 2 life. Activate only as a sorcery.',
    pt: '3/4',
  },
};

async function main() {
  const server = await startServer(PORT);
  const browser = await chromium.launch({ headless: true });
  const results = {};
  let bootMs = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1500 } });
    page.on('pageerror', () => {}); // CC logs a benign 'type' error during driving

    // --- warm boot (once) ---
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      window.cardCanvas && window.cardCanvas.width > 0 &&
      document.querySelector('#text-editor') && document.querySelector('#autoFrame') &&
      typeof window.drawText === 'function' && typeof window.autoFrame === 'function' &&
      window.card && window.card.text && window.card.text.type && window.card.text.rules);
    await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
    bootMs = Date.now() - t0;
    console.log('[perf] card.text keys:', await page.evaluate(() => Object.keys(window.card.text)));

    // Inject measurement helpers into the warm page.
    await page.evaluate(() => {
      window.__median = (arr) => { arr = arr.slice().sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; };
      window.__settle = (maxMs, stableFor) => new Promise((res) => {
        let last = '', since = 0; const start = performance.now();
        const tick = () => {
          let out; try { out = window.cardCanvas.toDataURL('image/png'); } catch (e) { out = String(Math.random()); }
          const now = performance.now();
          if (out === last) { if (now - since >= stableFor) return res(now - start); }
          else { last = out; since = now; }
          if (now - start > maxMs) return res(now - start);
          setTimeout(tick, 40);
        };
        tick();
      });
      window.__setText = (key, val) => { if (window.card.text[key]) window.card.text[key].text = val; };
      window.__setup = async (spec) => {
        document.querySelector('#autoFrame').value = 'M15RegularNew';
        window.__setText('mana', spec.manaCost || '');
        window.__setText('title', spec.name || '');
        window.__setText('type', spec.typeLine || '');
        window.__setText('rules', spec.rules || '');
        window.__setText('pt', spec.pt || '');
        clearTimeout(window.autoFrameTimer);
        window.autoFrame();
        await window.__settle(4000, 300);
        await window.drawText();
        await window.__settle(4000, 300);
        // warm up fonts + symbol image caches before timing
        try { await document.fonts.ready; } catch (e) {}
        for (let i = 0; i < 3; i++) { await window.drawText(); window.drawCard(); window.cardCanvas.toDataURL('image/png'); }
      };
      window.__measure = async (n) => {
        const med = window.__median, R = {};
        const timeSync = (fn) => { const ts = []; for (let i = 0; i < n; i++) { const t = performance.now(); fn(i); ts.push(performance.now() - t); } return med(ts); };
        const timeAsync = async (fn) => { const ts = []; for (let i = 0; i < n; i++) { const t = performance.now(); await fn(i); ts.push(performance.now() - t); } return med(ts); };

        R.drawCard = timeSync(() => window.drawCard());
        R.drawText = await timeAsync(async () => { await window.drawText(); });

        const base = window.card.text.rules.text;
        R.textEdit = await timeAsync(async (i) => { window.card.text.rules.text = base + ' \u200b'.repeat(i % 3) + i; await window.drawText(); });
        window.card.text.rules.text = base; await window.drawText();

        R.pngEncode = timeSync(() => window.cardCanvas.toDataURL('image/png'));
        R.jpegEncode = timeSync(() => window.cardCanvas.toDataURL('image/jpeg', 0.8));
        R.imageBitmap = await timeAsync(async () => { const bm = await createImageBitmap(window.cardCanvas); bm.close && bm.close(); });
        return R;
      };
      // Frame-affecting change: flip a color so autoFrame rebuilds frames; time to settle (warm).
      window.__measureFrameChange = async () => {
        const base = window.card.text.mana.text;
        const run = async (mana) => {
          window.card.text.mana.text = mana;
          const t = performance.now(); clearTimeout(window.autoFrameTimer); window.autoFrame();
          await window.__settle(5000, 250); return performance.now() - t;
        };
        await run('{2}{R}'); await run(base);        // warm both frames (image cache)
        const swap = await run('{2}{R}');            // measured, warm
        await run(base);
        return swap;
      };
    });

    for (const [label, spec] of Object.entries(SPECS)) {
      await page.evaluate((s) => window.__setup(s), spec);
      // sanity image so we can eyeball fonts/layout
      const dataUrl = await page.evaluate(() => window.cardCanvas.toDataURL('image/png'));
      writeFileSync(join(HERE, `out-perf-${label}.png`), Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      const r = await page.evaluate((n) => window.__measure(n), N);
      r.frameChange = await page.evaluate(() => window.__measureFrameChange());
      results[label] = r;
    }
  } catch (e) {
    console.error('[perf] ERROR:', e);
  } finally {
    await browser.close();
    server.close();
  }

  // --- report ---
  const specs = Object.keys(results);
  const rows = [
    ['drawCard() composite', 'drawCard'],
    ['drawText() relayout+draw', 'drawText'],
    ['text edit -> canvas (interactive)', 'textEdit'],
    ['frame change (autoFrame settle)', 'frameChange'],
    ['toDataURL png encode', 'pngEncode'],
    ['toDataURL jpeg encode', 'jpegEncode'],
    ['createImageBitmap (preview blit)', 'imageBitmap'],
  ];
  const fmt = (v) => (v == null ? '—' : v.toFixed(1) + 'ms');
  const pad = (s, w) => String(s).padEnd(w);
  const w0 = 36, w = 14;
  let out = `# Phase 0.5 — performance decomposition\n\n`;
  out += `Warm CardConjurer boot (once): **${bootMs}ms**. Median of ${N} iterations, headless Chromium, `;
  out += `direct draw calls (no debounce, no reload). Canvas ${'2010x2814'}.\n\n`;
  let header = pad('operation (median)', w0) + specs.map((s) => pad(s, w)).join('');
  let line = '-'.repeat(w0) + specs.map(() => '-'.repeat(w)).join('');
  console.log(`\n[perf] warm boot: ${bootMs}ms  (N=${N})\n`);
  console.log(header); console.log(line);
  out += '```\n' + header + '\n' + line + '\n';
  for (const [labelText, key] of rows) {
    const r = pad(labelText, w0) + specs.map((s) => pad(fmt(results[s]?.[key]), w)).join('');
    console.log(r); out += r + '\n';
  }
  out += '```\n';
  writeFileSync(join(HERE, 'perf-results.md'), out);
  console.log(`\n[perf] wrote perf-results.md + out-perf-*.png`);
  process.exit(0);
}

main();
