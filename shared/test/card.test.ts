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
    isToken: undefined,
    rarity: 'rare',
    collectorNumber: 1,
    tags: { 'test': true },
    faces: [{
      name: 'Sam, The Great',
      tokenColors: undefined,
      supertype: undefined,
      types: ['creature'],
      subtypes: ['human', 'warrior'],
      manaCost: { x: 2, colorless: 2, white: 1, blue: 0 },
      rules: [
        {
          variant: 'card-type-reminder',
          content: 'A creature can\'t attack unless it has been under its controller\'s control continuously since their most recent turn began.',
        },
        { variant: 'keyword', content: 'vigilance' },
        { variant: 'keyword', content: 'first strike' },
        { variant: 'keyword', content: 'lifelink' },
        { variant: 'inline-reminder', content: 'Damage dealt by this creature also causes you to gain that much life.' },
        { variant: 'keyword', content: 'double strike' },
        { variant: 'keyword', content: 'flying' },
        { variant: 'keyword', content: 'extort' },
        {
          variant: 'inline-reminder',
          content: 'Whenever you cast a spell, you may pay {w/b}. If you do, each opponent loses 1 life and you gain that much life.',
        },
        { variant: 'ability', content: 'When ~ enters, add {g} or {r/w}.' },
        { variant: 'flavor', content: 'To be, or not to be, that is the question.' },
      ],
      pt: { power: 2, toughness: 2 },
      loyalty: undefined,
      art: undefined,
    }],
  };
  const creatureCard = new Card(serializedCreatureCard);
  expect(creatureCard.faces.length).toBe(1);
  expect(creatureCard.getTagAsString('test')).toBe(undefined);
  expect(creatureCard.getTagAsString('test', { stringify: true })).toBe('true');
  expect(creatureCard.getTagAsNumber('test')).toBe(undefined);
  expect(creatureCard.getTagAsNumber('test', { parseFromBoolean: true })).toBe(1);
  expect(creatureCard.toJson()).toStrictEqual(serializedCreatureCard);

  const frontFace = creatureCard.faces[0];
  expect(frontFace.manaValue()).toBe(3);
  expect(frontFace.renderManaCost()).toBe('{x}{x}{2}{w}');
  expect(frontFace.renderTypeLine()).toBe('Creature — Human Warrior');
  expect(frontFace.renderRules()).toBe('{i}(A creature can\'t attack unless it has been under its controller\'s control continuously since their most recent turn began.){/i}\n' +
    'Vigilance, first strike\n' +
    'Lifelink {i}(Damage dealt by this creature also causes you to gain that much life.){/i}\n' +
    'Double strike, flying\n' +
    'Extort {i}(Whenever you cast a spell, you may pay {w/b}. If you do, each opponent loses 1 life and you gain that much life.){/i}\n' +
    'When Sam enters, add {g} or {r/w}.{flavor}To be, or not to be, that is the question.',
  );
  expect(frontFace.loyaltyAbilities()).toStrictEqual([]);
  expect(frontFace.color()).toStrictEqual(['white']);
  expect(frontFace.colorIdentity()).toStrictEqual(['red', 'green', 'white']);
  expect(frontFace.getReferenceName()).toBe('2/2 white Human Warrior creature');
  expect(frontFace.explain()).toBe('"Sam, The Great" (#1) is a rare 2/2 white Human Warrior creature for {x}{x}{2}{w} mana, with: "vigilance", "first strike", "lifelink", "double strike", "flying", "extort" and "When ~ enters, add {g} or {r/w}.".');
  expect(frontFace.getCreatableTokenNames()).toStrictEqual([]);
});

test('token card', () => {
  const serializedTokenCard: SerializedCard = {
    id: '821-1-1-white-mouse-token',
    'rarity': 'common',
    'isToken': true,
    faces: [{
      'name': 'Mouse',
      'tokenColors': [
        'white',
      ],
      manaCost: undefined,
      'types': [
        'creature',
      ],
      'subtypes': [
        'mouse',
      ],
      supertype: undefined,
      'rules': [],
      'pt': {
        'power': 1,
        'toughness': 1,
      },
      loyalty: undefined,
      'art': '821-1-1-white-mouse-token-1495ce55-c5f9-4f25-bcf0-9957f4c3d0d6.png',
    }],
    'collectorNumber': 821,
    'tags': {
      'status': 'concept',
      'createdAt': '2025-09-01',
      'setting': 'A small gray mouse stands triumphantly atop a wheel of cheese in a moonlit pantry, crumbs scattered around its tiny paws.',
    },
  };
  const tokenCard = new Card(serializedTokenCard);
  expect(tokenCard.toJson()).toStrictEqual(serializedTokenCard);
  expect(tokenCard.getTagAsString('status')).toBe('concept');

  const frontFace = tokenCard.faces[0];
  expect(frontFace.manaValue()).toBe(0);
  expect(frontFace.renderManaCost()).toBe('');
  expect(frontFace.renderTypeLine()).toBe('Token Creature — Mouse');
  expect(frontFace.renderRules()).toBe('');
  expect(frontFace.loyaltyAbilities()).toStrictEqual([]);
  expect(frontFace.color()).toStrictEqual(['white']);
  expect(frontFace.colorIdentity()).toStrictEqual(['white']);
  expect(frontFace.getReferenceName()).toBe('1/1 white Mouse creature token');
  expect(frontFace.explain()).toBe('"Mouse" (#821) is a common 1/1 white Mouse creature token.');
  expect(frontFace.getCreatableTokenNames()).toStrictEqual([]);
});

test('planeswalker card', () => {
  const serializedPlaneswalkerCard: SerializedCard = {
    id: 'farock-the-damned-doctor',
    isToken: undefined,
    'rarity': 'rare',
    faces: [{
      'name': 'Farock, The Damned Doctor',
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
      art: undefined,
      pt: undefined,
      tokenColors: undefined,
    }],
    'collectorNumber': 822,
    tags: {},
  };
  const planeswalkerCard = new Card(serializedPlaneswalkerCard);
  expect(planeswalkerCard.toJson()).toStrictEqual(serializedPlaneswalkerCard);

  const frontFace = planeswalkerCard.faces[0];
  expect(frontFace.manaValue()).toBe(3);
  expect(frontFace.renderManaCost()).toBe('{1}{b}{b}');
  expect(frontFace.renderTypeLine()).toBe('Legendary Planeswalker — Farock');
  expect(frontFace.renderRules()).toBe('Deathtouch, lifelink\nWhen Farock enters, you gain 2 life.');
  expect(frontFace.loyaltyAbilities()).toStrictEqual([
    { cost: 1, content: 'Create a 1/1 black Zombie creature token with menace.' },
    { cost: -4, content: 'Deal 1 damage to any target. Create a Treasure token.' },
    { cost: '-X', content: 'Deal 1 damage to up to X targets.' },
  ]);
  expect(frontFace.color()).toStrictEqual(['black']);
  expect(frontFace.colorIdentity()).toStrictEqual(['black']);
  expect(frontFace.getReferenceName()).toBe('legendary black planeswalker');
  expect(frontFace.explain()).toBe('"Farock, The Damned Doctor" (#822) is a rare legendary black planeswalker for {1}{b}{b} mana with 3 starting loyalty, with: "deathtouch", "lifelink" and "When ~ enters, you gain 2 life." and "+1: Create a 1/1 black Zombie creature token with menace." and "-4: Deal 1 damage to any target. Create a Treasure token." and "-X: Deal 1 damage to up to X targets.".');
  expect(frontFace.getCreatableTokenNames()).toStrictEqual(['1/1 black Zombie creature token with menace', 'Treasure token']);
});
