import { Card } from 'kindred-paths';

export type Set = { 
  author: string;
  shortName: string;
  symbol: string;
  collectorNumberOffset?: number;
};

export const sets: { [name: string]: Set } = {
  default: {
    author: 'Simon Karman',
    shortName: 'KPA',
    symbol: 'ELD',
  },
  miffy: {
    author: 'Simon Karman',
    shortName: 'MFY',
    symbol: 'custom/mfy',
    collectorNumberOffset: 400,
  }
};

export const getSetForCard = (card: Card): Set => {
  // If the card has a string value for deck in the tags, use that as the set
  if (typeof card.tags.deck === 'string' && card.tags.deck in sets) {
    return sets[card.tags.deck];
  }

  // If the card has a string value for the set in the tags, use that as the set
  if (typeof card.tags.set === 'string' && card.tags.set in sets) {
    return sets[card.tags.set];
  }

  // Otherwise, use the default set
  return sets.default;
};