import { Card } from './card';

const unknownSet = { symbol: 'pmei', shortName: 'KPA' };

export const emry = new Card({
  set: unknownSet,
  id: 43,
  name: 'Emry, Lurker of the Loch',
  manaCost: { colorless: 2, blue: 1 },
  rarity: 'rare',
  supertype: 'legendary',
  types: ['creature'],
  subtypes: ['merfolk', 'wizard'],
  rules: [
    { variant: 'ability', content: 'This spell costs {1} less to cast for each artifact you control.' },
    { variant: 'ability', content: 'When ~ enters the battlefield, put the top four cards of your library into your graveyard.' },
    { variant: 'ability', content: '{t}: Choose target artifact card in your graveyard. You may cast that card this turn.' },
    { variant: 'inline-reminder', content: 'You still pay its costs. Timing rules still apply.' },
  ],
  pt: { power: 1, toughness: 2 },
});

export const abzanDevotee = new Card({
  set: unknownSet,
  id: 68,
  name: 'Abzan Devotee',
  manaCost: { colorless: 1, black: 1 },
  rarity: 'common',
  types: ['creature'],
  subtypes: ['dog', 'cleric'],
  rules: [
    { variant: 'ability', content: '{1}: Add {w}, {b} or {g}. Activate only once each turn.' },
    { variant: 'ability', content: '{2}{b}: Return this card from your graveyard to your hand.' },
    { variant: 'flavor', content: 'The Kin-Trees rediscovered after Dromoka\'s fall are tended by carefully chosen wardens.' },
  ],
  pt: { power: 2, toughness: 1 },
});

export const herdHeirloom = new Card({
  set: unknownSet,
  id: 144,
  name: 'Herd Heirloom',
  manaCost: { colorless: 1, green: 1 },
  rarity: 'rare',
  types: ['artifact'],
  rules: [
    { variant: 'ability', content: '{t}: Add one many of any color. Spend this many only to cast a creature spell.' },
    { variant: 'ability', content: '{t}: Until end of turn, target creature you control with power 4 or greater gains trample and "Whenever this creature deals combat damage to a player, draw a card."' },
  ],
});

export const craterhoofBehemoth = new Card({
  set: unknownSet,
  id: 138,
  name: 'Craterhoof Behemoth',
  manaCost: { colorless: 5, green: 3 },
  rarity: 'mythic',
  types: ['creature'],
  subtypes: ['beast'],
  rules: [
    { variant: 'keyword', content: 'Haste' },
    { variant: 'ability', content: 'When this creature enters, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.' },
    { variant: 'flavor', content: '"Some days, you wish you were fighting a dragon." — Eshki Dragonclaw' },
  ],
  pt: { power: 5, toughness: 5 },
});

export const tundra = new Card({
  set: unknownSet,
  id: 322,
  name: 'Tundra',
  manaCost: {},
  rarity: 'rare',
  types: ['land'],
  subtypes: ['plains', 'island'],
  rules: [
    { variant: 'reminder', content: '{t}: Add {w} or {u}.' },
  ],
});

export const blindObedience = new Card({
  set: unknownSet,
  id: 9,
  name: 'Blind Obedience',
  manaCost: { colorless: 1, white: 1 },
  rarity: 'rare',
  types: ['enchantment'],
  rules: [
    { variant: 'ability', content: 'Extort' },
    { variant: 'inline-reminder', content: 'Whenever you cast a spell, you may pay {wb}. If you do, each opponent loses 1 life and you gain that much life.' },
    { variant: 'ability', content: 'Artifacts and creatures your opponents control enter tapped.' },
    { variant: 'flavor', content: '“By the time your knees have worn through your robe, you may have begun to learn your place.”' },
  ]
});
