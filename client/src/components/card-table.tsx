"use client";

import { Card, SerializedCardSummary } from 'kindred-paths';
import { colorToTypographyColor, typographyColors } from '@/utils/typography';
import { useState } from 'react';

type Filter = (cardSummary: SerializedCardSummary) => boolean;
type SortKey = 'collector-number' | 'mana-value' | 'name' | 'rarity' | 'types' | 'power' | 'toughness';

export const CardTable = (props: { cardSummaries: SerializedCardSummary[] }) => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const sortOn = (key: SortKey) => {
    if (sortKey === key) {
      setSortKey('name');
    } else {
      setSortKey(key);
    }
  };

  const cardSummaries = props.cardSummaries
    .filter(c => !filters.some(f => !f(c)))
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

  return <ul className='flex flex-col items-start gap-1'>
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
      return <li key={summary.id} className="flex items-center px-2 rounded-lg hover:bg-zinc-300 bg-zinc-100 transition-colors">
        <span className="inline-block w-8 text-sm text-gray-800">{card.collectorNumber}</span>
        <span className="inline-block w-20 pr-2 text-xs text-right text-gray-800">{card.renderManaCost()}</span>
        <button className="inline-block w-56 border-l-4 px-2 font-bold hover:text-blue-500 text-left"
                style={{ borderColor: typographyColors.get(colorToTypographyColor(card.color()))?.main }}
        >
          {card.name}
        </button>
        <span className="inline-block w-24 pl-2">{card.rarity[0].toUpperCase() + card.rarity.slice(1)}</span>
        <span className="inline-block w-80">{card.renderTypeLine()}</span>
        <span className="inline-block w-8 text-center">{card.pt ? `${card.pt.power}/${card.pt.toughness}` : '-'}</span>
      </li>
    })}
  </ul>;
}
