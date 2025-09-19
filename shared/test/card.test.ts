/* eslint-disable max-len */
import { expect, test } from 'vitest';
import { Card, landSubtypeToColor, SerializedCard, tryParseLoyaltyAbility } from '../src';

test('land subtypes', () => {
  expect(landSubtypeToColor('forest')).toBe('green');
  expect(landSubtypeToColor('plains')).toBe('white');
  expect(landSubtypeToColor('island')).toBe('blue');
  expect(landSubtypeToColor('swamp')).toBe('black');
  expect(landSubtypeToColor('mountain')).toBe('red');
  expect(landSubtypeToColor('abc')).toBeUndefined();
});

test('loyalty', () => {
  expect(tryParseLoyaltyAbility({ variant: 'keyword', content: 'flying' })).toStrictEqual({ success: false });
  expect(tryParseLoyaltyAbility({ variant: 'ability', content: '+1: Hello!' })).toStrictEqual({
    success: true, cost: 1, content: 'Hello!',
  });
});

test('loyalty - complex', () => {
  const scenarios = [
    'adflk: adfadsf',
    '3: adf',
    '+4: adf',
    '-2: adf',
    '-0: adf',
    '0: adf',
    '5: 3fad:',
    'adf6: adf',
    '9ad: 2:',
    'a: 2: adfadafsfasdf',
    '+0: adf',
    '+69: adf',
    '-96: adfasd',
    ': adf',
    '7: 323:',
    '+8:+23:',
    '+93:adsf',
    '-94:def6',
    '+11',
    '-10',
    '+10: yes',
    '+01: no',
    '-: adf',
    '+: def',
    '+13 adf',
    '-14 def',
    '+13: adfasdf jh',
    ':32: adf',
    '+-adf: adf',
    '+15: A text that is longer with multile spaces (weird characters)',
    '+16adfadf',
    '+17 adf',
    '-X: adfasdf',
    '+X: yes',
    'X: no',
    'nno: +X',
    '-x: no',
    '+x: no',
  ];
  expect(scenarios.map(s => tryParseLoyaltyAbility({ variant: 'ability', content: s }))).toMatchSnapshot();
});

test('creature card', () => {
  const serializedCreatureCard: SerializedCard = {
    id: 'creature',
    name: 'Sam, The Great',
    rarity: 'rare',
    isToken: undefined,
    supertype: undefined,
    tokenColors: undefined,
    types: ['creature'],
    subtypes: ['human', 'warrior'],
    manaCost: { x: 2, colorless: 2, white: 1, blue: 0 },
    rules: [
      { variant: 'card-type-reminder', content: 'A creature can\'t attack unless it has been under its controller\'s control continuously since their most recent turn began.' },
      { variant: 'keyword', content: 'vigilance' },
      { variant: 'keyword', content: 'first strike' },
      { variant: 'keyword', content: 'lifelink' },
      { variant: 'inline-reminder', content: 'Damage dealt by this creature also causes you to gain that much life.' },
      { variant: 'keyword', content: 'double strike' },
      { variant: 'keyword', content: 'flying' },
      { variant: 'keyword', content: 'extort' },
      { variant: 'inline-reminder', content: 'Whenever you cast a spell, you may pay {w/b}. If you do, each opponent loses 1 life and you gain that much life.' },
      { variant: 'ability', content: 'When ~ enters, add {g} or {r/w}.' },
      { variant: 'flavor', content: 'To be, or not to be, that is the question.' },
    ],
    pt: { power: 2, toughness: 2 },
    loyalty: undefined,
    collectorNumber: 1,
    art: undefined,
    tags: { 'test': true },
  };
  const creatureCard = new Card(serializedCreatureCard);
  expect(creatureCard.manaValue()).toBe(3);
  expect(creatureCard.renderManaCost()).toBe('{x}{x}{2}{w}');
  expect(creatureCard.renderTypeLine()).toBe('Creature — Human Warrior');
  expect(creatureCard.renderRules()).toBe('{i}(A creature can\'t attack unless it has been under its controller\'s control continuously since their most recent turn began.){/i}\n' +
    'Vigilance, first strike\n' +
    'Lifelink {i}(Damage dealt by this creature also causes you to gain that much life.){/i}\n' +
    'Double strike, flying\n' +
    'Extort {i}(Whenever you cast a spell, you may pay {w/b}. If you do, each opponent loses 1 life and you gain that much life.){/i}\n' +
    'When Sam enters, add {g} or {r/w}.{flavor}To be, or not to be, that is the question.',
  );
  expect(creatureCard.loyaltyAbilities()).toStrictEqual([]);
  expect(creatureCard.color()).toStrictEqual(['white']);
  expect(creatureCard.colorIdentity()).toStrictEqual(['red', 'green', 'white']);
  expect(creatureCard.toJson()).toStrictEqual(serializedCreatureCard);
  expect(creatureCard.getReferenceName()).toBe('2/2 white Human Warrior creature');
  expect(creatureCard.explain()).toBe('"Sam, The Great" (#1) is a rare 2/2 white Human Warrior creature for {x}{x}{2}{w} mana, with: "vigilance", "first strike", "lifelink", "double strike", "flying", "extort" and "When ~ enters, add {g} or {r/w}.".');
  expect(creatureCard.getCreatableTokenNames()).toStrictEqual([]);
  expect(creatureCard.getTagAsString('test')).toBe(undefined);
  expect(creatureCard.getTagAsString('test', { stringify: true })).toBe('true');
  expect(creatureCard.getTagAsNumber('test')).toBe(undefined);
  expect(creatureCard.getTagAsNumber('test', { parseFromBoolean: true })).toBe(1);
});

test('token card', () => {
  const serializedTokenCard: SerializedCard = {
    id: '821-1-1-white-mouse-token',
    'name': 'Mouse',
    'rarity': 'common',
    'isToken': true,
    'tokenColors': [
      'white',
    ],
    'types': [
      'creature',
    ],
    'subtypes': [
      'mouse',
    ],
    'manaCost': {},
    'rules': [],
    'pt': {
      'power': 1,
      'toughness': 1,
    },
    'collectorNumber': 821,
    'art': '821-1-1-white-mouse-token-1495ce55-c5f9-4f25-bcf0-9957f4c3d0d6.png',
    'tags': {
      'status': 'concept',
      'createdAt': '2025-09-01',
      'setting': 'A small gray mouse stands triumphantly atop a wheel of cheese in a moonlit pantry, crumbs scattered around its tiny paws.',
    },
  };
  const tokenCard = new Card(serializedTokenCard);
  expect(tokenCard.manaValue()).toBe(0);
  expect(tokenCard.renderManaCost()).toBe('');
  expect(tokenCard.renderTypeLine()).toBe('Token Creature — Mouse');
  expect(tokenCard.renderRules()).toBe('');
  expect(tokenCard.loyaltyAbilities()).toStrictEqual([]);
  expect(tokenCard.color()).toStrictEqual(['white']);
  expect(tokenCard.colorIdentity()).toStrictEqual(['white']);
  expect(tokenCard.toJson()).toStrictEqual({ ...serializedTokenCard, supertype: undefined, loyalty: undefined });
  expect(tokenCard.getReferenceName()).toBe('1/1 white Mouse creature token');
  expect(tokenCard.explain()).toBe('"Mouse" (#821) is a common 1/1 white Mouse creature token.');
  expect(tokenCard.getCreatableTokenNames()).toStrictEqual([]);
  expect(tokenCard.getTagAsString('status')).toBe('concept');
});

test('planeswalker card', () => {
  const serializedPlaneswalkerCard: SerializedCard = {
    id: 'farock-the-damned-doctor',
    'name': 'Farock, The Damned Doctor',
    'rarity': 'rare',
    'supertype': 'legendary',
    'types': [
      'planeswalker',
    ],
    'subtypes': [],
    'manaCost': {
      'colorless': 1,
      'black': 2,
    },
    'rules': [
      {
        'variant': 'keyword',
        'content': 'deathtouch',
      },
      {
        'variant': 'keyword',
        'content': 'lifelink',
      },
      {
        variant: 'ability',
        content: 'When ~ enters, you gain 2 life.',
      },
      {
        'variant': 'ability',
        'content': '+1: Create a 1/1 black Zombie creature token with menace.',
      },
      {
        'variant': 'ability',
        'content': '-4: Deal 1 damage to any target. Create a Treasure token.',
      },
      {
        'variant': 'ability',
        'content': '-X: Deal 1 damage to up to X targets.',
      },
    ],
    'loyalty': 3,
    'collectorNumber': 822,
  };
  const planeswalkerCard = new Card(serializedPlaneswalkerCard);
  expect(planeswalkerCard.manaValue()).toBe(3);
  expect(planeswalkerCard.renderManaCost()).toBe('{1}{b}{b}');
  expect(planeswalkerCard.renderTypeLine()).toBe('Legendary Planeswalker — Farock');
  expect(planeswalkerCard.renderRules()).toBe('Deathtouch, lifelink\nWhen Farock enters, you gain 2 life.');
  expect(planeswalkerCard.loyaltyAbilities()).toStrictEqual([
    { cost: 1, content: 'Create a 1/1 black Zombie creature token with menace.' },
    { cost: -4, content: 'Deal 1 damage to any target. Create a Treasure token.' },
    { cost: '-X', content: 'Deal 1 damage to up to X targets.' },
  ]);
  expect(planeswalkerCard.color()).toStrictEqual(['black']);
  expect(planeswalkerCard.colorIdentity()).toStrictEqual(['black']);
  expect(planeswalkerCard.toJson()).toStrictEqual({ ...serializedPlaneswalkerCard, art: undefined, pt: undefined, tags: {}, tokenColors: undefined, isToken: undefined });
  expect(planeswalkerCard.getReferenceName()).toBe('legendary black planeswalker');
  expect(planeswalkerCard.explain()).toBe('"Farock, The Damned Doctor" (#822) is a rare legendary black planeswalker for {1}{b}{b} mana with 3 starting loyalty, with: "deathtouch", "lifelink" and "When ~ enters, you gain 2 life." and "+1: Create a 1/1 black Zombie creature token with menace." and "-4: Deal 1 damage to any target. Create a Treasure token." and "-X: Deal 1 damage to up to X targets.".');
  expect(planeswalkerCard.getCreatableTokenNames()).toStrictEqual(['1/1 black Zombie creature token with menace', 'Treasure token']);
});
