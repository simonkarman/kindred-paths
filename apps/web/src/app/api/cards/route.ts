// GET /api/cards — the full visible collection (soft-deleted cards excluded), as plain
// SerializedCard JSON. Consumed client-side by the overview grid, which does its own
// filtering via the search DSL (@kindred-paths/shared's filterCardsBasedOnSearch) — this
// route intentionally does no query/filter handling of its own (out of scope for Phase 1c;
// see docs/v2-architecture.md §9 for the eventual search-DSL-everywhere direction).

import { NextResponse } from 'next/server';
import { getVisibleCards } from '@/core/collection/cards';

export async function GET() {
  const cards = await getVisibleCards();
  return NextResponse.json(cards, {
    headers: {
      // Cheap client-side caching for the lifetime of a tab session; the core module's own
      // short TTL memo (apps/web/src/core/collection/cards.ts) keeps the server side fresh
      // enough without re-reading ~900 files on every request.
      'Cache-Control': 'public, max-age=5, must-revalidate',
    },
  });
}
