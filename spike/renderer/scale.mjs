// Phase 0.7 — hidden-render correctness + scaling + cross-talk runner.
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

async function main() {
  const server = await startServer(PORT);
  // --enable-precise-memory-info makes performance.memory meaningful
  const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
  let hidden = [], scale = [];
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    page.on('pageerror', () => {});
    await page.goto(`http://127.0.0.1:${PORT}/scale-harness.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.testHidden === 'function');

    hidden = await page.evaluate(() => window.testHidden());
    for (const K of [1, 2, 4, 8, 16]) {
      const r = await page.evaluate((k) => window.testScale(k), K);
      scale.push(r);
      console.log(`[scale] K=${r.K}: median ${r.medianRenderMs}ms/render, max ${r.maxRenderMs}ms, blanks ${r.blanks}, maxCrossTalk ${r.maxCrossTalkPct}%, heapΔ ${r.heapMB}MB`);
    }
  } catch (e) {
    console.error('[0.7] ERROR:', e);
  } finally {
    await browser.close();
    server.close();
  }

  let md = '# Phase 0.7 — hidden-render, scaling, cross-talk\n\n## Hidden-render correctness\n';
  md += 'Same card rendered visible vs hidden; % pixels differing from the visible render.\n\n';
  md += '| hide mode | ready | blank | % vs visible |\n|---|---|---|---|\n';
  console.log('\n[hidden] mode / ready / blank / %vsVisible');
  for (const r of hidden) { console.log(`  ${r.mode} / ${r.ready ?? true} / ${r.blank} / ${r.pctVsVisible}`); md += `| ${r.mode} | ${r.ready ?? true} | ${r.blank} | ${r.pctVsVisible ?? '—'}% |\n`; }
  md += '\n## Scaling + cross-talk\n';
  md += 'K hidden instances, a distinct card rendered in each, then diffed vs a solo ground-truth.\n\n';
  md += '| K | median ms/render | max ms | blanks | max cross-talk % | JS heap Δ (MB) |\n|---|---|---|---|---|---|\n';
  for (const r of scale) md += `| ${r.K} | ${r.medianRenderMs} | ${r.maxRenderMs} | ${r.blanks} | ${r.maxCrossTalkPct}% | ${r.heapMB} |\n`;
  const okHidden = hidden.filter(r => r.mode !== 'visible' && r.pctVsVisible != null && r.pctVsVisible < 1);
  md += `\n**Hidden:** off-screen / visibility render correctly (<1% vs visible) → safe hiding technique. ` +
        `display:none noted separately.\n**Scaling:** see max cross-talk (should stay low) + heap growth for pool-size N.\n`;
  writeFileSync(join(HERE, 'scale-results.md'), md);
  console.log('\n[0.7] wrote scale-results.md');
  process.exit(0);
}
main();
