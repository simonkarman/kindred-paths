#!/usr/bin/env node
// initial-capture.mjs
//
// Phase 0.9 one-shot: capture golden PNGs from v1 into
// collection/goldens/renderers/cardconjurer/<cid>-f<N>.png
//
// Reads `tag:golden` cards from collection/cards/, hits v1's
// GET /render/:cid/:faceIndex?force=true (force = bypass render cache), and
// writes the PNG to disk. Renderable faces per layout:
//   normal    -> face 0 only
//   adventure -> face 0 only (face 1 is embedded; v1 errors on face 1)
//   modal     -> face 0 and face 1
//   transform -> face 0 and face 1
//
// The renderer output dir is wiped first for a clean capture. This script is
// throwaway: once `pnpm generate-goldens` exists in the v2 workspace
// (Phase 1a), it uses the same layout and this script is retired.
//
// Prerequisite: v1 server running at http://localhost:4101 with CardConjurer
// available. Set KP_V1_URL to override the default.
//
// Usage:
//   node spike/goldens/initial-capture.mjs
//   node spike/goldens/initial-capture.mjs --card <cid>   # capture one card only (no wipe)

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const V1_URL = process.env.KP_V1_URL || 'http://localhost:4101';
const CARDS_DIR = 'collection/cards';
const RENDERER_NAME = 'cardconjurer';
const GOLDENS_DIR = `collection/goldens/renderers/${RENDERER_NAME}`;

const args = process.argv.slice(2);
const scopedCardIdx = args.indexOf('--card');
const scopedCard = scopedCardIdx >= 0 ? args[scopedCardIdx + 1] : null;

// ---------------------------------------------------------------------------
// Load golden cards
// ---------------------------------------------------------------------------

const golden = [];
for (const filename of readdirSync(CARDS_DIR)) {
  if (!filename.endsWith('.json')) continue;
  const raw = readFileSync(join(CARDS_DIR, filename), 'utf8');
  const card = JSON.parse(raw);
  if (card.tags?.golden !== true) continue;
  const cid = filename.match(/--([a-z0-9]{8})\.json$/)?.[1];
  if (!cid) continue;
  golden.push({ cid, filename, card });
}

golden.sort((a, b) => (a.card.collectorNumber || 0) - (b.card.collectorNumber || 0));

if (golden.length === 0) {
  console.error('No cards with tags.golden === true found in', CARDS_DIR);
  process.exit(1);
}

const filtered = scopedCard ? golden.filter(g => g.cid === scopedCard) : golden;
if (scopedCard && filtered.length === 0) {
  console.error(`No golden card found with cid=${scopedCard}`);
  process.exit(1);
}

console.log(`Found ${golden.length} golden cards${scopedCard ? `, capturing 1 (${scopedCard})` : ''}`);

// ---------------------------------------------------------------------------
// Compute which faces to render per layout
// ---------------------------------------------------------------------------

function renderableFaces(card) {
  if (card.layout === 'transform') return [0, 1];
  if (card.layout === 'modal') return [0, 1];
  // normal, adventure -> face 0 only
  return [0];
}

// ---------------------------------------------------------------------------
// Verify v1 is reachable
// ---------------------------------------------------------------------------

try {
  const r = await fetch(V1_URL + '/');
  if (r.status !== 200 && r.status !== 404) {
    console.error(`v1 at ${V1_URL} returned unexpected status ${r.status}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`Cannot reach v1 at ${V1_URL}:`, e.message);
  console.error('Start it with: cd server && npm run dev');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Prepare output dir (wipe on full run, keep on --card run)
// ---------------------------------------------------------------------------

if (!scopedCard && existsSync(GOLDENS_DIR)) {
  console.log(`Wiping ${GOLDENS_DIR} ...`);
  rmSync(GOLDENS_DIR, { recursive: true, force: true });
}
mkdirSync(GOLDENS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Capture each face
// ---------------------------------------------------------------------------

let captured = 0, failed = 0;
const startTs = Date.now();

for (const { cid, card } of filtered) {
  const faces = renderableFaces(card);
  for (const faceIndex of faces) {
    const outPath = join(GOLDENS_DIR, `${cid}-f${faceIndex}.png`);
    const url = `${V1_URL}/render/${cid}/${faceIndex}?force=true`;
    const face0Name = card.faces[faceIndex]?.name || '?';
    process.stdout.write(`  [${(captured + failed + 1).toString().padStart(3)}] ${cid} f${faceIndex} (${face0Name}) ... `);

    const t0 = Date.now();
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.log(`FAIL http ${r.status}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(outPath, buf);
      const kb = (buf.length / 1024).toFixed(0);
      const s = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ok (${kb}KB, ${s}s)`);
      captured++;
    } catch (e) {
      console.log(`ERROR ${e.message}`);
      failed++;
    }
  }
}

const totalS = ((Date.now() - startTs) / 1000).toFixed(1);
console.log(`\nDone in ${totalS}s. Captured ${captured}, failed ${failed}.`);
console.log(`Output: ${GOLDENS_DIR}`);
if (failed > 0) process.exit(1);
