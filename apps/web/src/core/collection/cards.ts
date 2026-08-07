// Card collection read ops — pure node module (see docs/v2-architecture.md §10: files
// under src/core/ must not import next/* or Request/Response types).
//
// Ported from v1 server/src/services/card-service.ts (read path only; write ops land when
// the editor needs them in a later phase).

import { readdir, readFile } from 'node:fs/promises';
import { getCidFromFilename, SerializedCard, SerializedCardSchema } from '@kindred-paths/shared';
import { getCardsDir } from '../config';

async function findCardFilename(cid: string): Promise<string | undefined> {
  const dir = getCardsDir();
  const files = await readdir(dir);
  return files.find(file => getCidFromFilename(file) === cid);
}

export async function getCardByCid(cid: string): Promise<SerializedCard | undefined> {
  const file = await findCardFilename(cid);
  if (!file) return undefined;
  const text = await readFile(`${getCardsDir()}/${file}`, 'utf-8');
  const json = { ...JSON.parse(text), cid };
  const result = SerializedCardSchema.safeParse(json);
  return result.success ? result.data : undefined;
}

// The collection is ~900 files today; parsing all of them (readdir + 900 reads + zod
// parses) on every request is wasteful when the overview/`/api/cards` route can be hit
// repeatedly in quick succession (initial load, a "?q=" bookmark, a manual refresh). A
// short TTL memo is enough to absorb that burst without going stale for long — cards are
// edited by the (not-yet-built) in-app editor or external tools, not by this route, so a
// few seconds of staleness is an acceptable tradeoff for not re-reading the whole
// collection on every request. Cached on globalThis so Next dev's fast-refresh module
// reloads don't defeat the memo.
const MEMO_TTL_MS = 3000;
const globalForCards = globalThis as unknown as {
  __kpAllCardsMemo?: { at: number; promise: Promise<SerializedCard[]> };
};

async function readAllCardsFromDisk(): Promise<SerializedCard[]> {
  const dir = getCardsDir();
  const filenames = await readdir(dir);
  const cards = await Promise.all(filenames.map(async (filename) => {
    const cid = getCidFromFilename(filename);
    if (!cid) return undefined;
    const text = await readFile(`${dir}/${filename}`, 'utf-8');
    const json = { ...JSON.parse(text), cid };
    const result = SerializedCardSchema.safeParse(json);
    return result.success ? result.data : undefined;
  }));
  return cards.filter((c): c is SerializedCard => c !== undefined);
}

export async function getAllCards(): Promise<SerializedCard[]> {
  const memo = globalForCards.__kpAllCardsMemo;
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) {
    return memo.promise;
  }
  const promise = readAllCardsFromDisk();
  globalForCards.__kpAllCardsMemo = { at: Date.now(), promise };
  // If reading fails, don't leave a poisoned memo entry behind for the full TTL window.
  promise.catch(() => { globalForCards.__kpAllCardsMemo = undefined; });
  return promise;
}

// Cards soft-deleted via `tags.deleted = true` stay on disk (recoverable) but should never
// show up in the overview — matches v1's `getCards()` filter in client/src/utils/api.ts.
export async function getVisibleCards(): Promise<SerializedCard[]> {
  const cards = await getAllCards();
  return cards.filter(card => card.tags?.deleted !== true);
}

