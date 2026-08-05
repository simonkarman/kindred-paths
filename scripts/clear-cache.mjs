#!/usr/bin/env node
// Clears the on-disk render cache (`withCache`'s cache dir — content-hashed PNGs +
// thumbnails, NOT the goldens under collection/goldens/, which are a separate, git-synced
// asset). Honors KP_CACHE_DIR (default: <repo root>/.cache), matching
// packages/renderer/src/cache.js and apps/web/src/core/config.ts's own default resolution.
//
// Usage: pnpm cache:clear

import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const cacheDir = process.env.KP_CACHE_DIR
  ? resolve(process.env.KP_CACHE_DIR)
  : join(REPO_ROOT, '.cache');

if (!existsSync(cacheDir)) {
  console.log(`cache:clear: ${cacheDir} does not exist — nothing to do.`);
  process.exit(0);
}

await rm(cacheDir, { recursive: true, force: true });
console.log(`cache:clear: removed ${cacheDir}`);
