import { Card } from './card';
import { CardFace, cardTypes } from './card-face';
import { cardColors } from './colors';

export const sortKeys = [
  'collector-number',
  'color',
  'mana-value',
  'name',
  'rarity',
  'type',
  'typeline',
  'power',
  'toughness',
  'art',
  'created-at',
  'tags',
  'tag:count',
] as const;
export type SortKey = typeof sortKeys[number];
export type SortDirection = 'asc' | 'desc';
export type SortEntry = {
  key: SortKey;
  direction: SortDirection;
};
export type SortOptions = {
  keys: SortEntry[];
  deckName?: string;
};

/**
 * Normalize sort options from potentially malformed data into the current shape.
 */
export const normalizeSortOptions = (raw: unknown): SortOptions => {
  const defaultOptions: SortOptions = { keys: [{ key: 'collector-number', direction: 'asc' }] };
  if (typeof raw !== 'object' || raw === null) return defaultOptions;
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.keys)) {
    const keys = obj.keys.filter(
      (e: unknown): e is SortEntry =>
        typeof e === 'object' && e !== null
        && 'key' in e && typeof (e as SortEntry).key === 'string' && (sortKeys as readonly string[]).includes((e as SortEntry).key)
        && 'direction' in e && ((e as SortEntry).direction === 'asc' || (e as SortEntry).direction === 'desc'),
    );
    return keys.length > 0 ? { keys, deckName: typeof obj.deckName === 'string' ? obj.deckName : undefined } : defaultOptions;
  }

  return defaultOptions;
};

const tagsAsString = (tags: Card['tags']) => {
  return tags
    ? Object.entries(tags)
      .filter(([tagName]) => tagName !== 'createdAt')
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([tagName, tagValue]) => tagValue === true ? tagName : `${tagName}=${tagValue}`)
      .join(', ')
    : '';
};

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
};

const asSortableManaCost = (manaCost: string): string => {
  // Single-char mana symbols
  const singleFrom = ['{x}', '{c}', '{w}', '{u}', '{b}', '{r}', '{g}'];
  const singleTo = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  // Hybrid mana symbols (sorted between colorless and mono-colored)
  const hybridFrom = [
    '{w/u}', '{u/b}', '{b/r}', '{r/g}', '{g/w}',
    '{w/b}', '{u/r}', '{b/g}', '{r/w}', '{g/u}',
  ];
  const hybridTo = [
    'ba', 'bb', 'bc', 'bd', 'be',
    'bf', 'bg', 'bh', 'bi', 'bj',
  ];
  return manaCost
    .replace(/{[\w/]+}/gi, (match) => {
      const lowerMatch = match.toLowerCase();
      const hybridIndex = hybridFrom.indexOf(lowerMatch);
      if (hybridIndex !== -1) return hybridTo[hybridIndex];
      const singleIndex = singleFrom.indexOf(lowerMatch);
      if (singleIndex !== -1) return singleTo[singleIndex];
      return 'z';
    });
};

const asSortableTypes = (f: CardFace) => f.types
  .map(t => cardTypes.indexOf(t))
  .sort((a, b) => a - b)
  .map(i => String.fromCharCode(97 + i))
  .join('');

const asSortableTypeLine = (f: CardFace) => [
  f.card.isToken ? 'token' : '',
  ...f.types,
  '-',
  f.supertype ?? ' ',
  '-',
  ...(f.subtypes ?? []),
].join(', ');

export const sort = (cards: Card[], options: SortOptions): Card[] => {
  const { keys, deckName } = options;
  let _cards = [...cards];
  for (let i = keys.length - 1; i >= 0; i--) {
    const { key: sortKey, direction } = keys[i];
    _cards = _cards.sort((_a, _b) => {
      let a = _a.faces[0];
      let b = _b.faces[0];
      if (direction === 'desc') {
        const temp = a;
        a = b;
        b = temp;
      }
      if (sortKey === 'collector-number') {
        return a.card.collectorNumber - b.card.collectorNumber;
      } else if (sortKey === 'color') {
        const colorsA = a.color();
        const colorsB = b.color();
        // Sort by number of colors first (colorless < mono < dual < tri < ...)
        if (colorsA.length !== colorsB.length) {
          return colorsA.length - colorsB.length;
        }
        // Within the same number of colors, sort by WUBRG order so same combinations group together
        for (let c = 0; c < colorsA.length; c++) {
          const diff = cardColors.indexOf(colorsA[c]) - cardColors.indexOf(colorsB[c]);
          if (diff !== 0) return diff;
        }
        return 0;
      } else if (sortKey === 'mana-value') {
        if (a.manaValue() !== b.manaValue()) {
          return a.manaValue() - b.manaValue();
        }
        const genericA = a.manaCost?.['generic'] ?? 0;
        const genericB = b.manaCost?.['generic'] ?? 0;
        if (genericA !== genericB) {
          return -(genericA - genericB);
        }
        return asSortableManaCost(a.renderManaCost()).localeCompare(asSortableManaCost(b.renderManaCost()));
      } else if (sortKey === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortKey === 'rarity') {
        const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];
        return rarityOrder.indexOf(a.card.rarity) - rarityOrder.indexOf(b.card.rarity);
      } else if (sortKey === 'type') {
        return asSortableTypes(a).localeCompare(asSortableTypes(b));
      } else if (sortKey === 'typeline') {
        return asSortableTypeLine(a).localeCompare(asSortableTypeLine(b));
      } else if (sortKey === 'power' || sortKey === 'toughness') {
        const powerA = a.pt?.power === '*' ? -1 : a.pt?.power ?? -2;
        const powerB = b.pt?.power === '*' ? -1 : b.pt?.power ?? -2;
        const toughnessA = a.pt?.toughness === '*' ? -1 : a.pt?.toughness ?? -2;
        const toughnessB = b.pt?.toughness === '*' ? -1 : b.pt?.toughness ?? -2;
        if (sortKey === 'power') {
          return powerA - powerB;
        } else {
          return toughnessA - toughnessB;
        }
      } else if (sortKey === 'art') {
        const aHasArt = a.art !== undefined && a.art.length > 0;
        const bHasArt = b.art !== undefined && b.art.length > 0;
        if (aHasArt && !bHasArt) {
          return -1;
        } else if (!aHasArt && bHasArt) {
          return 1;
        }
        return 0;
      } else if (sortKey === 'created-at') {
        const dateA = typeof a.card.tags?.createdAt === 'string' ? new Date(a.card.tags.createdAt) : new Date(0);
        const dateB = typeof b.card.tags?.createdAt === 'string' ? new Date(b.card.tags.createdAt) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      } else if (sortKey === 'tags') {
        const tagsA = tagsAsString(a.card.tags);
        const tagsB = tagsAsString(b.card.tags);
        return tagsA.localeCompare(tagsB);
      } else if (sortKey === 'tag:count') {
        return tagAsNumber(a.card, `deck/${deckName}`) - tagAsNumber(b.card, `deck/${deckName}`);
      }
      return 0;
    });
  }
  return [..._cards];
};
