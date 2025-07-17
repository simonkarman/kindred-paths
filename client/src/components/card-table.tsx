"use client";

import { Card, cardRarities, cardSuperTypes, cardTypes, SerializedCardSummary } from 'kindred-paths';
import { colorToTypographyColor, typographyColors } from '@/utils/typography';
import { useState } from 'react';

type Filter = { name: string, predicate: (cardSummary: SerializedCardSummary) => boolean };
type SortKey = 'collector-number' | 'mana-value' | 'name' | 'rarity' | 'types' | 'power' | 'toughness';

const filterCategories: { category: string, filters: Filter[] }[] = [
  {
    category: 'Color',
    filters: Array.from(typographyColors.entries()).map(([tc]) => ({
      name: `${tc} cards`,
      predicate: (cardSummary: SerializedCardSummary) => colorToTypographyColor(cardSummary.color) === tc,
    })),
  },
  {
    category: 'Type',
    filters: cardTypes.map(cardType => ({
      name: cardType.endsWith('y') ? `${cardType.slice(0, -1)}ies` : `${cardType}s`,
      predicate: (cardSummary: SerializedCardSummary) => cardSummary.card.types.includes(cardType),
    }))
  },
  {category: 'Rarity', filters: cardRarities.map(cardRarity => ({
      name: `${cardRarity}s`,
      predicate: (cardSummary: SerializedCardSummary) => cardSummary.card.rarity === cardRarity,
    }))},
  {
    category: 'Super Type',
    filters: cardSuperTypes.filter(s => s !== undefined).map(cardSuperType => ({
      name: cardSuperType,
      predicate: (cardSummary: SerializedCardSummary) => cardSummary.card.supertype === cardSuperType,
    }))
  },
];

export const CardTable = (props: { cardSummaries: SerializedCardSummary[] }) => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [showPossibleFilters, setShowPossibleFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const sortOn = (key: SortKey) => {
    if (sortKey === key) {
      setSortKey('name');
    } else {
      setSortKey(key);
    }
  };

  const cardSummaries = props.cardSummaries
    .filter(c => !filters.some(filter => !filter.predicate(c)))
    .sort((a, b) => {
      if (sortKey === 'collector-number') {
        return a.card.collectorNumber - b.card.collectorNumber;
      } else if (sortKey === 'mana-value') {
        return a.manaValue - b.manaValue;
      } else if (sortKey === 'name') {
        return a.card.name.localeCompare(b.card.name);
      } else if (sortKey === 'rarity') {
        const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];
        return rarityOrder.indexOf(a.card.rarity) - rarityOrder.indexOf(b.card.rarity);
      } else if (sortKey === 'types') {
        const typeLineA = [a.card.supertype, ...a.card.types, ...[a.card.subtypes ?? []]]
        const typeLineB = [b.card.supertype, ...b.card.types, ...[b.card.subtypes ?? []]];
        return typeLineA.join(', ').localeCompare(typeLineB.join(', '));
      } else if (sortKey === 'power' || sortKey === 'toughness') {
        const powerA = a.card.pt?.power ?? 0;
        const powerB = b.card.pt?.power ?? 0;
        const toughnessA = a.card.pt?.toughness ?? 0;
        const toughnessB = b.card.pt?.toughness ?? 0;
        if (sortKey === 'power') {
          return powerA - powerB;
        } else {
          return toughnessA - toughnessB;
        }
      }
      return 0;
    });

  return <>
    <div className="flex gap-2 items-center justify-end w-200 text-sm mb-2">
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
    {showPossibleFilters && <div className="bg-zinc-50 p-2 rounded border border-gray-300 mb-2 w-200">
      <h3 className="font-bold text-sm mb-1">Filters</h3>
      <div className="flex flex-wrap justify-start gap-2">
        {filterCategories.map(category => (<ul
            key={category.category}
            className="flex flex-col gap-1 border rounded border-gray-200 p-2"
          >
            <li className="font-bold text-sm border-b text-center">{category.category}</li>
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
    <ul className='flex flex-col items-start gap-1'>
      <li className="flex items-center px-2 border-b border-gray-300 text-xs text-gray-600">
        <span onClick={() => sortOn('collector-number')} data-is-active={sortKey === "collector-number"} className="data-[is-active=true]:font-bold inline-block w-8">#</span>
        <span onClick={() => sortOn('mana-value')} data-is-active={sortKey === "mana-value"} className="data-[is-active=true]:font-bold inline-block text-right pr-2 w-20">Cost</span>
        <span onClick={() => sortOn('name')} data-is-active={sortKey === "name"} className="data-[is-active=true]:font-bold inline-block w-56 px-2 border-l-4 border-l-transparent">Name</span>
        <span onClick={() => sortOn('rarity')} data-is-active={sortKey === "rarity"} className="data-[is-active=true]:font-bold inline-block w-24 pl-2">Rarity</span>
        <span onClick={() => sortOn('types')} data-is-active={sortKey === "types"} className="data-[is-active=true]:font-bold inline-block w-80">Types</span>
        <span className="inline-block w-8 text-center">
          <span onClick={() => sortOn('power')} data-is-active={sortKey === "power"} className="data-[is-active=true]:font-bold">P</span>
          /
          <span onClick={() => sortOn('toughness')} data-is-active={sortKey === "toughness"} className="data-[is-active=true]:font-bold">T</span>
        </span>
      </li>
      {cardSummaries.map((summary) => {
        const card = new Card({ ...summary.card, rules: [] });
        return <li
          key={summary.id}
          className="flex items-center px-2 rounded-lg border border-gray-500 hover:border-black transition-colors"
          style={{ backgroundColor: typographyColors.get(colorToTypographyColor(card.color()))?.main }}
        >
          <span className="inline-block w-8 text-sm text-gray-800">{card.collectorNumber}</span>
          <span className="inline-block w-20 pr-2 text-xs text-right text-gray-800">{card.renderManaCost()}</span>
          <button
            className="inline-block w-56 border-l-4 px-2 font-bold hover:text-blue-500 text-left"
            style={{ borderColor: typographyColors.get(colorToTypographyColor(card.color()))?.main }}
          >
            {card.name}
          </button>
          <span className="inline-block w-24 pl-2">{card.rarity[0].toUpperCase() + card.rarity.slice(1)}</span>
          <span className="inline-block w-80">{card.renderTypeLine()}</span>
          <span className="inline-block w-8 text-center">{card.pt ? `${card.pt.power}/${card.pt.toughness}` : '-'}</span>
        </li>
      })}
    </ul>
  </>;
}
