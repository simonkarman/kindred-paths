import { Card } from './card';
import { SerializedCard } from './serialized-card';

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

  const cards = _cards.map(c => new Card(c));

  const cardsWithoutTokens = cards.filter(c => !c.isToken);
  const cardsWithoutTokensAndBasicLands = cardsWithoutTokens.filter(c => c.supertype !== 'basic');

  const basicLands = cardsWithoutTokens.filter(c => c.supertype === 'basic');
  const tokens = cards.filter(c => c.isToken);

  const countSum = (cards: Card[]) => cards.reduce((acc, card) => acc + getCount(card), 0);
  return {
    totalCount: countSum(cardsWithoutTokens),
    nonlandCount: countSum(cardsWithoutTokens.filter(c => !c.types.includes('land'))),
    landCount: countSum(cardsWithoutTokens.filter(c => c.types.includes('land'))),

    cardsWithoutTokens,
    cardsWithoutTokensAndBasicLands,

    basicLands,
    tokens,

    cardsWithZeroCount: deckName
      ? _cards.map(c => new Card(c)).filter(c => c.getTagAsNumber(`deck/${deckName}`) === 0)
      : [],

    // Distributions
    cardColorDistribution: createCardDistribution(cardsWithoutTokensAndBasicLands, c => c.color()),
    rarityDistribution: createCardDistribution(cardsWithoutTokens, c => c.rarity),
    manaValueDistribution: createCardDistribution(
      cardsWithoutTokens.filter(c => c.types.length !== 1 || c.types[0] !== 'land'),
      c => c.manaValue() + ' mana',
    ),
    manaValueRarityDistribution: createCardDistribution(
      cardsWithoutTokens.filter(c => c.types.length !== 1 || c.types[0] !== 'land'),
      c => `${c.manaValue()}/${c.rarity[0]}`,
    ),
    cardTypeDistribution: createCardDistribution(
      cardsWithoutTokens,
      c => c.types.map(t => c.supertype === 'basic' ? `${c.supertype} ${t}` : t),
    ),
    subtypeDistribution: createCardDistribution(
      cardsWithoutTokensAndBasicLands,
      c => c.subtypes || [],
    ),
    tokenDistribution: createCardDistribution(
      cards,
      c => c.getCreatableTokenNames(),
    ),
  };
}
