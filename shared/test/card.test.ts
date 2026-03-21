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
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    rarity: 'rare',
    collectorNumber: 1,
    tags: { 'test': true },
    faces: [{
      name: 'Sam, The Great',
      givenColors: undefined,
      supertype: undefined,
      types: ['creature'],
      subtypes: ['human', 'warrior'],
      manaCost: { x: 2, generic: 2, white: 1, blue: 0 },
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
    cid: '01234567',
    'rarity': 'common',
    'isToken': true,
    layout: 'normal',
    faces: [{
      'name': 'Mouse',
      'givenColors': [
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

test('hybrid mana card', () => {
  const serializedHybridCard: SerializedCard = {
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    rarity: 'uncommon',
    collectorNumber: 50,
    tags: {},
    faces: [{
      name: 'Hybrid Scholar',
      givenColors: undefined,
      supertype: undefined,
      types: ['creature'],
      subtypes: ['human', 'wizard'],
      manaCost: { generic: 1, 'white/blue': 2, black: 1 },
      rules: [
        { variant: 'keyword', content: 'flying' },
        { variant: 'ability', content: 'When ~ enters, draw a card.' },
      ],
      pt: { power: 2, toughness: 3 },
      loyalty: undefined,
      art: undefined,
    }],
  };
  const hybridCard = new Card(serializedHybridCard);
  expect(hybridCard.faces.length).toBe(1);
  expect(hybridCard.toJson()).toStrictEqual(serializedHybridCard);

  const frontFace = hybridCard.faces[0];
  // Hybrid pips contribute 1 each to mana value, so: generic(1) + white/blue(2) + black(1) = 4
  expect(frontFace.manaValue()).toBe(4);
  // Render order: generic, then hybrid (sorted by short notation), then mono-colored in WUBRG order
  expect(frontFace.renderManaCost()).toBe('{1}{w/u}{w/u}{b}');
  expect(frontFace.renderTypeLine()).toBe('Creature — Human Wizard');
  // Color from mana cost: white (from w/u), blue (from w/u), black (from b)
  expect(frontFace.color()).toStrictEqual(['white', 'blue', 'black']);
  // Color identity includes colors from rules text too (no extra here)
  expect(frontFace.colorIdentity()).toStrictEqual(['white', 'blue', 'black']);
  expect(frontFace.getReferenceName()).toBe('2/3 white, blue, and black Human Wizard creature');
});

test('hybrid mana only card', () => {
  const serializedHybridOnlyCard: SerializedCard = {
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    rarity: 'common',
    collectorNumber: 51,
    tags: {},
    faces: [{
      name: 'Goblin Diplomat',
      givenColors: undefined,
      supertype: undefined,
      types: ['creature'],
      subtypes: ['goblin'],
      manaCost: { 'red/green': 1 },
      rules: [],
      pt: { power: 1, toughness: 1 },
      loyalty: undefined,
      art: undefined,
    }],
  };
  const card = new Card(serializedHybridOnlyCard);
  const face = card.faces[0];
  expect(face.manaValue()).toBe(1);
  expect(face.renderManaCost()).toBe('{r/g}');
  expect(face.color()).toStrictEqual(['red', 'green']);
  expect(face.colorIdentity()).toStrictEqual(['red', 'green']);
});

test('hybrid mana with multiple hybrid pairs', () => {
  const serializedMultiHybridCard: SerializedCard = {
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    rarity: 'rare',
    collectorNumber: 52,
    tags: {},
    faces: [{
      name: 'Prismatic Agent',
      givenColors: undefined,
      supertype: undefined,
      types: ['creature'],
      subtypes: ['shapeshifter'],
      manaCost: { 'white/blue': 1, 'black/red': 1, green: 1 },
      rules: [
        { variant: 'keyword', content: 'flying' },
      ],
      pt: { power: 3, toughness: 3 },
      loyalty: undefined,
      art: undefined,
    }],
  };
  const card = new Card(serializedMultiHybridCard);
  const face = card.faces[0];
  // 1 + 1 + 1 = 3
  expect(face.manaValue()).toBe(3);
  // Hybrid pips sorted by short notation: b/r < w/u, then mono-colored
  expect(face.renderManaCost()).toBe('{b/r}{w/u}{g}');
  // Colors from all mana: white, blue (from w/u), black, red (from b/r), green
  expect(face.color()).toStrictEqual(['white', 'blue', 'black', 'red', 'green']);
  expect(face.colorIdentity()).toStrictEqual(['white', 'blue', 'black', 'red', 'green']);
});

test('hybrid mana zero-cost renders {0}', () => {
  const serializedZeroCostCard: SerializedCard = {
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    rarity: 'common',
    collectorNumber: 53,
    tags: {},
    faces: [{
      name: 'Empty Vessel',
      givenColors: undefined,
      supertype: undefined,
      types: ['artifact'],
      subtypes: [],
      manaCost: { 'white/blue': 0 },
      rules: [],
      pt: undefined,
      loyalty: undefined,
      art: undefined,
    }],
  };
  const card = new Card(serializedZeroCostCard);
  const face = card.faces[0];
  expect(face.manaValue()).toBe(0);
  expect(face.renderManaCost()).toBe('{0}');
  // Zero hybrid mana contributes no colors
  expect(face.color()).toStrictEqual([]);
});

test('hybrid mana with color identity from rules', () => {
  const serializedHybridWithRulesCard: SerializedCard = {
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    rarity: 'uncommon',
    collectorNumber: 54,
    tags: {},
    faces: [{
      name: 'Dual Channeler',
      givenColors: undefined,
      supertype: undefined,
      types: ['creature'],
      subtypes: ['elf', 'shaman'],
      manaCost: { 'green/white': 2 },
      rules: [
        { variant: 'ability', content: '{T}: Add {r}.' },
      ],
      pt: { power: 1, toughness: 2 },
      loyalty: undefined,
      art: undefined,
    }],
  };
  const card = new Card(serializedHybridWithRulesCard);
  const face = card.faces[0];
  expect(face.manaValue()).toBe(2);
  expect(face.renderManaCost()).toBe('{g/w}{g/w}');
  // Color from mana cost only: green, white
  expect(face.color()).toStrictEqual(['green', 'white']);
  // Color identity includes red from rules text {r}
  expect(face.colorIdentity()).toStrictEqual(['red', 'green', 'white']);
});

test('planeswalker card', () => {
  const serializedPlaneswalkerCard: SerializedCard = {
    cid: '01234567',
    isToken: undefined,
    layout: 'normal',
    'rarity': 'rare',
    faces: [{
      'name': 'Farock, The Damned Doctor',
      'supertype': 'legendary',
      'types': [
        'planeswalker',
      ],
      'subtypes': [],
      'manaCost': {
        'generic': 1,
        'colorless': 3,
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
      givenColors: undefined,
    }],
    'collectorNumber': 822,
    tags: {},
  };
  const planeswalkerCard = new Card(serializedPlaneswalkerCard);
  expect(planeswalkerCard.toJson()).toStrictEqual(serializedPlaneswalkerCard);

  const frontFace = planeswalkerCard.faces[0];
  expect(frontFace.manaValue()).toBe(6);
  expect(frontFace.renderManaCost()).toBe('{1}{c}{c}{c}{b}{b}');
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
  expect(frontFace.explain()).toBe('"Farock, The Damned Doctor" (#822) is a rare legendary black planeswalker for {1}{c}{c}{c}{b}{b} mana with 3 starting loyalty, with: "deathtouch", "lifelink" and "When ~ enters, you gain 2 life." and "+1: Create a 1/1 black Zombie creature token with menace." and "-4: Deal 1 damage to any target. Create a Treasure token." and "-X: Deal 1 damage to up to X targets.".');
  expect(frontFace.getCreatableTokenNames()).toStrictEqual(['1/1 black Zombie creature token with menace', 'Treasure token']);
});
