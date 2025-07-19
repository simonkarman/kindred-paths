"use client";

import { Card, cardRarities, cardSuperTypes, cardTypes, SerializedCard } from 'kindred-paths';
import { colorToTypographyColor, typographyColors } from '@/utils/typography';
import { useState } from 'react';
import { RarityText } from '@/components/rarity-text';
import { ManaCost } from '@/components/mana-cost';

type Filter = { name: string, predicate: (card: Card) => boolean };
type SortKey = 'collector-number' | 'mana-value' | 'name' | 'rarity' | 'types' | 'power' | 'toughness' | 'art' | 'tags';

const filterCategories: { category: string, filters: Filter[] }[] = [
  {
    category: 'Color',
    filters: Array.from(typographyColors.entries()).map(([tc]) => ({
      name: `${tc} cards`,
      predicate: (card: Card) => colorToTypographyColor(card.color()) === tc,
    })),
  },
  {
    category: 'Type',
    filters: cardTypes.map(cardType => ({
      name: cardType.endsWith('y') ? `${cardType.slice(0, -1)}ies` : `${cardType}s`,
      predicate: (card: Card) => card.types.includes(cardType),
    }))
  },
  {category: 'Rarity', filters: cardRarities.map(cardRarity => ({
      name: `${cardRarity}s`,
      predicate: (card: Card) => card.rarity === cardRarity,
    }))},
  {
    category: 'Super Type',
    filters: cardSuperTypes.filter(s => s !== undefined).map(cardSuperType => ({
      name: cardSuperType,
      predicate: (card: Card) => card.supertype === cardSuperType,
    }))
  },
];

const tagsAsString = (tags: Card["tags"]) => {
  return tags
    ? Object.entries(tags)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([tagName, tagValue]) => tagValue === true ? tagName : `${tagName}=${tagValue}`)
      .join(', ')
    : '';
}

export const CardTable = (props: { cards: SerializedCard[] }) => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [showPossibleFilters, setShowPossibleFilters] = useState(false);
  const [sortKey, setSortKey] = useState<{ k: SortKey, d: 'asc' | 'desc' }>({ k: 'name', d: 'asc' });
  const sortOn = (key: SortKey) => {
    if (sortKey.k === key) {
      setSortKey({ k: key, d: sortKey.d === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortKey({ k: key, d: 'asc' });
    }
  };

  const cards = props.cards
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
      }
      return 0;
    });

  return <>
    <div className="absolute -mt-9 flex gap-2 items-center justify-end w-274 text-sm mb-2">
      {filters.map(filter => {
        return <button
          key={filter.name}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-50 border-gray-300 border text-sm"
        >
          <input type="checkbox" checked onChange={() => setFilters(filters.filter(f => f !== filter))} />
          {filter.name}
        </button>;
      })}
      <button
        className="bg-zinc-50 rounded border px-2 py-0.5 hover:bg-green-100 border-gray-300 font-bold"
        onClick={() => setShowPossibleFilters(!showPossibleFilters)}
      >
        Filters
      </button>
    </div>
    {showPossibleFilters && <div className="bg-zinc-50 p-2 rounded border border-zinc-300 mb-2 w-274">
      <h3 className="font-bold text-sm mb-1">Filters</h3>
      <div className="flex flex-wrap justify-start gap-2">
        {filterCategories.map(category => (<ul
          key={category.category}
          className="flex flex-col gap-1 border rounded border-gray-200 bg-zinc-100 py-1 px-3"
        >
          <li className="font-bold text-sm underline">{category.category}</li>
          {category.filters.map(filter => (
            <li key={filter.name} className="flex items-center gap-1">
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
    <ul className='flex flex-col items-start'>
      <li className="flex items-center px-2 border-b border-gray-300 text-xs text-gray-600">
        <span onClick={() => sortOn('collector-number')} data-is-active={sortKey.k === "collector-number"} className="data-[is-active=true]:font-bold inline-block w-8">#</span>
        <span onClick={() => sortOn('rarity')} data-is-active={sortKey.k === "rarity"} className="data-[is-active=true]:font-bold inline-block w-24 border-r border-transparent">Rarity</span>
        <span onClick={() => sortOn('mana-value')} data-is-active={sortKey.k === "mana-value"} className="data-[is-active=true]:font-bold inline-block text-right pr-2 w-30">Cost</span>
        <span onClick={() => sortOn('name')} data-is-active={sortKey.k === "name"} className="data-[is-active=true]:font-bold inline-block w-64 border-r border-transparent mr-4">Name</span>
        <span onClick={() => sortOn('types')} data-is-active={sortKey.k === "types"} className="data-[is-active=true]:font-bold inline-block w-80">Types</span>
        <span className="inline-block w-8 text-center">
          <span onClick={() => sortOn('power')} data-is-active={sortKey.k === "power"} className="data-[is-active=true]:font-bold">P</span>
          /
          <span onClick={() => sortOn('toughness')} data-is-active={sortKey.k === "toughness"} className="data-[is-active=true]:font-bold">T</span>
        </span>
        <span onClick={() => sortOn('art')} data-is-active={sortKey.k === "art"} className="data-[is-active=true]:font-bold inline-block w-12 text-center">Art</span>
        <span onClick={() => sortOn('tags')} data-is-active={sortKey.k === "tags"} className="data-[is-active=true]:font-bold inline-block w-40 pl-2">Tags</span>
      </li>
      {cards.map((card) => {
        return <li
          key={card.id}
          className="flex items-center px-2 py-0.5 border-t border-zinc-200 hover:bg-zinc-100"
        >
          <span className="inline-block w-8 text-sm text-gray-800">{card.collectorNumber}</span>
          <span className="w-24 border-r border-zinc-200"><RarityText rarity={card.rarity} /></span>
          <span className="inline-block w-30 pr-2 text-right"><ManaCost cost={card.renderManaCost()} /></span>
          <span className="inline-block w-64 font-bold border-r border-zinc-200 mr-4">
            {card.name}
          </span>
          <span className="inline-block w-80">{card.renderTypeLine()}</span>
          <span className="inline-block w-8 text-center">{card.pt ? `${card.pt.power}/${card.pt.toughness}` : ''}</span>
          <span className="inline-block w-12 text-center">{card.art ? 'yes' : 'no'}</span>
          <span className="inline-block w-40 pl-2 text-sm text-gray-600 overflow-hidden">{tagsAsString(card.tags)}</span>
        </li>
      })}
    </ul>
  </>;
}
