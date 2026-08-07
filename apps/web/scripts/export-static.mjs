#!/usr/bin/env node
// apps/web/scripts/export-static.mjs — Static export orchestrator (Phase 1d).
//
// Produces a fully static, GitHub-Pages-deployable snapshot of the read-only v2 app for
// a filterable subset of the collection. See docs/v2-phase1d-static-export.md.
//
// Usage:
//   pnpm --filter web export:static
//   pnpm --filter web export:static -- --query "set:shx"
//   pnpm --filter web export:static -- --query "set:shx tag:status=done" --base-path /shx-cube
//
// Steps (see plan doc §5.4):
//   1. Wipe apps/web/generated/.
//   2. Load visible cards; apply query filter.
//   3. Render each required (card, face) via the shared renderer (content-hash cached).
//      Copy each PNG + thumbnail into generated/renders/<cid>-<face>.{png,thumb.webp}.
//   4. Stage generated/renders/ → public/renders/ so `next build` picks them up as
//      public assets.
//   5. Run `next build` with next.config.static.ts and the export env vars.
//   6. Move out/ → generated/site/.
//   7. Cleanup public/renders/ staging.
//   8. Write generated/README.md.
//
// This script talks directly to @kindred-paths/{shared,renderer} — the plain-JS package
// APIs — rather than to apps/web/src/core/*.ts, so we don't need a TS loader to run it.

import { spawn } from 'node:child_process';
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/web/scripts/ -> app root is 1 level up, repo root is 3 levels up
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');

// Env-var side effects must happen BEFORE @kindred-paths/renderer is imported: it computes
// its own module-top-level fallback paths (see packages/renderer/src/cardconjurer/hosts/
// node-handle.js). We set the same defaults next.config.ts sets, so a bare invocation of
// this script from the repo root works without extra env plumbing.
process.env.KP_COLLECTION_PATH ??= join(REPO_ROOT, 'collection');
process.env.KP_CACHE_DIR ??= join(REPO_ROOT, '.cache');
process.env.KP_CARDCONJURER_PATH ??= join(REPO_ROOT, 'packages/renderer/external/cardconjurer');
process.env.UV_THREADPOOLSIZE ??= '8';

// --- CLI parsing --------------------------------------------------------------------

function parseArgs(argv) {
  const args = { query: '', basePath: '', out: join(APP_ROOT, 'generated', 'site') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue;  // pnpm passes through the -- separator; ignore it silently.
    if (a === '--query' || a === '-q') { args.query = argv[++i] ?? ''; }
    else if (a.startsWith('--query=')) { args.query = a.slice('--query='.length); }
    else if (a === '--base-path' || a === '-b') { args.basePath = argv[++i] ?? ''; }
    else if (a.startsWith('--base-path=')) { args.basePath = a.slice('--base-path='.length); }
    else if (a === '--out' || a === '-o') { args.out = resolve(argv[++i] ?? args.out); }
    else if (a.startsWith('--out=')) { args.out = resolve(a.slice('--out='.length)); }
    else if (a === '--help' || a === '-h') {
      console.log('Usage: export:static [--query <search-DSL>] [--base-path /<subpath>] [--out <dir>]');
      process.exit(0);
    } else {
      console.warn(`export:static: ignoring unknown argument: ${a}`);
    }
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

// --- Collection I/O ----------------------------------------------------------------

async function loadVisibleCards() {
  // Filename convention: <set-slug>--<cid>.json where cid is the last 8 alphanumeric chars
  // before .json. Same helper the app uses.
  const { getCidFromFilename, SerializedCardSchema } = await import('@kindred-paths/shared');
  const dir = join(process.env.KP_COLLECTION_PATH, 'cards');
  const filenames = await readdir(dir);
  const cards = await Promise.all(filenames.map(async (filename) => {
    const cid = getCidFromFilename(filename);
    if (!cid) return undefined;
    const text = await readFile(join(dir, filename), 'utf-8');
    const parsed = SerializedCardSchema.safeParse({ ...JSON.parse(text), cid });
    return parsed.success ? parsed.data : undefined;
  }));
  return cards
    .filter((c) => c !== undefined)
    .filter((c) => c.tags?.deleted !== true);
}

// --- Main --------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  console.log('=== export:static ===');
  console.log(`  query     : ${ARGS.query ? JSON.stringify(ARGS.query) : '(none — export everything)'}`);
  console.log(`  base path : ${ARGS.basePath || '(none — site serves from domain root)'}`);
  console.log(`  out       : ${ARGS.out}`);
  console.log();

  // ─── 1. Wipe generated/ ─────────────────────────────────────────────────────
  const GENERATED = join(APP_ROOT, 'generated');
  const GENERATED_RENDERS = join(GENERATED, 'renders');
  const GENERATED_SITE = join(GENERATED, 'site');
  const PUBLIC_RENDERS_STAGING = join(APP_ROOT, 'public', 'renders');
  const NEXT_OUT = join(APP_ROOT, 'out');

  console.log('[1/8] wiping apps/web/generated/');
  await rm(GENERATED, { recursive: true, force: true });
  await rm(PUBLIC_RENDERS_STAGING, { recursive: true, force: true });
  await rm(NEXT_OUT, { recursive: true, force: true });
  await mkdir(GENERATED_RENDERS, { recursive: true });

  // ─── 2. Load cards, apply filter ────────────────────────────────────────────
  console.log('[2/8] loading collection');
  const { filterCardsBasedOnSearch, Layout } = await import('@kindred-paths/shared');

  let cards = await loadVisibleCards();
  const totalVisible = cards.length;
  if (ARGS.query && ARGS.query.trim()) {
    try {
      cards = filterCardsBasedOnSearch(cards, ARGS.query);
    } catch (err) {
      console.error(`[2/8] FAILED to apply query filter: ${err?.message || err}`);
      process.exit(1);
    }
  }
  console.log(`[2/8] ${cards.length} card${cards.length === 1 ? '' : 's'} to export (of ${totalVisible} visible)`);
  if (cards.length === 0) {
    console.error('[2/8] No cards matched the query. Nothing to export.');
    process.exit(1);
  }

  // Build the (card, faceIndex) list to render. Face 0 always; face 1 only for
  // dual-render layouts (modal/transform). Adventure layouts render as a single card.
  const faceJobs = [];
  for (const card of cards) {
    const isDual = new Layout(card.layout).isDualRenderLayout();
    for (let i = 0; i < card.faces.length; i++) {
      if (i > 0 && !isDual) break;
      faceJobs.push({ card, faceIndex: i });
    }
  }
  console.log(`[2/8] ${faceJobs.length} face renders required`);

  // ─── 3. Render (with cache) and copy into generated/renders/ ────────────────
  console.log('[3/8] rendering / cache-hitting each face');
  const { createCardconjurerNodeRenderer } = await import('@kindred-paths/renderer/cardconjurer/node');
  const { withCache, renderCachePaths } = await import('@kindred-paths/renderer/cache');

  const bareRenderer = await createCardconjurerNodeRenderer();
  const cacheDir = process.env.KP_CACHE_DIR;
  const renderer = withCache(bareRenderer, { cacheDir });

  let renderedCount = 0;
  let cacheHits = 0;
  const started = Date.now();
  const printProgressEvery = Math.max(1, Math.floor(faceJobs.length / 20));

  for (const { card, faceIndex } of faceJobs) {
    const input = { ...card, __faceIndex: faceIndex };
    let cacheHit = false;
    try {
      const result = await renderer.render(input, {});
      cacheHit = result?.timings?.cacheHit === true;
    } catch (err) {
      console.error(`[3/8]   FAILED ${card.cid}#${faceIndex}: ${err?.message || err}`);
      throw err;
    }

    // Locate the cached png + thumb on disk and copy them into generated/renders/
    // under friendly filenames.
    const paths = renderCachePaths({
      cacheDir,
      rendererName: bareRenderer.name,
      rendererVersion: bareRenderer.version,
      input,
      options: {},
    });
    const dstPng = join(GENERATED_RENDERS, `${card.cid}-${faceIndex}.png`);
    const dstThumb = join(GENERATED_RENDERS, `${card.cid}-${faceIndex}.thumb.webp`);
    await copyFile(paths.pngPath, dstPng);
    if (existsSync(paths.thumbPath)) {
      await copyFile(paths.thumbPath, dstThumb);
    } else {
      console.warn(`[3/8]   no thumbnail for ${card.cid}#${faceIndex}; grid will fall back to full PNG`);
    }

    renderedCount++;
    if (cacheHit) cacheHits++;
    if (renderedCount % printProgressEvery === 0 || renderedCount === faceJobs.length) {
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[3/8]   ${renderedCount}/${faceJobs.length} (cache hits: ${cacheHits}, ${elapsed}s elapsed)`);
    }
  }

  // ─── 4. Stage renders into public/renders/ for Next to pick up ──────────────
  console.log('[4/8] staging renders into public/renders/');
  await cp(GENERATED_RENDERS, PUBLIC_RENDERS_STAGING, { recursive: true });

  // ─── 5. next build with the static config ───────────────────────────────────
  // `output: 'export'` refuses to build any `app/api/**` route that isn't declared
  // fully static via `generateStaticParams()` + `dynamic = 'force-static'`. Our API
  // routes use request-specific query params (variant/force) and NextRequest, so
  // making them static-safe would mean adding no-op handlers just to please the
  // exporter. Simpler and cleaner: temporarily move `src/app/api/` aside for the
  // duration of the build, then restore it. Wrapped in try/finally so an interrupted
  // build doesn't leave the tree half-moved.
  console.log('[5/8] running next build (static export)');
  const API_DIR = join(APP_ROOT, 'src', 'app', 'api');
  const API_HIDDEN = join(APP_ROOT, 'src', 'app', '_api-hidden-during-static-export');
  const hasApi = existsSync(API_DIR);
  if (hasApi) await rename(API_DIR, API_HIDDEN);
  try {
    await runNextBuildStatic({
      query: ARGS.query,
      basePath: normalizeBasePath(ARGS.basePath),
    });
  } finally {
    if (hasApi && existsSync(API_HIDDEN)) await rename(API_HIDDEN, API_DIR);
  }

  // ─── 6. Move out/ → generated/site/ ────────────────────────────────────────
  console.log('[6/8] moving out/ → generated/site/');
  if (!existsSync(NEXT_OUT)) {
    throw new Error(`next build did not produce ${NEXT_OUT}`);
  }
  await cp(NEXT_OUT, GENERATED_SITE, { recursive: true });
  await rm(NEXT_OUT, { recursive: true, force: true });

  // If --out was specified and differs from the default, additionally copy the site there.
  if (ARGS.out !== GENERATED_SITE) {
    console.log(`[6/8]   also copying to ${ARGS.out}`);
    await rm(ARGS.out, { recursive: true, force: true });
    await cp(GENERATED_SITE, ARGS.out, { recursive: true });
  }

  // ─── 7. Cleanup transient staging ───────────────────────────────────────────
  console.log('[7/8] cleaning up public/renders/ staging');
  await rm(PUBLIC_RENDERS_STAGING, { recursive: true, force: true });

  // ─── 8. README ─────────────────────────────────────────────────────────────
  console.log('[8/8] writing generated/README.md');
  await writeFile(
    join(GENERATED, 'README.md'),
    [
      '# Generated static export',
      '',
      'This directory is regenerated by `pnpm --filter web export:static`. Everything here',
      'is deleted and rebuilt on each run. Do not commit.',
      '',
      `- Query: ${ARGS.query ? '`' + ARGS.query + '`' : '(none — all visible cards)'}`,
      `- Base path: ${ARGS.basePath || '(none)'}`,
      `- Cards: ${cards.length}`,
      `- Face renders: ${faceJobs.length}`,
      `- Cache hits: ${cacheHits}/${faceJobs.length}`,
      `- Generated at: ${new Date().toISOString()}`,
      '',
      '## Layout',
      '',
      '- `renders/` — one `<cid>-<face>.png` + `<cid>-<face>.thumb.webp` per card face.',
      '- `site/` — the deployable static site (HTML + assets). Serve this with any static host.',
      '',
      'See `docs/v2-phase1d-static-export.md` for the full design and the GitHub Action template.',
      '',
    ].join('\n'),
  );

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log();
  console.log(`done in ${secs}s.`);
  console.log(`  site: ${GENERATED_SITE}`);
  console.log(`  preview locally: npx serve ${GENERATED_SITE}`);
}

// --- helpers -----------------------------------------------------------------------

function normalizeBasePath(bp) {
  if (!bp) return '';
  const stripped = bp.replace(/\/+$/, '');
  if (!stripped) return '';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

function runNextBuildStatic({ query, basePath }) {
  return new Promise((resolveP, rejectP) => {
    const env = {
      ...process.env,
      // next.config.ts inspects NEXT_PUBLIC_KP_STATIC and layers on `output: 'export'`
      // + basePath + assetPrefix + injected env when true. See next.config.ts.
      NEXT_PUBLIC_KP_STATIC: 'true',
      NEXT_PUBLIC_KP_BASE_PATH: basePath || '',
      KP_STATIC_EXPORT_QUERY: query || '',
      KP_BASE_PATH: basePath || '',
    };
    const nextBin = join(APP_ROOT, 'node_modules', '.bin', 'next');
    const [cmd, args] = existsSync(nextBin)
      ? [nextBin, ['build']]
      : ['pnpm', ['exec', 'next', 'build']];
    const child = spawn(cmd, args, {
      cwd: APP_ROOT,
      env,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`next build exited with code ${code}`));
    });
    child.on('error', rejectP);
  });
}

// --- entry -------------------------------------------------------------------------

main().catch((err) => {
  console.error();
  console.error('export:static FAILED');
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
