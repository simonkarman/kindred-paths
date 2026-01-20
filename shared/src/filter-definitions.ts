import { cardColors, wubrg } from './colors';
import { cardLayouts, cardRarities } from './card';

export type FilterDefinition = {
  keys: string[];
  description: string;

  /** Optional validation - can be undefined (all string values are valid) or an array of valid values or a regex pattern */
  validation?: readonly string[] | RegExp;

  /** Example search terms using this filter */
  examples: string[];
};

export const filterDefinitions: FilterDefinition[] = [
  {
    keys: ['layout', 'l'],
    description: 'card layout must exactly match',
    validation: cardLayouts,
    examples: ['layout:normal', 'l:adventure', 'layout!:transform'],
  },
  {
    keys: ['type', 't'],
    description: 'card type line must include (eq. "creature", "token", "legendary", "human", etc.)',
    examples: ['type:creature', 't:legendary', 'type:human t:wizard'],
  },
  {
    keys: ['rarity', 'r'],
    description: 'card rarity must exactly match',
    validation: [...cardRarities, ...cardRarities.map((r: string) => r[0])],
    examples: ['rarity:rare', 'r:m', 'rarity:uncommon'],
  },
  {
    keys: ['color', 'c'],
    description: 'card must have the provide color description ("colorless", "multicolor") or includes the provided color (eq. "red", "blue", etc.)',
    validation: [...cardColors, ...wubrg, 'colorless', 'c', 'multicolor', 'multi', 'm'],
    examples: ['color:red', 'c:multicolor', 'c:u c:b'],
  },
  {
    keys: ['color-identity', 'ci'],
    description: 'card must have the provide color identity description ("colorless", "multicolor") ' +
      'or includes the provided color in its identity (eq. "red", "blue", etc.)',
    validation: [...cardColors, ...wubrg, 'colorless', 'c', 'multicolor', 'multi', 'm'],
    examples: ['color-identity:green', 'ci:colorless', 'ci:w ci:u'],
  },
  {
    keys: ['producible-color', 'pc'],
    description: 'card must be able to produce the provide color description ("none", "multicolor") ' +
      'or includes the provided color in its identity (eq. "red", "blue", etc.)',
    validation: [...cardColors, ...wubrg, 'none', 'n', 'multicolor', 'multi', 'm'],
    examples: ['producible-color:green', 'pc:multicolor', 'pc:none'],
  },
  {
    keys: ['manavalue', 'mv'],
    description: 'Matches if the card mana value meets this requirement (eq. "3", "2+", "12-", etc.)',
    validation: /^\d+$|^\d+[+-]$/,
    examples: ['manavalue:3', 'mv:2+', 'mv:5-'],
  },
  {
    keys: ['pt'],
    description: 'Matches if the card power/toughness meets this requirement ' +
      '(eq. "yes", "no", "1/1", "2/4", "1+/5-", "/3", "5/", "n/n", "n+/n", "n/n-", "n+1/n", etc.)',
    validation: /^yes$|^no$|^n\/n(?:[+-]\d*)?$|^n(?:[+-]\d*)?\/n$|^(?:\d+[+-]?)?\/(?:\d+[+-]?)?$/,
    examples: ['pt:yes', 'pt:1/1', 'pt:2/4', 'pt:3+/', 'pt:n/n'],
  },
  {
    keys: ['rules'],
    description: 'card rules text must include',
    examples: ['rules:tapped', 'rules:draw', 'rules:trample'],
  },
  {
    keys: ['reminder'],
    description: 'card reminder text must include',
    examples: ['reminder:add', 'reminder:permanent'],
  },
  {
    keys: ['flavor'],
    description: 'card flavor text must include',
    examples: ['flavor:journey', 'flavor:ancient'],
  },
  {
    keys: ['deck', 'd'],
    description: 'card must be included in the deck with this name',
    examples: ['deck:aggro', 'd:control'],
  },
  {
    keys: ['set', 's'],
    description: 'card set code must exactly match',
    examples: ['set:DKI', 's:MFY'],
  },
  {
    keys: ['tag'],
    description: 'card must have this tag (eq. "set", etc.) or have this tag whose value contains something (eq. "set=BLT", "deck/main=2", etc.)',
    examples: ['tag:set', 'tag:set=BLT', 'tag:deck/main=2'],
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
