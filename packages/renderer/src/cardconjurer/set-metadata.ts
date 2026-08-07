// Set-metadata resolver for CardConjurer. Given a Card, returns the metadata CardConjurer
// needs to render the collector info block (author, shortName, collectorNumberOffset) and
// the set symbol (the `symbol` string CC's #set-symbol-code accepts).
//
// Ported verbatim from v1 server/src/services/symbol-service.ts:29-75, with two adaptations:
//   - Uses KP_COLLECTION_PATH env var (default: <repo>/collection) instead of v1's
//     `configuration.symbolDir`. Falls back to symbols/ under collection.
//   - Returns a plain object (no zod schema); we trust the metadata file's shape as v1 does.
//
// SVG symbol RASTERIZATION (via sharp/librsvg) is implemented in hosts/node-handle.ts
// (see line 139+). This module only tells CC which symbol string to use; decoding happens
// in the host.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/renderer/dist/cardconjurer/ → repo root is 4 levels up (matches src/ layout too).
const REPO_ROOT = resolve(HERE, '../../../..');

function symbolsDir(): string {
  return process.env.KP_COLLECTION_PATH
    ? join(process.env.KP_COLLECTION_PATH, 'symbols')
    : join(REPO_ROOT, 'collection/symbols');
}

export type SetMetadata = {
  author: string;
  shortName: string;
  symbol?: string;
  collectorNumberOffset?: number;
  theme: string;
};

const UnknownSet = (): SetMetadata => ({
  shortName: 'SET',
  author: 'Simon Karman',
  theme: 'simple',
});

type SetOnDisk = {
  author?: string;
  collectorNumberOffset?: number;
  theme?: string;
};

type CardTagsLike = {
  set?: unknown;
  author?: unknown;
  [key: string]: unknown;
};

type CardMetadataInput = {
  tags?: CardTagsLike;
  rarity?: string;
};

/**
 * Look up the CardConjurer set metadata for a Card (or card-shaped JSON). Returns author,
 * shortName, symbol (CC url fragment), collectorNumberOffset, theme.
 */
export function getSetMetadataForCard(cardOrJson: CardMetadataInput): SetMetadata {
  const tags = cardOrJson.tags ?? {};
  const rarity = cardOrJson.rarity ?? 'common';

  const shortName = typeof tags.set === 'string' && tags.set.length === 3
    ? (tags.set as string).toLowerCase()
    : undefined;

  const unknown = UnknownSet();
  if (!shortName) return unknown;

  const dir = symbolsDir();
  const metaPath = join(dir, `${shortName}-metadata.json`);
  let onDisk: SetOnDisk | undefined;
  if (existsSync(metaPath)) {
    try {
      onDisk = JSON.parse(readFileSync(metaPath, 'utf-8')) as SetOnDisk;
    } catch {
      /* v1 warns; we silently fall back to unknown metadata */
    }
  }

  const rarityLetter = rarity[0];
  const customSymbolPath = join(dir, `${shortName}-${rarityLetter}.svg`);
  const hasCustomSymbol = existsSync(customSymbolPath);

  let author = onDisk?.author ?? unknown.author;
  const authorTag = tags.author;
  if (typeof authorTag === 'string' && authorTag.trim().length > 0) {
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
