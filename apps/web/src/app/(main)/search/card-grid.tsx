'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { filterCardsBasedOnSearch, Layout, type SerializedCard } from '@kindred-paths/shared';
import { FlipButton } from '@/components/flip-button';

const BATCH_SIZE = 48;

function CardTile({ card }: { card: SerializedCard }) {
  const [loaded, setLoaded] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);
  const isDual = useMemo(() => new Layout(card.layout).isDualRenderLayout(), [card.layout]);
  const face = card.faces[faceIndex] ?? card.faces[0];
  const href = faceIndex === 0 ? `/card/${card.cid}` : `/card/${card.cid}?face=${faceIndex}`;

  return (
    <Link
      href={href}
      className="group relative block aspect-[488/684] w-full"
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg border border-line bg-navy-50 shadow-sm transition-shadow group-hover:shadow-md">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-navy-100" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={faceIndex}
          src={`/api/render/${card.cid}/${faceIndex}?variant=thumb`}
          alt={face.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {isDual && (
        <FlipButton
          className="absolute -right-1.5 top-11.5 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLoaded(false);
            setFaceIndex((i) => (i + 1) % card.faces.length);
          }}
        />
      )}
    </Link>
  );
}

export function CardGrid({ initialQuery }: { initialQuery: string }) {
  const [allCards, setAllCards] = useState<SerializedCard[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // The header's search bar drives navigation (?q=...); when it changes, sync local state.
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

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

  return (
    <div>
      {loadError && (
        <p className="mb-4 text-sm text-red-600">Failed to load cards: {loadError}</p>
      )}
      {!allCards && !loadError && (
        <p className="mb-4 text-sm text-muted">Loading collection…</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleCards.map((card) => (
          <CardTile key={card.cid} card={card} />
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-1" />}

      {allCards && (
        <p className="w-full text-right text-sm text-muted mt-4">
          {filtered.length} of {allCards.length} card{allCards.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
