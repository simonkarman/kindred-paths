import { cardColors, wubrg } from './colors';
import { cardLayouts, cardRarities } from './card';

export type FilterDefinition = {
  keys: string[];
  description: string;

  /** Optional validation - can be undefined (all string values are valid) or an array of valid values or a regex pattern */
  validation?: readonly string[] | RegExp;
};

export const filterDefinitions: FilterDefinition[] = [
  {
    keys: ['layout', 'l'],
    description: 'card layout must exactly match',
    validation: cardLayouts,
  },
  {
    keys: ['type', 't'],
    description: 'card type line must include (eq. "creature", "token", "legendary", "human", etc.)',
  },
  {
    keys: ['rarity', 'r'],
    description: 'card rarity must exactly match',
    validation: [...cardRarities, ...cardRarities.map((r: string) => r[0])],
  },
  {
    keys: ['color', 'c'],
    description: 'card must have the provide color description ("colorless", "multicolor") or includes the provided color (eq. "red", "blue", etc.)',
    validation: [...cardColors, ...wubrg, 'colorless', 'c', 'multicolor', 'multi', 'm'],
  },
  {
    keys: ['color-identity', 'ci'],
    description: 'card must have the provide color identity description ("colorless", "multicolor") ' +
      'or includes the provided color in its identity (eq. "red", "blue", etc.)',
    validation: [...cardColors, ...wubrg, 'colorless', 'c', 'multicolor', 'multi', 'm'],
  },
  {
    keys: ['producible-color', 'pc'],
    description: 'card must be able to produce the provide color description ("none", "multicolor") ' +
      'or includes the provided color in its identity (eq. "red", "blue", etc.)',
    validation: [...cardColors, ...wubrg, 'none', 'n', 'multicolor', 'multi', 'm'],
  },
  {
    keys: ['manavalue', 'mv'],
    description: 'Matches if the card mana value meets this requirement (eq. "3", "2+", "12-", etc.)',
    validation: /^\d+$|^\d+[+-]$/,
  },
  {
    keys: ['pt'],
    description: 'Matches if the card power/toughness meets this requirement ' +
      '(eq. "yes", "no", "1/1", "2/4", "1+/5-", "/3", "5/", "n/n", "n+/n", "n/n-", "n+1/n", etc.)',
    validation: /^yes$|^no$|^n\/n(?:[+-]\d*)?$|^n(?:[+-]\d*)?\/n$|^(?:\d+[+-]?)?\/(?:\d+[+-]?)?$/,
  },
  {
    keys: ['rules'],
    description: 'card rules text must include',
  },
  {
    keys: ['reminder'],
    description: 'card reminder text must include',
  },
  {
    keys: ['flavor'],
    description: 'card flavor text must include',
  },
  {
    keys: ['deck', 'd'],
    description: 'card must be included in the deck with this name',
  },
  {
    keys: ['set', 's'],
    description: 'card set code must exactly match',
  },
  {
    keys: ['tag'],
    description: 'card must have this tag (eq. "set", etc.) or have this tag whose value contains something (eq. "set=BLT", "deck/main=2", etc.)',
  },
];

export const getAllFilterKeys = (): string[] => {
  return filterDefinitions.flatMap(def => def.keys);
};

export const getPrimaryFilterKey = (key: string): string | undefined => {
  const definition = filterDefinitions.find(def => def.keys.includes(key));
  return definition?.keys[0];
};

export const getFilterDefinition = (key: string): FilterDefinition | undefined => {
  return filterDefinitions.find(def => def.keys.includes(key));
};
