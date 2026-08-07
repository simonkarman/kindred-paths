#!/usr/bin/env node
// packages/renderer/scripts/setup.mjs — CardConjurer clone bootstrap.
//
// Fetches the CardConjurer repo at the pinned SHA (see ../src/cardconjurer/pin.js)
// into `packages/renderer/external/cardconjurer/`. Uses a **blobless partial clone**
// (`--filter=blob:none`) at `--depth 1`, so we never download CC's multi-GB history —
// we only fetch the blobs needed to check out one commit's worth of files (~5 GB
// working copy vs ~14 GB for a full clone).
//
// Idempotent: no-op on cache hit (same SHA already checked out).
//
// Usage:
//   pnpm setup:cardconjurer               # from repo root
//   node packages/renderer/scripts/setup.mjs
//
// Path rewriting note: the Node bridge (../src/cardconjurer/hosts/node-handle.js)
// intercepts CC's requests for `/local_art/*` and `/img/setSymbols/official/custom/*`
// and reads directly from `KP_COLLECTION_PATH/{art,symbols}` — so we do NOT need to
// create symlinks or copy art/symbols into the CC clone. That's a Docker-container
// concern for the interactive CC UI, which we don't run in the Node bridge.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CARDCONJURER_PIN } from '../src/cardconjurer/pin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/renderer/scripts/ -> repo root is 3 levels up
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const TARGET = join(REPO_ROOT, 'packages', 'renderer', 'external', 'cardconjurer');

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], encoding: 'utf8', ...opts });
}

function runCapture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts });
}

function tryRunCapture(cmd, args, opts = {}) {
  try {
    return { ok: true, out: runCapture(cmd, args, opts) };
  } catch (err) {
    return { ok: false, err };
  }
}

function currentHeadSha(dir) {
  const r = tryRunCapture('git', ['-C', dir, 'rev-parse', 'HEAD']);
  return r.ok ? r.out.trim() : null;
}

function isNonEmptyDir(dir) {
  try { return readdirSync(dir).length > 0; } catch { return false; }
}

function initialClone(dir, repoUrl, sha) {
  // Blobless partial clone at depth 1 of default branch. Fast (~4 min on this repo)
  // and produces a working copy sized to one commit (~5 GB) instead of full history
  // (~14 GB). If the pinned SHA is the default branch's HEAD (the common case), this
  // single call is enough. Otherwise the caller does an additional fetch+checkout of
  // the specific SHA below.
  mkdirSync(dir, { recursive: true });
  run('git', ['clone', '--filter=blob:none', '--depth', '1', '--no-tags', repoUrl, dir]);
  const head = currentHeadSha(dir);
  if (head === sha) return;
  // Pinned SHA differs from HEAD of default branch. Fetch just that commit's tree +
  // blobs on-demand at depth 1 and check it out.
  console.log(`setup:cardconjurer: default branch HEAD (${head.slice(0, 8)}) != pin (${sha.slice(0, 8)}); fetching pinned commit.`);
  run('git', ['-C', dir, 'fetch', '--depth', '1', '--filter=blob:none', 'origin', sha]);
  run('git', ['-C', dir, 'checkout', '--quiet', 'FETCH_HEAD']);
}

function updateExistingToSha(dir, sha) {
  run('git', ['-C', dir, 'fetch', '--depth', '1', '--filter=blob:none', 'origin', sha]);
  run('git', ['-C', dir, 'checkout', '--quiet', 'FETCH_HEAD']);
}

function main() {
  if (!CARDCONJURER_PIN || !CARDCONJURER_PIN.sha) {
    console.error('setup:cardconjurer: CARDCONJURER_PIN is null; refusing to clone without a pinned SHA.');
    console.error('                    See packages/renderer/src/cardconjurer/pin.js.');
    process.exit(1);
  }
  const { sha, repo, display } = CARDCONJURER_PIN;

  console.log(`setup:cardconjurer: target = ${TARGET}`);
  console.log(`setup:cardconjurer: pinned = ${display || sha}`);

  if (isNonEmptyDir(TARGET)) {
    const head = currentHeadSha(TARGET);
    if (head === sha) {
      console.log('setup:cardconjurer: already at pinned SHA. No-op.');
      return;
    }
    if (head) {
      console.log(`setup:cardconjurer: existing clone at ${head.slice(0, 8)}, updating to pin.`);
      try {
        updateExistingToSha(TARGET, sha);
        console.log('setup:cardconjurer: updated to pinned SHA.');
        return;
      } catch (err) {
        console.warn(`setup:cardconjurer: incremental update failed (${err.message}); wiping and re-cloning.`);
        rmSync(TARGET, { recursive: true, force: true });
      }
    } else {
      console.log('setup:cardconjurer: existing directory has no git metadata; wiping and re-cloning.');
      rmSync(TARGET, { recursive: true, force: true });
    }
  }

  console.log(`setup:cardconjurer: partial-cloning (blobless, depth 1) from ${repo}`);
  console.log('setup:cardconjurer: this takes a few minutes on a first run (~5 GB working copy).');
  initialClone(TARGET, repo, sha);
  console.log(`setup:cardconjurer: done at ${currentHeadSha(TARGET)?.slice(0, 8)}.`);
}

try {
  main();
} catch (err) {
  console.error('setup:cardconjurer: FAILED');
  console.error(err.message || err);
  if (err.stderr) process.stderr.write(err.stderr.toString());
  process.exit(1);
}
