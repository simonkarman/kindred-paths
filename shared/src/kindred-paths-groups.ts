import { primaryRacesPerAllColors, families, primaryRacesPerPrimaryColor } from './families';
import { Group, Requirement } from './group';
import { Card, CardColor, cardColors, CardRarity, CardSuperType, CardType } from './card';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);
const s = (value: string | undefined) => (value === undefined || value.length === 0) ? '' : `${value} `;

const requirementCreator = (expected: {
  count?: number,
  rarity?: CardRarity,
  colors?: CardColor[],
  supertype?: CardSuperType,
  types?: CardType[],
  subtypes?: string[],
  distributedSubtypes?: string[],
  abilities?: string[],
}): Requirement<Card>[] => {
  const count = expected.count ?? 1;
  return n(count).map(i => {
    const expectedSubtypes = expected.subtypes !== undefined || expected.distributedSubtypes !== undefined
      ? [...(expected?.subtypes ?? []), ...((expected.distributedSubtypes && (i - 1) < expected.distributedSubtypes.length) ? [expected.distributedSubtypes[i - 1]] : [])]
      : undefined;
    return {
      name: `${s(expected.rarity)}${s(expected.colors?.join('+'))}${s(expected.supertype)}${s(expected.types?.join('+'))}${s(expectedSubtypes?.join('+'))}${s(expected.abilities?.join('+'))}${count == 1 ? '' : i}`,
      predicate: (card: Card) => {
        if (expected.rarity && card.rarity !== expected.rarity) {
          return false;
        }
        if (expected.colors && (card.color.length !== expected.colors.length || !expected.colors.every(ec => card.color().includes(ec)))) {
          return false;
        }
        if (expected.supertype && card.supertype !== expected.supertype) {
          return false;
        }
        if (expected.types && !expected.types.every(t => card.types.includes(t))) {
          return false;
        }
        if (expectedSubtypes && !expectedSubtypes.every(st => (card.subtypes ?? []).includes(st))) {
          return false;
        }
        if (expected.abilities && !expected.abilities.every(ability => card.rules.some(rule => rule.variant === 'ability' && rule.content.toLowerCase().includes(ability)))) {
          return false;
        }
        // Default
        return true;
      },
    };
  });
};

export const kindredPathsGroups = [
  new Group<Card>('Lands', [
    ...requirementCreator({ count: 5, rarity: 'common', types: ['land'], distributedSubtypes: ['plains', 'island', 'swamp', 'mountain', 'forest'] }),
    ...cardColors.flatMap(color => [
      ...requirementCreator({ rarity: 'common', types: ['land'], abilities: primaryRacesPerAllColors[color] }),
      ...requirementCreator({ rarity: 'uncommon', types: ['land'], abilities: primaryRacesPerAllColors[color] }),
      ...requirementCreator({ rarity: 'rare', types: ['land'], abilities: primaryRacesPerPrimaryColor[color] }),
    ]),
    // TODO ...wubrg.flatMap((color, index) => []),
  ]),
  new Group<Card>('Collector Numbers', n(255).map(i => ({
    name: `collector number ${i}`,
    predicate: (c: Card) => c.collectorNumber === i,
  }))),
  new Group<Card>(`Creatures`, families().flatMap(family => [
    // Common
    ...requirementCreator({ count: 3, rarity: 'common', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.primary], distributedSubtypes: [family.class.primary, family.class.secondary, family.class.primary] }),
    ...requirementCreator({ count: primaryRacesPerPrimaryColor[family.color.secondary].length, rarity: 'common', colors: [family.color.primary, family.color.secondary], types: ['creature'], subtypes: [family.race.primary], distributedSubtypes: primaryRacesPerPrimaryColor[family.color.secondary] }),
    ...requirementCreator({ count: 2, rarity: 'common', colors: [family.color.secondary], types: ['creature'], subtypes: [family.race.primary], distributedSubtypes: [family.class.primary] }),
    ...requirementCreator({ count: 1, rarity: 'common', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.secondary, family.class.primary] }),
    ...requirementCreator({ count: 1, rarity: 'common', colors: [family.color.primary, family.color.secondary], types: ['creature'], subtypes: [family.race.primary] }),
    // Uncommon
    ...requirementCreator({ count: 2, rarity: 'uncommon', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.primary], distributedSubtypes: [family.class.primary, family.class.secondary] }),
    ...requirementCreator({ count: 1, rarity: 'uncommon', colors: [family.color.primary, family.color.secondary], types: ['creature'], subtypes: [family.race.primary], distributedSubtypes: [family.class.primary] }),
    ...requirementCreator({ count: 1, rarity: 'uncommon', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.secondary, family.class.primary] }),
    ...requirementCreator({ count: 1, rarity: 'uncommon', colors: [family.color.primary, family.color.secondary], types: ['creature'], subtypes: [family.race.primary] }),
    // Rare
    ...requirementCreator({ rarity: 'rare', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.primary] }),
    ...requirementCreator({ rarity: 'rare', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.primary, family.race.secondary] }),
    ...requirementCreator({ rarity: 'rare', colors: [family.color.primary, family.color.secondary], types: ['creature'], subtypes: [family.race.primary] }),
    // Mythic
    ...requirementCreator({ rarity: 'mythic', colors: [family.color.primary], types: ['creature'], subtypes: [family.race.primary] }),
  ])),
];
