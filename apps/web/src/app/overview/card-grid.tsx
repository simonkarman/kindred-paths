'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { filterCardsBasedOnSearch, type SerializedCard } from '@kindred-paths/shared';

const BATCH_SIZE = 48;

function typeLine(face: SerializedCard['faces'][number]): string {
  const parts = [
    face.supertype,
    ...face.types,
    ...(face.subtypes && face.subtypes.length > 0 ? ['—', ...face.subtypes] : []),
  ].filter(Boolean);
  return parts.join(' ');
}

function CardTile({ card }: { card: SerializedCard }) {
  const [loaded, setLoaded] = useState(false);
  const face = card.faces[0];

  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-[488/684] w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-800" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/render/${card.cid}/0?variant=thumb`}
          alt={face.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <span className="truncate text-sm font-medium">{face.name}</span>
      <span className="truncate text-xs text-neutral-400">{typeLine(face)}</span>
    </div>
  );
}

export function CardGrid({ initialQuery }: { initialQuery: string }) {
  const pathname = usePathname();

  const [allCards, setAllCards] = useState<SerializedCard[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load the full (visible) collection once, client-side — the search box then filters
  // in-memory with zero network round-trips per keystroke.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/cards')
      .then((res) => {
        if (!res.ok) throw new Error(`failed to load cards (${res.status})`);
        return res.json() as Promise<SerializedCard[]>;
      })
      .then((data) => { if (!cancelled) setAllCards(data); })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'failed to load cards'); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!allCards) return [];
    if (!query.trim()) return allCards;
    try {
      return filterCardsBasedOnSearch(allCards, query);
    } catch {
      // An invalid/partial query (e.g. a trailing "tag:") should never blank the grid.
      return allCards;
    }
  }, [allCards, query]);

  // A new search resets how far the progressive reveal has scrolled.
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [query, allCards]);

  const visibleCards = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Progressive reveal: grow the visible window as the sentinel scrolls near the viewport,
  // instead of mounting (and rendering <img> tags for) the whole collection at once.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount((count) => count + BATCH_SIZE);
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  // The search box is pure client state — never routed through the server (no
  // router.replace / RSC refetch), so typing never fights a re-render for caret position.
  // The URL still updates (via the native History API) for shareable/bookmarkable links,
  // debounced so fast typing doesn't spam history entries.
  const updateQuery = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const search = value ? `?q=${encodeURIComponent(value)}` : '';
      window.history.replaceState(null, '', `${pathname}${search}`);
    }, 250);
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder='Search (e.g. "tag:golden", "color:red", "type:creature")'
        className="mb-6 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
      />

      {loadError && (
        <p className="mb-4 text-sm text-red-400">Failed to load cards: {loadError}</p>
      )}
      {!allCards && !loadError && (
        <p className="mb-4 text-sm text-neutral-400">Loading collection…</p>
      )}
      {allCards && (
        <p className="mb-4 text-sm text-neutral-400">
          {filtered.length} of {allCards.length} card{allCards.length === 1 ? '' : 's'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleCards.map((card) => (
          <CardTile key={card.cid} card={card} />
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  );
}
