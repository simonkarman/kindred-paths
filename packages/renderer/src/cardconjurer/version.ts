// Computes the CardConjurer node bridge's invalidation token — see ../interface.ts's
// `Renderer.version` doc for what this is used for (cache-key derivation in ../cache.ts's
// `withCache`).
//
// The version is an 8-char sha1 of the concatenated contents of every source file under this
// directory (cardconjurer/**/*.{ts,js}), computed once per process and memoized. Any change
// here — driver.ts logic, the host adapters, renderable.ts mapping, frame/set-metadata data,
// or a CC pin bump in pin.ts — changes the hash, which changes every cache key downstream,
// which means every previously-cached PNG becomes an automatic cache miss on next access. No
// manual "bump the version" step, no stale hits.
//
// Scope note: only files *under this directory* are covered. Changes to sibling files that
// affect render output but live outside cardconjurer/ (currently none) would not be caught —
// keep renderer-affecting code inside this directory, or extend the scan below if that changes.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARDCONJURER_DIR = dirname(fileURLToPath(import.meta.url));

/** Recursively collects every `.js` file path under `dir`, sorted for stable hash input. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (entry.endsWith('.js')) {
      // Runs against the compiled dist/ tree — hashing the emitted JS is what actually
      // determines cache identity (source .ts files aren't shipped to consumers).
      out.push(full);
    }
  }
  return out;
}

let memoized: string | null = null;

/**
 * Returns the memoized 8-char sha1 of every `cardconjurer/**\/*.js` file's contents (this
 * file included). Safe to call repeatedly — computed once per process.
 */
export function computeCardconjurerVersion(): string {
  if (memoized) return memoized;
  const hash = createHash('sha1');
  for (const file of collectSourceFiles(CARDCONJURER_DIR)) {
    hash.update(file);       // path included so a rename also changes the hash
    hash.update(readFileSync(file));
  }
  memoized = hash.digest('hex').slice(0, 8);
  return memoized;
}
