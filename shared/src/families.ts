import { CardColor } from './card';

export type Family = {
  name: string,
  color: {
    primary: CardColor,
    secondary: CardColor,
  },
  focus: 'legacy' | 'future',
  race: {
    primary: string,
    secondary: string,
  },
  class: {
    primary: string,
    secondary: string,
  },
};

export const families: () => ReadonlyArray<Family> = () => [
  {
    name: 'Azurian',
    color: { primary: 'white', secondary: 'blue' },
    focus: 'future',
    race: { primary: 'fox', secondary: 'angel' },
    class: { primary: 'advisor', secondary: 'cleric' },
  },
  {
    name: 'Selenworth',
    color: { primary: 'white', secondary: 'green' },
    focus: 'future',
    race: { primary: 'cat', secondary: 'angel' },
    class: { primary: 'scout', secondary: 'cleric' },
  },
  {
    name: 'Deepmir',
    color: { primary: 'blue', secondary: 'black' },
    focus: 'legacy',
    race: { primary: 'whale', secondary: 'sphinx' },
    class: { primary: 'rogue', secondary: 'wizard' },
  },
  {
    name: 'Simovian',
    color: { primary: 'blue', secondary: 'green' },
    focus: 'legacy',
    race: { primary: 'turtle', secondary: 'sphinx' },
    class: { primary: 'elder', secondary: 'wizard' },
  },
  {
    name: 'Orzim',
    color: { primary: 'black', secondary: 'white' },
    focus: 'legacy',
    race: { primary: 'bat', secondary: 'demon' },
    class: { primary: 'knight', secondary: 'warlock' },
  },
  {
    name: 'Rakdovale',
    color: { primary: 'black', secondary: 'red' },
    focus: 'future',
    race: { primary: 'scorpion', secondary: 'demon' },
    class: { primary: 'mercenary', secondary: 'warlock' },
  },
  {
    name: 'Borheim',
    color: { primary: 'red', secondary: 'white' },
    focus: 'future',
    race: { primary: 'goat', secondary: 'dragon' },
    class: { primary: 'berserker', secondary: 'shaman' },
  },
  {
    name: 'Izzuhart',
    color: { primary: 'red', secondary: 'blue' },
    focus: 'legacy',
    race: { primary: 'phoenix', secondary: 'dragon' },
    class: { primary: 'artificer', secondary: 'shaman' },
  },
  {
    name: 'Golgathorne',
    color: { primary: 'green', secondary: 'black' },
    focus: 'legacy',
    race: { primary: 'wolf', secondary: 'hydra' },
    class: { primary: 'archer', secondary: 'druid' },
  },
  {
    name: 'Grulest',
    color: { primary: 'green', secondary: 'red' },
    focus: 'future',
    race: { primary: 'boar', secondary: 'hydra' },
    class: { primary: 'smith', secondary: 'druid' },
  },
];

export const primaryRacesPerPrimaryColor = families().reduce((acc, family) => {
  acc[family.color.primary] = (acc[family.color.primary] || []).concat(family.race.primary);
  return acc;
}, {} as Record<CardColor, string[]>);

export const primaryRacesPerAllColors = families().reduce((acc, family) => {
  acc[family.color.primary] = Array.from(new Set((acc[family.color.primary] || []).concat(family.race.primary)));
  acc[family.color.secondary] = Array.from(new Set((acc[family.color.secondary] || []).concat(family.race.primary)));
  return acc;
}, {} as Record<CardColor, string[]>);
