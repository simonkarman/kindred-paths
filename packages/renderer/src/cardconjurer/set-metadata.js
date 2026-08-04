// Set-metadata resolver for CardConjurer. Given a Card, returns the metadata CardConjurer
// needs to render the collector info block (author, shortName, collectorNumberOffset) and
// the set symbol (the `symbol` string CC's #set-symbol-code accepts).
//
// Ported verbatim from v1 server/src/services/symbol-service.ts:29-75, with two adaptations:
//   - Uses KP_COLLECTION_PATH env var (default: <repo>/collection) instead of v1's
//     `configuration.symbolDir`. Falls back to symbols/ under collection.
//   - Returns a plain object (no zod schema); we trust the metadata file's shape as v1 does.
//
// SVG symbol RASTERIZATION (via sharp/librsvg) is implemented in hosts/node-handle.js
// (see line 139+). This module only tells CC which symbol string to use; decoding happens
// in the host.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/renderer/src/cardconjurer/ → repo root is 4 levels up
const REPO_ROOT = resolve(HERE, '../../../..');

function symbolsDir() {
  return process.env.KP_COLLECTION_PATH
    ? join(process.env.KP_COLLECTION_PATH, 'symbols')
    : join(REPO_ROOT, 'collection/symbols');
}

const UnknownSet = () => ({
  shortName: 'SET',
  author: 'Simon Karman',
  theme: 'simple',
});

/**
 * Look up the CardConjurer set metadata for a Card (or card-shaped JSON). Returns author,
 * shortName, symbol (CC url fragment), collectorNumberOffset, theme.
 *
 * @param {any} cardOrJson  a Card instance or the JSON that would be passed to new Card()
 * @returns {{ author: string, shortName: string, symbol?: string, collectorNumberOffset?: number, theme: string }}
 */
export function getSetMetadataForCard(cardOrJson) {
  const tags = cardOrJson.tags ?? {};
  const rarity = cardOrJson.rarity ?? 'common';

  const shortName = typeof tags.set === 'string' && tags.set.length === 3
    ? tags.set.toLowerCase()
    : undefined;

  const unknown = UnknownSet();
  if (!shortName) return unknown;

  const dir = symbolsDir();
  const metaPath = join(dir, `${shortName}-metadata.json`);
  let onDisk;
  if (existsSync(metaPath)) {
    try { onDisk = JSON.parse(readFileSync(metaPath, 'utf-8')); }
    catch { /* v1 warns; we silently fall back to unknown metadata */ }
  }

  const rarityLetter = rarity[0];
  const customSymbolPath = join(dir, `${shortName}-${rarityLetter}.svg`);
  const hasCustomSymbol = existsSync(customSymbolPath);

  let author = onDisk?.author ?? unknown.author;
  const authorTag = tags.author;
  if (authorTag && typeof authorTag === 'string' && authorTag.trim().length > 0) {
    author = authorTag;
  }

  return {
    author,
    shortName: shortName.toUpperCase(),
    symbol: hasCustomSymbol ? `custom/${shortName}` : shortName,
    collectorNumberOffset: onDisk?.collectorNumberOffset,
    theme: onDisk?.theme ?? unknown.theme,
  };
}
