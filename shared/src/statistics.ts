import { Card } from './card';
import { SerializedCard } from './serialized-card';
import { CardFace } from './card-face';

export function createDistribution<T>(items: T[], getCount: (item: T) => number, getKeys: (item: T) => string | string[]): Record<string, number> {
  return items.reduce((acc, item) => {
    const count = getCount(item);
    if (count === 0) {
      return acc;
    }
    let keys = getKeys(item);
    if (typeof keys === 'string') {
      keys = [keys];
    }
    keys.forEach(key => {
      if (key in acc) {
        acc[key] += count;
      } else {
        acc[key] = count;
      }
    });
    return acc;
  }, {} as Record<string, number>);
}

export function getStatistics(_cards: SerializedCard[], deckName?: string) {
  const getCount = (card: Card) => {
    if (!deckName) {
      // When no deck name is provided, each card is counted once
      return 1;
    }
    // When a deck name is provided, return the count for that deck, or 0 if not present
    return card.getTagAsNumber(`deck/${deckName}`) ?? 0;
  };

  const createCardDistribution = (
    cards: Card[],
    getKeys: (item: Card) => string | string[],
  ): Record<string, number> => {
    return createDistribution(cards, getCount, getKeys);
  };

  const createCardFacesDistribution = (
    cardFaces: CardFace[],
    getKeys: (item: CardFace) => string | string[],
  ): Record<string, number> => {
    return createDistribution(cardFaces, (c) => getCount(c.card), getKeys);
  };

  const cards = _cards.map(c => new Card(c));

  const cardsWithoutTokens = cards.filter(c => !c.isToken);
  const cardsWithoutTokensAndBasicLands = cardsWithoutTokens.filter(c => c.faces[0]?.supertype !== 'basic');

  const basicLands = cardsWithoutTokens.filter(c => c.faces[0]?.supertype === 'basic');
  const tokens = cards.filter(c => c.isToken);

  const countSum = (cards: Card[]) => cards.reduce((acc, card) => acc + getCount(card), 0);
  return {
    totalCount: countSum(cardsWithoutTokens),
    nonlandCount: countSum(cardsWithoutTokens.filter(c => c.faces.some(f => !f.types.includes('land')))),
    landCount: countSum(cardsWithoutTokens.filter(c => c.faces.some(f => f.types.includes('land')))),

    cardsWithoutTokens,
    cardsWithoutTokensAndBasicLands,

    basicLands,
    tokens,

    cardsWithZeroCount: deckName
      ? _cards.map(c => new Card(c)).filter(c => c.getTagAsNumber(`deck/${deckName}`) === 0)
      : [],

    // Distributions
    cardColorDistribution: createCardDistribution(cardsWithoutTokensAndBasicLands, c => c.faces.flatMap(f => f.color())),
    rarityDistribution: createCardDistribution(cardsWithoutTokens, c => c.rarity),
    manaValueDistribution: createCardFacesDistribution(
      cardsWithoutTokens.flatMap(c => c.faces).filter(f => f.manaCost !== undefined),
      f => f.manaValue() + ' mana',
    ),
    manaValueRarityDistribution: createCardFacesDistribution(
      cardsWithoutTokens.flatMap(c => c.faces).filter(f => f.manaCost !== undefined),
      c => `${c.manaValue()}/${c.card.rarity[0]}`,
    ),
    cardTypeDistribution: createCardDistribution(
      cardsWithoutTokens,
      c => c.faces.flatMap(f => f.types.map(t => f.supertype === 'basic' ? `basic ${t}` : t)),
    ),
    subtypeDistribution: createCardDistribution(
      cardsWithoutTokensAndBasicLands,
      c => c.faces.flatMap(f => f.subtypes || []),
    ),
    tokenDistribution: createCardDistribution(
      cards,
      c => c.faces.flatMap(f => f.getCreatableTokenNames()),
    ),
  };
}
