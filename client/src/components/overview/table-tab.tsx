"use client";

import { Card, SerializedCard } from 'kindred-paths';
import { ReactNode, useState } from 'react';
import { RarityText } from '@/components/rarity-text';
import { ManaCost } from '@/components/mana-cost';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClone,
  faImage,
  faPenToSquare,
  faShieldCat,
  faTrashCan,
  faAngleDown,
  faAngleUp,
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { deleteCard } from '@/utils/server';
import { useDeckNameFromSearch } from '@/utils/use-search';

type SortKey = 'collector-number' | 'mana-value' | 'name' | 'rarity' | 'types' | 'power' | 'toughness' | 'art' | 'tags' | 'tag:count';

const tagsAsString = (tags: Card["tags"]) => {
  return tags
    ? Object.entries(tags)
      .filter(([tagName]) => tagName !== "createdAt")
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([tagName, tagValue]) => tagValue === true ? tagName : `${tagName}=${tagValue}`)
      .join(', ')
    : '';
}

export const TableTab = (props: {
  cards: SerializedCard[],
  onSelect?: (card: SerializedCard, faceIndex: number) => void,
}) => {
  const deckName = useDeckNameFromSearch();
  const { onSelect } = props;

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
    .map(serializedCard => new Card(serializedCard))
    .sort((_a, _b) => {
      let a = _a.faces[0];
      let b = _b.faces[0];
      if (sortKey.d === 'desc') {
        const temp = a;
        a = b;
        b = temp;
      }
      if (sortKey.k === 'collector-number') {
        return a.card.collectorNumber - b.card.collectorNumber;
      } else if (sortKey.k === 'mana-value') {
        if (a.manaValue() !== b.manaValue()) {
          return a.manaValue() - b.manaValue();
        }
        const colorlessA = a.manaCost?.['colorless'] ?? 0;
        const colorlessB = b.manaCost?.['colorless'] ?? 0;
        if (colorlessA !== colorlessB) {
          return -(colorlessA - colorlessB);
        }
        return a.renderManaCost().localeCompare(b.renderManaCost());
      } else if (sortKey.k === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortKey.k === 'rarity') {
        const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];
        return rarityOrder.indexOf(a.card.rarity) - rarityOrder.indexOf(b.card.rarity);
      } else if (sortKey.k === 'types') {
        const typeLineA = [a.card.isToken ? 'token' : '', ...a.types, '-', a.supertype ?? ' ', '-', ...(a.subtypes ?? [])]
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
          return -1;
        } else if (!aHasArt && bHasArt) {
          return 1;
        }
        return 0;
      } else if (sortKey.k === 'tags') {
        const tagsA = tagsAsString(a.card.tags);
        const tagsB = tagsAsString(b.card.tags);
        return tagsA.localeCompare(tagsB)
      } else if (sortKey.k === 'tag:count') {
        const tagAsNumber = (c: Card, tagName: string) => {
          const tagValue = c.tags?.[tagName];
          if (typeof tagValue === 'number') {
            return tagValue;
          } else if (typeof tagValue === 'string' && !isNaN(Number(tagValue))) {
            return Number(tagValue);
          } else if (typeof tagValue === 'boolean') {
            return tagValue ? 1 : 0;
          } else if (tagValue === undefined || tagValue === null) {
            return 0.5;
          }
          return 99;
        }
        return tagAsNumber(a.card, `deck/${deckName}`) - tagAsNumber(b.card, `deck/${deckName}`);
      }
      return 0;
    });

  const SortableHeader = ({ sortKey: key, children, textAlignment = "text-left" }: {
    sortKey: SortKey,
    children: ReactNode,
    textAlignment?: string,
  }) => {
    const sortIcon = sortKey.k === key && (
      <FontAwesomeIcon
        icon={sortKey.d === 'desc' ? faAngleUp : faAngleDown}
        className="text-blue-600 text-xs"
      />
    );
    return (
      <th
        onClick={() => sortOn(key)}
        className={`px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors ${textAlignment} ${sortKey.k === key ? 'bg-slate-50 text-slate-900 font-semibold' : ''}`}
      >
        <div className="flex gap-1.5">
          <span className="grow">
            {textAlignment !== 'text-left' && sortIcon && <span className="pr-2">{sortIcon}</span>}
            {children}
            {textAlignment === 'text-left' && sortIcon && <span className="pl-2">{sortIcon}</span>}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <SortableHeader sortKey="mana-value" textAlignment="text-right">Cost</SortableHeader>
            <SortableHeader sortKey="tag:count" textAlignment="text-center">Deck</SortableHeader>
            <SortableHeader sortKey="collector-number" textAlignment="text-right">#</SortableHeader>
            <SortableHeader sortKey="name">Name</SortableHeader>
            <SortableHeader sortKey="rarity">Rarity</SortableHeader>
            <SortableHeader sortKey="types">Types</SortableHeader>
            <th className="px-3 py-2 text-center text-xs font-medium text-slate-600">
              <span onClick={() => sortOn('power')} className={`cursor-pointer hover:text-slate-900 ${sortKey.k === 'power' ? 'text-slate-900 font-semibold' : ''}`}>P</span>
              /
              <span onClick={() => sortOn('toughness')} className={`cursor-pointer hover:text-slate-900 ${sortKey.k === 'toughness' ? 'text-slate-900 font-semibold' : ''}`}>T</span>
            </th>
            <SortableHeader sortKey="art" textAlignment="text-center">Art</SortableHeader>
            <th className="px-3 py-2 text-center text-xs font-medium text-slate-600">Token</th>
            {!onSelect && <th className="px-3 py-2 text-center text-xs font-medium text-slate-600">Actions</th>}
          </tr>
          </thead>
          {cards.map(card => <tbody
            key={card.id}
            className="hover:bg-slate-50 transition-colors border-y border-slate-300"
          >
            {card.faces.map((face, faceIndex) => {
              const isFirstFaceOfDualCard = face.card.faces.length === 2 && faceIndex === 0;
              const isSecondFaceOfDualCard = face.card.faces.length === 2 && faceIndex === 1;
              const doubleRowSpan = isFirstFaceOfDualCard ? 2 : 1;
              const showDoubleRows = !isSecondFaceOfDualCard;
              const defaultPaddingY = `py-2`;
              const paddingY = face.card.faces.length === 1
                ? defaultPaddingY
                : (isFirstFaceOfDualCard ? `pt-4 pb-1` : `pt-1 pb-4`);
              const doubleRowPaddingY = defaultPaddingY;
              const creatableTokenNames = face.getCreatableTokenNames();

              return <tr
                key={faceIndex}
              >
                <td className={`px-3 ${paddingY} text-right whitespace-nowrap`}>
                  <ManaCost cost={face.renderManaCost()} />
                </td>
                {showDoubleRows && <td rowSpan={doubleRowSpan} className={`px-3 ${doubleRowPaddingY} text-center text-slate-600 text-xs`}>
                  {face.card.tags?.[`deck/${deckName}`] ? face.card.tags?.[`deck/${deckName}`] + 'x' : '-'}
                </td>}
                {showDoubleRows && <td rowSpan={doubleRowSpan} className={`px-3 ${doubleRowPaddingY} text-right text-slate-600 text-xs whitespace-nowrap`}>
                  {(face.card.tags?.['set'] ? face.card.tags?.['set'] + '/' : '') + face.card.collectorNumber.toString()}
                </td>}
                <td className={`px-3 ${paddingY} font-semibold`}>
                  {onSelect !== undefined ? (
                    <button
                      className="hover:text-blue-600 active:text-blue-700 transition-colors"
                      onClick={() => onSelect(face.card.toJson(), faceIndex)}
                    >
                      {face.name}
                    </button>
                  ) : (
                    <Link
                      className="hover:text-blue-600 active:text-blue-700 transition-colors"
                      href={`/card/${face.card.id}${faceIndex !== 0 ? `?faceIndex=${faceIndex}` : ''}`}
                    >
                      {face.name}
                    </Link>
                  )}
                </td>
                {showDoubleRows && <td rowSpan={doubleRowSpan} className={`px-3 ${doubleRowPaddingY}`}>
                  <RarityText rarity={face.card.rarity} />
                </td>}
                <td className={`px-3 ${paddingY} text-slate-700`}>
                  {face.renderTypeLine()}</td>
                <td className={`px-3 ${paddingY} text-center text-slate-700`}>
                  {face.pt ? `${face.pt.power}/${face.pt.toughness}` : ''}
                </td>
                <td className={`px-3 ${paddingY} text-center`}>
                  <FontAwesomeIcon className={face.art ? 'text-slate-500' : 'text-slate-200'} icon={faImage} />
                </td>
                <td className={`group relative px-3 ${paddingY} text-center`}>
                  <FontAwesomeIcon
                    className={creatableTokenNames.length > 0 ? 'text-slate-500' : 'text-slate-200'}
                    icon={faShieldCat}
                  />
                  {creatableTokenNames.length > 0 && <div
                    className="hidden group-hover:flex absolute z-100 -top-5 -right-1 gap-2"
                  >
                    {creatableTokenNames.map(name => <div
                      key={name}
                      className="bg-blue-500 text-white text-xs rounded-md px-2 py-1 mt-1 whitespace-nowrap shadow-lg"
                    >{name}</div>)}
                  </div>}
                </td>
                {showDoubleRows && !onSelect && (
                  <td rowSpan={doubleRowSpan} className={`px-3 ${doubleRowPaddingY}`}>
                    <div className="flex gap-2 justify-center">
                      <Link
                        className="text-slate-500 hover:text-blue-600 transition-colors"
                        href={`/edit/${face.card.id}?t=/`}
                        title="Edit"
                      >
                        <FontAwesomeIcon icon={faPenToSquare} />
                      </Link>
                      <Link
                        className="text-slate-500 hover:text-blue-600 transition-colors"
                        href={`/clone/${face.card.id}?t=/`}
                        title="Clone"
                      >
                        <FontAwesomeIcon icon={faClone} />
                      </Link>
                      <button
                        className="text-slate-500 hover:text-red-600 transition-colors"
                        onClick={() => del(face.card.id)}
                        title="Delete"
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>;
            })}
          </tbody>)}
        </table>
      </div>
      {cards.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No cards found
        </div>
      )}
    </div>
  );
}
