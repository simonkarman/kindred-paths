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

export function createCardDistribution(cards: Card[], getKeys: (item: Card) => string | string[]): Record<string, number> {
  return createDistribution(cards, c => c.getTagAsNumber('count') ?? 0, getKeys);
}

export function getStatistics(_cards: SerializedCard[]) {
  const cards = _cards.map(c => new Card(c)).filter(c => ![undefined, 0].includes(c.getTagAsNumber('count')));

  const cardsWithoutTokens = cards.filter(c => c.supertype !== 'token');
  const cardsWithoutTokensAndBasicLands = cardsWithoutTokens.filter(c => c.supertype !== 'basic');

  const basicLands = cardsWithoutTokens.filter(c => c.supertype === 'basic');
  const tokens = cards.filter(c => c.supertype === 'token');
  const availableTokenNames = tokens.flatMap(token => [token.getReferenceName(), `${token.name} token`]);

  const countSum = (cards: Card[]) => cards.reduce((acc, card) => acc + (card.getTagAsNumber('count') ?? 0), 0);
  return {
    totalCount: countSum(cardsWithoutTokens),
    nonlandCount: countSum(cardsWithoutTokens.filter(c => !c.types.includes('land'))),
    landCount: countSum(cardsWithoutTokens.filter(c => c.types.includes('land'))),

    cardsWithoutTokens,
    cardsWithoutTokensAndBasicLands,

    basicLands,
    tokens,
    availableTokenNames,

    cardsWithZeroCount: _cards.map(c => new Card(c)).filter(c => [undefined, 0].includes(c.getTagAsNumber('count'))),

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
      c => c.types,
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
