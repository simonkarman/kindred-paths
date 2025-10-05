import { Card } from 'kindred-paths';

export type Set = {
  author: string;
  shortName: string;
  symbol: string;
  collectorNumberOffset?: number;
};

export const sets: { [name: string]: Set} = {
  default: {
    author: 'Simon Karman',
    shortName: 'SET',
    symbol: 'ELD',
  },
  KPA: {
    author: 'Simon Karman',
    shortName: 'KPA',
    symbol: 'ELD',
  },
  MFY: {
    author: 'Simon Karman',
    shortName: 'MFY',
    symbol: 'custom/mfy',
    collectorNumberOffset: 400,
  },
  DTS: {
    author: 'S.J. Karman & R. Dolfing',
    shortName: 'DTS',
    symbol: 'custom/dts',
  }
};

export const getSetForCard = (card: Card): Set => {
  // If the set tag is a 3-letter string, use that as the set for the card in uppercase
  const setFromTag = typeof card.tags.set === 'string' && card.tags.set.length === 3
    ? card.tags.set.toUpperCase()
    : undefined

  // If the card has a string value for the set in the tags, use that as the set
  if (setFromTag && setFromTag in sets) {
    return sets[setFromTag];
  }

  // Otherwise, use the default set
  return {
    ...sets.default,
    shortName: setFromTag ?? sets.default.shortName,
  };
};
