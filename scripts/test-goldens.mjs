#!/usr/bin/env node
// scripts/test-goldens.mjs
//
// Pixel-diff each renderer's current output against its stored goldens. See
// docs/v2-architecture.md §11 Phase 1a for the full semantics:
//
//   pnpm test:golden
//     Membership check (missing goldens / orphan PNGs) then pixel-diff every tag:golden card
//     for every registered renderer via pixelmatch. Fails on any mismatch above the
//     per-pixel tolerance.
//
//   pnpm test:golden --renderer <name>
//     As above but scoped to a single renderer's subtree.
//
//   pnpm test:golden --card <cid>[,<cid>...]   (repeatable)
//     Skips membership; diffs only the specified card(s). Fails with an actionable message
//     if no golden PNG exists for a requested card.
//
// Always renders fresh (skipCache: true) — otherwise a code change would silently return the
// cached PNG and pass every diff. See docs §4 CardConjurer update workflow.
//
// Emits an HTML report at collection/goldens/report.html grouped by renderer, with side-by-
// side golden / actual / diff thumbnails for any mismatches. The HTML file is gitignored via
// the outer collection/ .gitignore convention (renderers/ is the tracked content).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

import { renderers } from '../packages/renderer/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const CARDS_DIR = join(REPO, 'collection/cards');
const GOLDENS_ROOT = join(REPO, 'collection/goldens/renderers');
const REPORT_DIR = join(REPO, 'collection/goldens/.report');
const REPORT_HTML = join(REPO, 'collection/goldens/report.html');

// The v1-captured goldens were rendered on this date; freeze v2 to match so the collector
// info date stamp doesn't drift daily. Overridable via KP_RENDER_DATE. See driver.js and
// scripts/generate-goldens.mjs.
if (!process.env.KP_RENDER_DATE) process.env.KP_RENDER_DATE = '2026-07-31';

// Per-pixel diff tolerance (pixelmatch threshold 0..1, higher = more lenient). Overall
// PASS/FAIL threshold is the fraction of differing pixels; anything above MAX_DIFF_RATIO
// counts as a mismatch. Values chosen to absorb sub-perceptual anti-aliasing drift between
// Skia (@napi-rs/canvas) and Chromium (v1) — see docs §12 "Renderer fidelity (Skia vs Chromium)".
const PIXELMATCH_THRESHOLD = 0.1;
const MAX_DIFF_RATIO = 0.005; // 0.5% of pixels may differ before we fail a card

// ---- args ----------------------------------------------------------------------------------

const args = process.argv.slice(2);
function pickFlag(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) { const v = args[i + 1]; if (v) out.push(...v.split(',').map((s) => s.trim()).filter(Boolean)); i++; }
  }
  return out;
}
const scopedCards = pickFlag('--card');
const scopedRenderers = pickFlag('--renderer');
const scopedByCard = scopedCards.length > 0;

// ---- renderer selection --------------------------------------------------------------------

const rendererEntries = Object.entries(renderers).filter(([name]) =>
  scopedRenderers.length === 0 ? true : scopedRenderers.includes(name)
);
if (rendererEntries.length === 0) {
  console.error(`No renderers matched. Registered: ${Object.keys(renderers).join(', ')}`);
  process.exit(1);
}

// ---- load golden cards ---------------------------------------------------------------------

function loadGoldenCards() {
  const golden = [];
  for (const filename of readdirSync(CARDS_DIR)) {
    if (!filename.endsWith('.json')) continue;
    const card = JSON.parse(readFileSync(join(CARDS_DIR, filename), 'utf8'));
    if (card.tags?.golden !== true) continue;
    const cid = filename.match(/--([a-z0-9]{8})\.json$/)?.[1];
    if (!cid) continue;
    golden.push({ cid, filename, card });
  }
  golden.sort((a, b) => (a.card.collectorNumber || 0) - (b.card.collectorNumber || 0));
  return golden;
}

const allGolden = loadGoldenCards();
if (allGolden.length === 0) {
  console.error(`No cards with tags.golden === true found in ${CARDS_DIR}`);
  process.exit(1);
}

let targetCards;
if (scopedByCard) {
  targetCards = scopedCards.map((cid) => {
    const g = allGolden.find((x) => x.cid === cid);
    if (!g) { console.error(`No golden card with cid=${cid}`); process.exit(1); }
    return g;
  });
} else {
  targetCards = allGolden;
}

function renderableFaces(card) {
  if (card.layout === 'transform') return [0, 1];
  if (card.layout === 'modal') return [0, 1];
  return [0];
}

// ---- diff -----------------------------------------------------------------------------------

function diffPngs(actualBuf, goldenBuf) {
  const a = PNG.sync.read(actualBuf);
  const g = PNG.sync.read(goldenBuf);
  if (a.width !== g.width || a.height !== g.height) {
    return {
      match: false,
      reason: `dimensions differ (actual ${a.width}x${a.height} vs golden ${g.width}x${g.height})`,
      diffPng: null, diffPixels: -1, totalPixels: -1,
    };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, g.data, diff.data, a.width, a.height, { threshold: PIXELMATCH_THRESHOLD });
  const totalPixels = a.width * a.height;
  const ratio = diffPixels / totalPixels;
  return {
    match: ratio <= MAX_DIFF_RATIO,
    reason: `${diffPixels}/${totalPixels} px differ (${(ratio * 100).toFixed(3)}%, threshold ${(MAX_DIFF_RATIO * 100).toFixed(3)}%)`,
    diffPng: PNG.sync.write(diff), diffPixels, totalPixels, ratio,
  };
}

// ---- run ------------------------------------------------------------------------------------

console.log(`test:golden: ${rendererEntries.length} renderer(s) × ${targetCards.length} card(s)${scopedByCard ? ' (no membership check)' : ''}`);

/** @type {Record<string, Array<{ cid: string, faceIndex: number, name: string, status: 'pass'|'fail'|'missing-golden'|'error', reason?: string, diffFile?: string, actualFile?: string, goldenFile?: string }>>} */
const results = {};
let anyFail = false;

for (const [rendererName, factory] of rendererEntries) {
  results[rendererName] = [];
  const goldenDir = join(GOLDENS_ROOT, rendererName);
  const reportDirRenderer = join(REPORT_DIR, rendererName);
  mkdirSync(reportDirRenderer, { recursive: true });

  // Membership check (skipped when --card scopes down).
  if (!scopedByCard) {
    const expected = new Set();
    for (const { cid, card } of targetCards) {
      for (const f of renderableFaces(card)) expected.add(`${cid}-f${f}.png`);
    }
    const found = existsSync(goldenDir) ? new Set(readdirSync(goldenDir).filter((f) => f.endsWith('.png'))) : new Set();
    const missing = [...expected].filter((f) => !found.has(f));
    const orphan = [...found].filter((f) => !expected.has(f));
    if (missing.length || orphan.length) {
      console.log(`\n[${rendererName}] membership check:`);
      if (missing.length) console.log(`  MISSING (${missing.length}): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
      if (orphan.length) console.log(`  ORPHAN  (${orphan.length}): ${orphan.slice(0, 5).join(', ')}${orphan.length > 5 ? ' …' : ''}`);
      console.log(`  → run: pnpm generate-goldens --renderer ${rendererName}`);
      anyFail = true;
    }
  }

  console.log(`\n[${rendererName}] booting renderer ...`);
  const bt0 = Date.now();
  let renderer;
  try {
    renderer = await factory();
  } catch (e) {
    console.error(`[${rendererName}] FAILED to construct: ${e.message}`);
    anyFail = true;
    continue;
  }
  console.log(`[${rendererName}] booted in ${((Date.now() - bt0) / 1000).toFixed(1)}s`);

  for (const { cid, card } of targetCards) {
    const faces = renderableFaces(card);
    for (const faceIndex of faces) {
      const goldenPath = join(goldenDir, `${cid}-f${faceIndex}.png`);
      const face0Name = card.faces[faceIndex]?.name || '?';
      process.stdout.write(`  ${cid} f${faceIndex} (${face0Name}) ... `);

      if (!existsSync(goldenPath)) {
        console.log(scopedByCard ? 'MISSING GOLDEN — run: pnpm generate-goldens --card ' + cid : 'MISSING GOLDEN');
        results[rendererName].push({ cid, faceIndex, name: face0Name, status: 'missing-golden' });
        anyFail = true;
        continue;
      }

      let actual;
      try {
        const r = await renderer.render({ ...card, __faceIndex: faceIndex }, { skipCache: true });
        actual = r.png;
      } catch (e) {
        console.log(`RENDER ERROR: ${e.message}`);
        results[rendererName].push({ cid, faceIndex, name: face0Name, status: 'error', reason: e.message });
        anyFail = true;
        continue;
      }

      const goldenBuf = readFileSync(goldenPath);
      let diff;
      try {
        diff = diffPngs(actual, goldenBuf);
      } catch (e) {
        console.log(`DIFF ERROR: ${e.message}`);
        results[rendererName].push({ cid, faceIndex, name: face0Name, status: 'error', reason: e.message });
        anyFail = true;
        continue;
      }

      const base = `${cid}-f${faceIndex}`;
      const actualFile = join(reportDirRenderer, `${base}.actual.png`);
      const goldenFile = join(reportDirRenderer, `${base}.golden.png`);
      const diffFile = diff.diffPng ? join(reportDirRenderer, `${base}.diff.png`) : null;

      // Always write the golden/actual/diff thumbnails to the report dir — this lets the
      // HTML report show side-by-side images for passing cards too (useful for eyeballing
      // "does this actually look right" rather than trusting the pixel-diff ratio alone),
      // not just failures.
      writeFileSync(actualFile, actual);
      writeFileSync(goldenFile, goldenBuf);
      if (diffFile) writeFileSync(diffFile, diff.diffPng);

      const files = {
        actualFile: `./.report/${rendererName}/${base}.actual.png`,
        goldenFile: `./.report/${rendererName}/${base}.golden.png`,
        diffFile: diffFile ? `./.report/${rendererName}/${base}.diff.png` : undefined,
      };

      if (diff.match) {
        console.log(`ok (${diff.reason})`);
        results[rendererName].push({ cid, faceIndex, name: face0Name, status: 'pass', reason: diff.reason, ...files });
      } else {
        console.log(`FAIL ${diff.reason}`);
        results[rendererName].push({ cid, faceIndex, name: face0Name, status: 'fail', reason: diff.reason, ...files });
        anyFail = true;
      }
    }
  }
}

// ---- HTML report ---------------------------------------------------------------------------

const html = renderReport(results);
writeFileSync(REPORT_HTML, html);
console.log(`\nReport: ${REPORT_HTML}`);

// summary
console.log('\nSummary:');
for (const [name, rows] of Object.entries(results)) {
  const p = rows.filter((r) => r.status === 'pass').length;
  const f = rows.filter((r) => r.status === 'fail').length;
  const m = rows.filter((r) => r.status === 'missing-golden').length;
  const e = rows.filter((r) => r.status === 'error').length;
  console.log(`  ${name}: ${p} pass, ${f} fail, ${m} missing, ${e} error`);
}

process.exit(anyFail ? 1 : 0);

// --------------------------------------------------------------------------------------------

function renderReport(results) {
  const style = `
    body { font-family: -apple-system, sans-serif; margin: 2rem; background: #111; color: #eee; }
    h1 { margin-top: 0; }
    h2 { margin-top: 2rem; border-bottom: 1px solid #444; padding-bottom: .3rem; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #333; padding: .4rem .6rem; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #1e1e1e; }
    tr.pass td { color: #6a6; }
    tr.fail { background: #2a1010; }
    tr.missing-golden { background: #2a220a; color: #dc9; }
    tr.error { background: #2a0a1a; color: #d9a; }
    .imgs { display: flex; gap: .5rem; margin-top: .3rem; }
    .imgs figure { margin: 0; }
    .imgs figcaption { font-size: 11px; color: #aaa; text-align: center; }
    .imgs img { width: 200px; height: auto; display: block; background: #000; border: 1px solid #444; }
    .reason { font-family: monospace; color: #cc9; }
    tr.pass details { margin-top: .3rem; }
    tr.pass summary { cursor: pointer; color: #8c8; font-size: 12px; }
  `;
  let body = '';
  for (const [name, rows] of Object.entries(results)) {
    const p = rows.filter((r) => r.status === 'pass').length;
    const f = rows.filter((r) => r.status === 'fail').length;
    const m = rows.filter((r) => r.status === 'missing-golden').length;
    const e = rows.filter((r) => r.status === 'error').length;
    body += `<h2>${escapeHtml(name)} — <span class="reason">${p} pass · ${f} fail · ${m} missing · ${e} error</span></h2>`;
    body += `<table><thead><tr><th>Card</th><th>Face</th><th>Name</th><th>Status</th><th>Details</th></tr></thead><tbody>`;
    for (const r of rows) {
      const imgs = r.goldenFile
        ? `<div class="imgs">
             <figure><img src="${r.goldenFile}" loading="lazy"><figcaption>golden</figcaption></figure>
             <figure><img src="${r.actualFile}" loading="lazy"><figcaption>actual</figcaption></figure>
             ${r.diffFile ? `<figure><img src="${r.diffFile}" loading="lazy"><figcaption>diff</figcaption></figure>` : ''}
           </div>`
        : '';
      const reasonLine = `<span class="reason">${escapeHtml(r.reason || '')}</span>`;
      // Passing rows collapse the thumbnails behind a <details> toggle so the report stays
      // scannable even with dozens of passing cards; failing/error/missing rows show them
      // open by default since that's the whole point of looking at the report.
      const details = r.status === 'pass'
        ? `${reasonLine}${imgs ? `<details><summary>view images</summary>${imgs}</details>` : ''}`
        : `<div class="reason">${r.reason ? escapeHtml(r.reason) : ''}</div>${imgs}`;
      body += `<tr class="${r.status}"><td>${escapeHtml(r.cid)}</td><td>${r.faceIndex}</td><td>${escapeHtml(r.name)}</td><td>${r.status}</td><td>${details}</td></tr>`;
    }
    body += '</tbody></table>';
  }
  return `<!doctype html><meta charset="utf-8"><title>Golden report</title><style>${style}</style><h1>Golden report</h1>${body}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
