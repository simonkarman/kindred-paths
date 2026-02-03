"use client";

import { getStatistics, Layout, SerializedCard, sort, SortKey, sortKeys } from 'kindred-paths';
import Link from 'next/link';
import { CardRender } from '@/components/card-render';
import { useEffect, useRef, useState } from 'react';
import { replaceKeysInSearchText, useDeckNameFromSearch, useSearch, useSortOptions } from '@/utils/use-search';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDownWideShort,
  faArrowUpWideShort, faChevronLeft,
  faSquare,
  faTableCells,
  faTableCellsLarge,
  faTriangleExclamation, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useLocalStorageState } from '@/utils/use-local-storage-state';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

// Helper to normalize key to array for easier manipulation
const getKeysArray = (key: SortKey | SortKey[]): SortKey[] =>
  Array.isArray(key) ? key : [key];

// Helper to convert back - single value if length 1, otherwise array
const normalizeKeys = (keys: SortKey[]): SortKey | SortKey[] =>
  keys.length === 1 ? keys[0] : keys;

export function VisualTab(props: {
  cards: SerializedCard[],
  dynamicLink?: (card: SerializedCard) => string,
}) {
  const deckName = useDeckNameFromSearch();
  const [, setSearchText] = useSearch('home');
  const [sortOptions, setSortOptions] = useSortOptions('home');

  const {
    cardsWithoutTokensAndBasicLands,
    basicLands,
    tokens,
    cardsWithZeroCount,
  } = getStatistics(props.cards, deckName);
  const [renderTokens, setRenderTokens] = useState(true);
  const [renderBasicLands, setRenderBasicLands] = useState(true);
  const [respectDeckCount, setRespectDeckCount] = useState(true);
  const zoomLevels = [
    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
    'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3',
    'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
  ];
  const [zoomLevel, setZoomLevel] = useLocalStorageState('visual-tab/zoom', zoomLevels[0]);


  const cardGroups = [cardsWithoutTokensAndBasicLands];
  if (renderBasicLands) {
    cardGroups.push(basicLands);
  }
  if (renderTokens) {
    cardGroups.push(tokens);
  }

  const totalTokens = tokens.reduce((a, c) => a + (c.getTagAsNumber(`deck/${deckName}`) ?? 0), 0);
  const totalBasicLands = basicLands.reduce((a, c) => a + (c.getTagAsNumber(`deck/${deckName}`) ?? 0), 0);

  const [isPrint, setIsPrint] = useState(false);
  useEffect(() => {
    const handleBeforePrint = () => setIsPrint(true);
    const handleAfterPrint = () => setIsPrint(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const flatMapCards = cardGroups
    .flatMap(group => sort(group, { ...sortOptions, deckName })
      .flatMap(card => {
        return n(respectDeckCount && deckName && typeof card.tags?.[`deck/${deckName}`] === 'number'
          ? card.tags[`deck/${deckName}`] as number
          : ((isPrint && card.isToken === true )? 9 : 1)
        ).map((_, index) => ({ index, card }));
      })
    );
  const [numberOfCardsToShow, setNumberOfCardsToShow] = useState(12);
  const cardsToShow = flatMapCards.slice(
    0,
    isPrint
      ? flatMapCards.length
      : (flatMapCards.length - numberOfCardsToShow < 3 ? flatMapCards.length : numberOfCardsToShow));
  const hasMoreCards = flatMapCards.length > numberOfCardsToShow;

  // Load More Button Ref
  const [autoLoadMore, setAutoLoadMore] = useLocalStorageState('home/visual-auto-load', true);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || isPrint || !autoLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setNumberOfCardsToShow((n) => n + 12);
          }
        });
      },
      { threshold: 1.0 }
    );

    observer.observe(target);

    return () => {
      if (target) { observer.unobserve(target); }
    };
  }, [isPrint, autoLoadMore, numberOfCardsToShow]);

  // When card list changes, reset number of cards to show
  useEffect(() => {
    setNumberOfCardsToShow(12);
  }, [props.cards]);

  const availableDeckNames = [...new Set(flatMapCards
    .flatMap(c => Object.entries(c.card.tags)
      .filter(([tagName]) => tagName.startsWith('deck/'))
      .map(([tagName]) => tagName.replace('deck/', ''))
    )
  )].toSorted();

  const setSelectedDeck = (name: string) => {
    setSearchText(text => replaceKeysInSearchText(text, ['deck', 'd'], name || undefined));
  }

  return (
    <div className="space-y-6">
      {/* Controls Section */}
      <div className="print:hidden bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Display Options</h3>
        <div className="flex flex-wrap flex-col sm:flex-row justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={renderTokens}
              onChange={() => setRenderTokens(p => !p)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
              Tokens
              <span className="text-slate-500 ml-1">
                ({tokens.length} unique, {totalTokens} total)
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={renderBasicLands}
              onChange={() => setRenderBasicLands(p => !p)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
              Basic Lands
              <span className="text-slate-500 ml-1">
                ({basicLands.length} unique, {totalBasicLands} total)
              </span>
            </span>
          </label>

          {deckName && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={respectDeckCount}
                onChange={() => setRespectDeckCount(p => !p)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                Respect Deck Count
              </span>
            </label>
          )}

          {availableDeckNames.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Deck:</span>
              <select
                value={deckName}
                onChange={(e) => setSelectedDeck(e.target.value)}
                className="rounded border border-slate-300 bg-white py-1 px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              >
                <option value="">None</option>
                {availableDeckNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={autoLoadMore}
              onChange={() => setAutoLoadMore(!autoLoadMore)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
              Auto Load
            </span>
          </label>
        </div>
        <div className="flex flex-wrap flex-col sm:flex-row justify-between gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">Zoom:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel(zoomLevels[0])}
                className={`py-1 px-2 rounded transition-colors ${
                  zoomLevel === zoomLevels[0]
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Bigger Cards, Less Cards"
              >
                <FontAwesomeIcon icon={faSquare} className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(zoomLevels[1])}
                className={`py-1 px-2 rounded transition-colors ${
                  zoomLevel === zoomLevels[1]
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Balanced"
              >
                <FontAwesomeIcon icon={faTableCellsLarge} className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(zoomLevels[2])}
                className={`py-1 px-2 rounded transition-colors ${
                  zoomLevel === zoomLevels[2]
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="More Cards, Small Cards"
              >
                <FontAwesomeIcon icon={faTableCells} className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">Sort:</span>
            <div className="flex items-center flex-wrap gap-1">
              {getKeysArray(sortOptions.key).map((sortKey, index) => {
                const keysArray = getKeysArray(sortOptions.key);

                return (
                  <div
                    key={sortKey}
                    className="flex items-center bg-blue-500 text-white rounded text-sm overflow-hidden"
                  >
                    <span className="px-2 py-1">
                      {keysArray.length > 1 && `${index + 1}. `}{sortKey}
                    </span>
                    {keysArray.length > 1 && (
                      <button
                        onClick={() => {
                          if (index > 0) {
                            const newKeys = [...keysArray];
                            [newKeys[index - 1], newKeys[index]] = [newKeys[index], newKeys[index - 1]];
                            setSortOptions({ ...sortOptions, key: normalizeKeys(newKeys) });
                          }
                        }}
                        disabled={index === 0}
                        className="px-1 py-1 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Increase priority"
                      >
                        <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                      </button>
                    )}
                    {keysArray.length > 1 && (
                      <button
                        onClick={() => {
                          const newKeys = keysArray.filter(k => k !== sortKey);
                          setSortOptions({
                            ...sortOptions,
                            key: normalizeKeys(newKeys)
                          });
                        }}
                        className="px-1 py-1 hover:bg-blue-600"
                        title="Remove"
                      >
                        <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {sortKeys.filter(k => !getKeysArray(sortOptions.key).includes(k)).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const keysArray = getKeysArray(sortOptions.key);
                    setSortOptions({
                      ...sortOptions,
                      key: normalizeKeys([...keysArray, e.target.value as SortKey])
                    });
                  }
                }}
                className="rounded border border-slate-300 bg-white py-1 px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">+ Add...</option>
                {sortKeys
                  .filter(k => !getKeysArray(sortOptions.key).includes(k))
                  .map(sortKey => (
                    <option key={sortKey} value={sortKey}>{sortKey}</option>
                  ))}
              </select>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortOptions({ ...sortOptions, direction: 'asc' })}
                className={`py-1 px-2 rounded transition-colors ${
                  sortOptions.direction === 'asc'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Ascending"
              >
                <FontAwesomeIcon icon={faArrowDownWideShort} className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSortOptions({ ...sortOptions, direction: 'desc' })}
                className={`py-1 px-2 rounded transition-colors ${
                  sortOptions.direction === 'desc'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Descending"
              >
                <FontAwesomeIcon icon={faArrowUpWideShort} className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Box for Zero Count Cards */}
      {respectDeckCount && cardsWithZeroCount.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-amber-600 text-lg mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">
                Cards Not Rendered
              </h4>
              <p className="text-sm text-amber-800 mb-2">
                The following cards have a deck count of 0 and are not displayed:
              </p>
              <ul className="space-y-1">
                {cardsWithZeroCount.map(card => (
                  <li key={card.id}>
                    <Link
                      href={props.dynamicLink ? props.dynamicLink(card.toJson()) : `/card/${card.id}`}
                      className="text-sm text-amber-900 hover:text-amber-700 underline decoration-amber-300 hover:decoration-amber-500 transition-colors font-medium"
                    >
                      {card.faces.map(f => f.name).join(' // ')}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div className={`grid ${zoomLevel} print:gap-0 print:grid-cols-3`}>
        {cardsToShow.map(({ index, card }) => (
          (new Layout(card.layout.id).isDualRenderLayout() ? card.faces : card.faces.slice(0, 1))
            .map((_, faceIndex) =>
              <div
                key={card.id + index + faceIndex.toString()}
                className="print:border-3 print:bg-zinc-500"
              >
                <CardRender
                  faceIndex={faceIndex}
                  serializedCard={card.toJson()}
                  scale={isPrint ? 0.6 : undefined}
                  quality={isPrint ? 80 : undefined}
                  hoverControls={!isPrint}
                />
              </div>
            )
        ))}

        {/* Load More Placeholders */}
        {!isPrint && hasMoreCards && (n(6).filter(i => cardsToShow.length + i <= flatMapCards.length ).map(i => (
          <div
            key={i}
            className="text-center rounded-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 animate-pulse duration-[10s] bg-neutral-300" />
            {/* Load More Button (only shown on the first placeholder) */}
            {i === 1 && (<div className="aspect-[63/88] flex items-center justify-center ">
              <button
                ref={loadMoreRef}
                onClick={() => setNumberOfCardsToShow(n => n + 12)}
                className="relative inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer"
              >
                Load More Cards
              </button>
            </div>)}
          </div>
        )))}
      </div>

      {/* Empty State */}
      {cardGroups.every(group => group.length === 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-500">No cards to display</p>
        </div>
      )}
    </div>
  );
}
