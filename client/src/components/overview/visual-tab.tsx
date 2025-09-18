"use client";

import { Card, getStatistics, SerializedCard } from 'kindred-paths';
import Link from 'next/link';
import { CardRender } from '@/components/card-render';
import { useState } from 'react';
import { useDeckNameFromSearch } from '@/utils/use-search';

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

  const cardGroups = [cardsWithoutTokensAndBasicLands];
  if (renderBasicLands) {
    cardGroups.push(basicLands);
  }
  if (renderTokens) {
    cardGroups.push(tokens);
  }

  return <>
    <div className="mb-4 flex gap-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={renderTokens}
          onChange={() => setRenderTokens(p => !p)}
          className="h-4 w-4"
        />
        Render Tokens ({tokens.length} unique designs, {tokens.reduce((a, c) => a + (new Card(c).getTagAsNumber("count") ?? 0), 0)} cards total)
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={renderBasicLands}
          onChange={() => setRenderBasicLands(p => !p)}
          className="h-4 w-4"
        />
        Render Basic Lands ({basicLands.length} unique designs, {basicLands.reduce((a, c) => a + (new Card(c).getTagAsNumber("count") ?? 0), 0)} cards total)
      </label>
      {deckName &&
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={respectDeckCount}
            onChange={() => setRespectDeckCount(p => !p)}
            className="h-4 w-4"
          />
          Respect Deck Count
        </label>
      }
    </div>
    {/* Show warning box with links to cards with a count of 0, when respect card count is enabled */}
    {respectDeckCount && cardsWithZeroCount.length > 0 && <div
      className="mb-4 rounded border border-yellow-400 bg-yellow-50 p-4 text-yellow-800"
    >
      <strong>Warning:</strong>{' '}
      The following cards are not rendered as they are part of the deck, but have a deck count of 0.
      <ul>
        {cardsWithZeroCount.map(card => (
          <li key={card.id}>
            <Link
              key={card.id}
              href={props.dynamicLink ? props.dynamicLink(card) : `/card/${card.id}`}
              className="text-yellow-800 underline"
            >
              {card.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>}
    <hr className="break-after-page border-gray-200" />
    <div className="grid grid-cols-3">
      {cardGroups.map((group) => group
        .map(card => n(respectDeckCount && deckName && typeof card.tags?.[`deck/${deckName}`] === 'number'
            ? card.tags[`deck/${deckName}`] as number
            : 1
          )
          .map(i => <Link
              key={card.id + i}
              className="border-3 bg-zinc-500"
              href={props.dynamicLink ? props.dynamicLink(card) : `/card/${card.id}`}
            >
              <div className="hidden print:block">
                <CardRender serializedCard={card} scale={0.6} quality={80} />
              </div>
              <div className="block print:hidden">
                <CardRender serializedCard={card} />
              </div>
            </Link>
          )
        ))}
    </div>
  </>
}
