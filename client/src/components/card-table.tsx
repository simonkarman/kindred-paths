"use client";

import { Card, cardRarities, cardSuperTypes, cardTypes, SerializedCard } from 'kindred-paths';
import { colorToTypographyColor, typographyColors } from '@/utils/typography';
import { useState } from 'react';
import { RarityText } from '@/components/rarity-text';
import { ManaCost } from '@/components/mana-cost';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClone, faFilter, faImage, faPenToSquare, faShieldCat, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { deleteCard } from '@/utils/server';
import { useDeckName } from '@/components/deck-name-setter';

type Filter = { name: string, predicate: (card: Card) => boolean };
type SortKey = 'collector-number' | 'mana-value' | 'name' | 'rarity' | 'types' | 'power' | 'toughness' | 'art' | 'tags' | 'tag:count';

const filterCategories: { category: string, filters: Filter[] }[] = [
  {
    category: 'Rarity',
    filters: cardRarities.map(cardRarity => ({
      name: `${cardRarity}s`,
      predicate: (card: Card) => card.rarity === cardRarity,
    })),
  },
  {
    category: 'Color',
    filters: Array.from(typographyColors.entries()).map(([tc]) => ({
      name: `${tc} cards`,
      predicate: (card: Card) => colorToTypographyColor(card.color()) === tc,
    })),
  },
  {
    category: 'Super Type',
    filters: cardSuperTypes.filter(s => s !== undefined).map(cardSuperType => ({
      name: cardSuperType,
      predicate: (card: Card) => card.supertype === cardSuperType,
    })),
  },
  {
    category: 'Type',
    filters: cardTypes.map(cardType => ({
      name: cardType.endsWith('y') ? `${cardType.slice(0, -1)}ies` : `${cardType}s`,
      predicate: (card: Card) => card.types.includes(cardType),
    })),
  },
  {
    category: 'Art',
    filters: [false, true].map(hasArt => ({
      name: hasArt ? 'Has Art' : 'No Art',
      predicate: (card: Card) => (card.art === undefined) === !hasArt,
    })),
  },
  {
    category: 'Tags',
    filters: ['status=concept', 'status=playable', '!status=playable', '!status', 'status'].map(_tag => {
      const isNegation = _tag.startsWith('!');
      const tag = isNegation ? _tag.slice(1) : _tag;
      const [tagName, expectedTagValue] = tag.split('=');
      const isEquation = expectedTagValue !== undefined;

      const name = isEquation
       ? (isNegation ? `not ${tagName}=${expectedTagValue}` : `${tagName}=${expectedTagValue}`)
       : (isNegation ? `no ${tagName}` : `has ${tagName}`);

      return {
        name,
        predicate: (card: Card) => {
          const cardTagValue = card.tags?.[tagName];
          let result;
          if (isEquation) {
            result = cardTagValue?.toString() === expectedTagValue;
          } else {
            result = cardTagValue !== undefined && cardTagValue !== false && cardTagValue !== '' && cardTagValue !== 0;
          }
          return isNegation ? !result : result;
        },
      };
    }),
  },
];

const tagsAsString = (tags: Card["tags"]) => {
  return tags
    ? Object.entries(tags)
      .filter(([tagName, tagValue]) => tagName !== "createdAt")
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([tagName, tagValue]) => tagValue === true ? tagName : `${tagName}=${tagValue}`)
      .join(', ')
    : '';
}

export const CardTable = (props: { cards: SerializedCard[] }) => {
  const deckName = useDeckName();
  const hasDeckName = deckName.length !== 0 && deckName !== '*';

  const [filters, setFilters] = useState<Filter[]>([]);
  const [showPossibleFilters, setShowPossibleFilters] = useState(false);
  const [sortKey, setSortKey] = useState<{ k: SortKey, d: 'asc' | 'desc' }>({ k: 'collector-number', d: 'asc' });
  const sortOn = (key: SortKey) => {
    if (sortKey.k === key) {
      setSortKey({ k: key, d: sortKey.d === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortKey({ k: key, d: 'asc' });
    }
  };

  const [deletedCardIds, setDeletedCardIds] = useState<string[]>([]);
  const del = (id: string) => {
    setDeletedCardIds(p => Array.from(new Set([...p, id])));
    deleteCard(id).catch(() => setDeletedCardIds(p => p.filter(cardId => cardId !== id)));
  };

  const cards = props.cards
    .filter(c => !deletedCardIds.includes(c.id))
    .filter(c => !hasDeckName || c.tags?.['deck'] === deckName)
    .map(serializedCard => new Card(serializedCard))
    .filter(c => !filters.some(filter => !filter.predicate(c)))
    .sort((a, b) => {
      if (sortKey.d === 'desc') {
        const temp = a;
        a = b;
        b = temp;
      }
      if (sortKey.k === 'collector-number') {
        return a.collectorNumber - b.collectorNumber;
      } else if (sortKey.k === 'mana-value') {
        if (a.manaValue() !== b.manaValue()) {
          return a.manaValue() - b.manaValue();
        }
        const colorlessA = a.manaCost['colorless'] ?? 0;
        const colorlessB = b.manaCost['colorless'] ?? 0;
        if (colorlessA !== colorlessB) {
          return -(colorlessA - colorlessB);
        }
        return a.renderManaCost().localeCompare(b.renderManaCost());
      } else if (sortKey.k === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortKey.k === 'rarity') {
        const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];
        return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
      } else if (sortKey.k === 'types') {
        const typeLineA = [...a.types, '-', a.supertype ?? ' ', '-', ...(a.subtypes ?? [])]
        const typeLineB = [...b.types, '-', b.supertype ?? ' ', '-', ...(b.subtypes ?? [])];
        return typeLineA.join(', ').localeCompare(typeLineB.join(', '));
      } else if (sortKey.k === 'power' || sortKey.k === 'toughness') {
        const powerA = a.pt?.power ?? 0;
        const powerB = b.pt?.power ?? 0;
        const toughnessA = a.pt?.toughness ?? 0;
        const toughnessB = b.pt?.toughness ?? 0;
        if (sortKey.k === 'power') {
          return powerA - powerB;
        } else {
          return toughnessA - toughnessB;
        }
      } else if (sortKey.k === 'art') {
        const aHasArt = a.art !== undefined && a.art.length > 0;
        const bHasArt = b.art !== undefined && b.art.length > 0;
        if (aHasArt && !bHasArt) {
          return -1; // a has art, b does not
        } else if (!aHasArt && bHasArt) {
          return 1; // b has art, a does not
        }
        return 0; // both have or both do not have art
      } else if (sortKey.k === 'tags') {
        const tagsA = tagsAsString(a.tags);
        const tagsB = tagsAsString(b.tags);
        return tagsA.localeCompare(tagsB)
      } else if (sortKey.k === 'tag:count') {
        const tagAsNumber = (c: Card, tagName: string) => {
          const tagValue = c.tags?.[tagName];
          if (typeof tagValue === 'number') {
            return tagValue;
          } else if (typeof tagValue === 'string' && !isNaN(Number(tagValue))) {
            return Number(tagValue);
          } else if (typeof tagValue === 'boolean') {
            return tagValue ? 1 : 0; // Treat boolean true as 1, false as 0
          } else if (tagValue === undefined || tagValue === null) {
            return 0.5;
          }
          return 99; // Default value for non-numeric tags
        }
        return tagAsNumber(a, 'count') - tagAsNumber(b, 'count');
      }
      return 0;
    });

  return <div>
    <div className="flex justify-between">
      <div className="flex items-start gap-3">
        <h2 className="font-bold text-lg mb-2">All Cards</h2>
        <Link
          className="inline-block text-xs bg-blue-600 text-white font-bold px-2 py-0.5 mt-1 rounded hover:bg-blue-800 active:bg-blue-900"
          href="/create?t=/"
        >
          Create New Card
        </Link>
      </div>
      <button
        className="bg-zinc-50 rounded border px-2 py-0.5 hover:bg-green-100 border-zinc-300 font-bold"
        onClick={() => setShowPossibleFilters(!showPossibleFilters)}
      >
        <FontAwesomeIcon icon={faFilter} className="text-zinc-400 pr-1" />
        Filters
      </button>
    </div>
    <div className="flex gap-2 items-center justify-end text-sm my-2">
      {filters.map(filter => {
        return <button
          key={filter.name}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-50 border-zinc-300 border text-sm"
        >
          <input type="checkbox" checked onChange={() => setFilters(filters.filter(f => f !== filter))} />
          {filter.name}
        </button>;
      })}
    </div>
    {showPossibleFilters && <div>
      <div className="flex flex-wrap justify-end gap-2">
        {filterCategories.map(category => (<ul
          key={category.category}
          className="flex flex-col gap-1 border rounded border-zinc-100 bg-zinc-50 py-1 px-1"
        >
          <li className="font-bold text-sm">
            <FontAwesomeIcon icon={faFilter} className="text-zinc-200 pr-1" />
            {category.category}
          </li>
          {category.filters.map(filter => (
            <li key={filter.name} className="flex items-center gap-1 px-1">
              <input
                type="checkbox"
                checked={filters.includes(filter)}
                onChange={() => {
                  if (filters.includes(filter)) {
                    setFilters(filters.filter(f => f !== filter));
                  } else {
                    setFilters([...filters, filter]);
                  }
                }}
              />
              {filter.name}
            </li>))}
        </ul>))}
      </div>
      <button
        className="mt-2 bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-sm font-bold"
        onClick={() => setShowPossibleFilters(false)}
      >
        Close
      </button>
    </div>}
    <ul className='flex flex-col items-start mb-5'>
      <li className="flex items-center px-2 border-b border-zinc-300 text-xs text-zinc-600">
        <span onClick={() => sortOn('mana-value')} data-is-active={sortKey.k === "mana-value"} className="data-[is-active=true]:font-bold inline-block text-right pr-2 w-24">Cost</span>
        <span onClick={() => sortOn('tag:count')} data-is-active={sortKey.k === "tag:count"} className="data-[is-active=true]:font-bold inline-block w-12 text-right pr-1.5">Count</span>
        <span onClick={() => sortOn('collector-number')} data-is-active={sortKey.k === "collector-number"} className="data-[is-active=true]:font-bold inline-block w-10 text-right pr-1.5">#</span>
        <span onClick={() => sortOn('name')} data-is-active={sortKey.k === "name"} className="data-[is-active=true]:font-bold inline-block w-74 border-r border-transparent mr-4">Name</span>
        <span onClick={() => sortOn('rarity')} data-is-active={sortKey.k === "rarity"} className="data-[is-active=true]:font-bold inline-block w-24">Rarity</span>
        <span onClick={() => sortOn('types')} data-is-active={sortKey.k === "types"} className="data-[is-active=true]:font-bold inline-block w-80">Types</span>
        <span className="inline-block w-8 text-center">
          <span onClick={() => sortOn('power')} data-is-active={sortKey.k === "power"} className="data-[is-active=true]:font-bold">P</span>
          /
          <span onClick={() => sortOn('toughness')} data-is-active={sortKey.k === "toughness"} className="data-[is-active=true]:font-bold">T</span>
        </span>
        <span onClick={() => sortOn('art')} data-is-active={sortKey.k === "art"} className="data-[is-active=true]:font-bold inline-block w-12 text-center">Art</span>
        <span className="inline-block w-8 text-center">Token</span>
      </li>
      {cards.map((card) => {
        return <li
          key={card.id}
          className="flex items-center px-2 py-0.5 border-t border-zinc-200 hover:bg-zinc-100"
        >
          <span className="inline-block w-24 pr-2 text-right"><ManaCost cost={card.renderManaCost()} /></span>
          <span className="inline-block w-12 text-xs text-right pr-1.5 text-zinc-500">{card.tags?.["count"] ?? 1}x</span>
          <span className="inline-block w-10 text-xs text-right pr-1.5 text-zinc-500">{card.collectorNumber}</span>
          <span className="inline-flex gap-2 justify-between pr-2 w-74 font-bold border-r border-zinc-200 mr-4">
            <Link
              className="hover:text-orange-700 active:text-orange-500"
              href={`/card/${card.id}`}
            >
              {card.name}
            </Link>
            <span className="flex gap-1">
              <Link
                className="text-zinc-600 hover:text-orange-700 active:text-orange-500"
                href={`/edit/${card.id}?t=/`}
              ><FontAwesomeIcon icon={faPenToSquare} /></Link>
              <Link
                className="text-zinc-600 hover:text-orange-700 active:text-orange-500"
                href={`/clone/${card.id}?t=/`}
              ><FontAwesomeIcon icon={faClone} /></Link>
              <button
                className="text-zinc-600 hover:text-red-700 active:text-red-500"
                onClick={() => del(card.id)}
              ><FontAwesomeIcon icon={faTrashCan} /></button>
              </span>
          </span>
          <span className="w-24 border-zinc-200"><RarityText rarity={card.rarity} /></span>
          <span className="inline-block w-80">{card.renderTypeLine()}</span>
          <span className="inline-block w-8 text-center">{card.pt ? `${card.pt.power}/${card.pt.toughness}` : ''}</span>
          <span className="inline-block w-12 text-center">{card.art
            ? <FontAwesomeIcon className="ml-2 text-zinc-400" icon={faImage} />
            : '-'
          }</span>
          <span className="inline-block w-8 text-center">{card.hasToken() ? <FontAwesomeIcon className="ml-2 text-zinc-400" icon={faShieldCat} /> : ''}</span>
        </li>
      })}
    </ul>
  </div>;
}
