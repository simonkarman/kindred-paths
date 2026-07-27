// Phase 0.6 — interactive-patch feasibility runner.
// Loads the two-iframe harness headless, runs the scenarios (patch vs clean render, in-browser
// pixel diff), and prints a verdict table.
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
  const browser = await chromium.launch({ headless: true });
  let rows = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
    page.on('pageerror', () => {});
    await page.goto(`http://127.0.0.1:${PORT}/patch-harness.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.runScenarios === 'function');
    rows = await page.evaluate(() => window.runScenarios());
    const dbg = await page.evaluate(() => ({ a: window.__dbgA }));
    if (dbg.a) writeFileSync(join(HERE, 'patch-dbg-a.png'), Buffer.from(dbg.a.split(',')[1], 'base64'));
  } catch (e) {
    console.error('[patch] ERROR:', e);
  } finally {
    await browser.close();
    server.close();
  }

  let md = '# Phase 0.6 — interactive-patch feasibility\n\n';
  md += 'Patch (mutate `card.text` + direct `drawText()`, no autoFrame) vs a clean full render, ';
  md += 'compared by in-browser `getImageData` diff (match if <0.1% pixels differ).\n\n';
  md += '| scenario | expected | % pixels diff | verdict | ok |\n|---|---|---|---|---|\n';
  let allOk = true;
  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n' + pad('scenario', 22) + pad('expected', 10) + pad('%diff', 10) + pad('verdict', 10) + 'ok');
  for (const r of rows) {
    const ok = r.verdict === r.expect; allOk = allOk && ok;
    console.log(pad(r.name, 22) + pad(r.expect, 10) + pad(r.pctDiff + '%', 10) + pad(r.verdict, 10) + (ok ? '✓' : '✗'));
    md += `| ${r.name} | ${r.expect} | ${r.pctDiff}% | ${r.verdict} | ${ok ? '✓' : '✗'} |\n`;
  }
  md += `\n**Result: ${allOk ? 'PASS' : 'FAIL'}** — ` + (allOk
    ? 'text patches (name/rules/auto-fit) match clean renders; color/type changes diverge (must full-render); a long-lived patched session stays stable.\n'
    : 'a scenario did not match expectation; see table.\n');
  writeFileSync(join(HERE, 'patch-results.md'), md);
  console.log('\n[patch] ' + (allOk ? 'PASS' : 'FAIL') + ' — wrote patch-results.md');
  process.exit(allOk ? 0 : 1);
}

main();
