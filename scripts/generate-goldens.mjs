#!/usr/bin/env node
// scripts/generate-goldens.mjs
//
// Regenerate golden PNGs for every registered renderer. Replaces the throwaway
// spike/goldens/initial-capture.mjs (which hit v1's HTTP endpoint) with a v2-native runner
// that discovers renderers from packages/renderer/dist/index.js and calls each renderer
// directly. Zero v1 dependency at runtime.
//
// See docs/v2-architecture.md §11 Phase 1a for the full semantics:
//
//   pnpm generate-goldens
//     For every registered renderer: WIPES collection/goldens/renderers/<name>/ and
//     rewrites PNGs for every tag:golden card.
//
//   pnpm generate-goldens --renderer <name>
//     As above but scoped to a single renderer's subtree (still wipes it).
//
//   pnpm generate-goldens --card <cid>[,<cid>...]   (repeatable)
//     Surgical: overwrites only the specified card(s) for every (or the --renderer scoped)
//     renderer. NO wipe. Missing cards fail with an actionable message.
//
// Both flags combine: `--renderer cardconjurer --card abc12345` overwrites one PNG.
//
// Always renders fresh (skipCache: true) — required, or a renderer code change would silently
// return the previously-cached PNG and pass every diff (see docs §4 CardConjurer update
// workflow + §11 Phase 1a). Today no renderer has a cache; the flag is future-proofing.
//
// Golden files live at:
//   collection/goldens/renderers/<renderer-name>/<cid>-f<faceIndex>.png
//
// The -f<N> suffix is required because transform/modal cards have two renderable faces and
// need distinct files (see §Renderable faces per layout below).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderers } from '../packages/renderer/dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const CARDS_DIR = join(REPO, 'collection/cards');
const GOLDENS_ROOT = join(REPO, 'collection/goldens/renderers');

// The v1-captured goldens were rendered on this date. The collector info block includes
// today's date via v1's `new Date().toISOString()`, so every renderer must render on the
// same date or the diff on every card will include a shifting date stamp. Baked in here as
// a default so `pnpm generate-goldens` and `pnpm test:golden` reproduce the v1 baseline
// exactly. Override via KP_RENDER_DATE if you want to bless a new capture date across the
// whole set (which then requires regenerating every card's golden). See driver.js.
if (!process.env.KP_RENDER_DATE) process.env.KP_RENDER_DATE = '2026-07-31';

// ---- args ----------------------------------------------------------------------------------

const args = process.argv.slice(2);
function pickFlag(name) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) {
      const v = args[i + 1];
      if (v) out.push(...v.split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    }
  }
  return out;
}
const scopedCards = pickFlag('--card');
const scopedRenderers = pickFlag('--renderer');
const scopedByCard = scopedCards.length > 0;

// ---- renderer selection --------------------------------------------------------------------

const rendererEntries = Object.entries(renderers).filter(([name]) =>
  scopedRenderers.length === 0 ? true : scopedRenderers.includes(name),
);
if (rendererEntries.length === 0) {
  console.error(`No renderers matched. Registered: ${Object.keys(renderers).join(', ')}`);
  console.error(`Requested: ${scopedRenderers.join(', ') || '(all)'}`);
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

// Which faces to render per layout. Adventure's second face is embedded in the primary render
// and v1 errors on face 1 → face 0 only. Transform + modal both have two independently-rendered
// faces. See spike/goldens/initial-capture.mjs (which established this rule).
function renderableFaces(card) {
  if (card.layout === 'transform') return [0, 1];
  if (card.layout === 'modal') return [0, 1];
  return [0];
}

// ---- run -----------------------------------------------------------------------------------

console.log(
  `generate-goldens: ${rendererEntries.length} renderer(s) × ${targetCards.length} card(s)` +
  (scopedByCard ? ' (surgical — no wipe)' : ' (full — wiping renderer dirs)'),
);

let totalCaptured = 0, totalFailed = 0;
const startTs = Date.now();

for (const [rendererName, factory] of rendererEntries) {
  const outDir = join(GOLDENS_ROOT, rendererName);

  if (!scopedByCard && existsSync(outDir)) {
    console.log(`\n[${rendererName}] wiping ${outDir}`);
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  console.log(`\n[${rendererName}] booting renderer ...`);
  const t0 = Date.now();
  let renderer;
  try {
    renderer = await factory();
  } catch (e) {
    console.error(`[${rendererName}] FAILED to construct: ${e.message}`);
    totalFailed += targetCards.length;
    continue;
  }
  console.log(`[${rendererName}] booted in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  for (const { cid, card } of targetCards) {
    const faces = renderableFaces(card);
    for (const faceIndex of faces) {
      const outPath = join(outDir, `${cid}-f${faceIndex}.png`);
      const face0Name = card.faces[faceIndex]?.name || '?';
      const label = `  [${(totalCaptured + totalFailed + 1).toString().padStart(3)}] ${cid} f${faceIndex} (${face0Name})`;
      process.stdout.write(`${label} ... `);

      const rt0 = Date.now();
      try {
        // Pass the raw card + faceIndex; the renderer maps it. skipCache is required per §4.
        const { png, timings } = await renderer.render({ ...card, __faceIndex: faceIndex }, { skipCache: true });
        writeFileSync(outPath, png);
        const kb = (png.length / 1024).toFixed(0);
        const s = ((Date.now() - rt0) / 1000).toFixed(1);
        const t = timings ? ` build=${timings.buildMs}ms composite=${timings.compositeMs}ms encode=${timings.encodeMs}ms` : '';
        console.log(`ok (${kb}KB, ${s}s)${t}`);
        totalCaptured += 1;
      } catch (e) {
        console.log(`FAIL ${e.message}`);
        totalFailed += 1;
      }
    }
  }
}

const totalS = ((Date.now() - startTs) / 1000).toFixed(1);
console.log(`\nDone in ${totalS}s. Captured ${totalCaptured}, failed ${totalFailed}.`);
console.log(`Output: ${GOLDENS_ROOT}/{${rendererEntries.map(([n]) => n).join(',')}}/`);
if (totalFailed > 0) process.exit(1);
