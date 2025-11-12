"use client";

import { getStatistics, Layout, SerializedCard } from 'kindred-paths';
import Link from 'next/link';
import { CardRender } from '@/components/card-render';
import { useState } from 'react';
import { useDeckNameFromSearch } from '@/utils/use-search';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useLocalStorageState } from '@/utils/use-local-storage-state';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

export function VisualTab(props: {
  cards: SerializedCard[],
  dynamicLink?: (card: SerializedCard) => string,
}) {
  const deckName = useDeckNameFromSearch();
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

  return (
    <div className="space-y-6">
      {/* Controls Section */}
      <div className="print:hidden bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Display Options</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={renderTokens}
              onChange={() => setRenderTokens(p => !p)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
              Render Tokens
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
              Render Basic Lands
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">Zoom:</span>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(e.target.value)}
              className="rounded border border-slate-300 bg-white py-1 px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            >
              <option value={zoomLevels[0]}>100%</option>
              <option value={zoomLevels[1]}>75%</option>
              <option value={zoomLevels[2]}>50%</option>
            </select>
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
        {cardGroups.map((group) => group
          .map(card => n(respectDeckCount && deckName && typeof card.tags?.[`deck/${deckName}`] === 'number'
              ? card.tags[`deck/${deckName}`] as number
              : 1
            )
              .map(i => (
                (new Layout(card.layout.id).isDualRenderLayout() ? card.faces : card.faces.slice(0, 1))
                  .map((_, faceIndex) =>
                    <div
                      key={card.id + i + faceIndex.toString()}
                      className="print:border-3 print:bg-zinc-500"
                    >
                      <div className="hidden print:block">
                        <CardRender faceIndex={faceIndex} serializedCard={card.toJson()} scale={0.6} quality={80} />
                      </div>
                      <div className="block print:hidden">
                        <CardRender faceIndex={faceIndex} serializedCard={card.toJson()} hoverControls />
                      </div>
                    </div>
                  )
              ))
          ))}
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
