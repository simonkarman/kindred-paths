import type { Metadata } from 'next';
import { filterCardsBasedOnSearch } from '@kindred-paths/shared';
import { getVisibleCards } from '@/core/collection/cards';
import { CardGrid } from './card-grid';

const IS_STATIC = process.env.NEXT_PUBLIC_KP_STATIC === 'true';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  // Static export can't read per-request searchParams at build time; the client picks
  // up ?q= from window.location on mount instead (see CardGrid).
  if (IS_STATIC) return {};
  const { q } = await searchParams;
  if (!q || !q.trim()) return {};
  return { title: q };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Static export: no searchParams access; CardGrid reads ?q= client-side on mount.
  const q = IS_STATIC ? '' : (await searchParams).q;

  // Read the full visible collection at build/request time (server component). In dynamic
  // mode this is the whole collection; in static mode (export) it's pre-filtered to only
  // the subset the export was invoked with, so the shipped HTML contains only the cards
  // that are actually reachable via detail pages. See docs/v2-phase1d-static-export.md §5.2.
  let initialCards = await getVisibleCards();
  const exportQuery = process.env.KP_STATIC_EXPORT_QUERY;
  if (IS_STATIC && exportQuery && exportQuery.trim()) {
    try {
      initialCards = filterCardsBasedOnSearch(initialCards, exportQuery);
    } catch {
      // If the export query is invalid, fall through to the unfiltered collection rather
      // than silently emitting an empty site — the export script validates the query up
      // front too, so this is a belt-and-braces fallback.
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
      <CardGrid initialQuery={q ?? ''} initialCards={initialCards} />
    </main>
  );
}
