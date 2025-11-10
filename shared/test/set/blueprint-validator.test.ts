/* eslint-disable max-len */
import { BlueprintValidator, Card, SerializableBlueprintWithSource, SerializedCard } from '../../src';
import { expect, test } from 'vitest';

test('blueprint validator', async () => {
  const serializedCard: SerializedCard = {
    id: 'mfy-401',
    'rarity': 'mythic',
    faces: [{
      'name': 'Miffy, The Kind',
      'supertype': 'legendary',
      'types': [
        'creature',
      ],
      'subtypes': [
        'rabbit',
        'advisor',
      ],
      'manaCost': {
        'generic': 1,
        'white': 2,
      },
      'rules': [
        {
          'variant': 'ability',
          'content': "~ can't be blocked by creatures with power 3 or greater.",
        },
        {
          'variant': 'ability',
          'content': 'Whenever ~ attacks, exile target creature an opponent controls with mana value X or less, where X is the number of creatures you control with power 2 or less.',
        },
        {
          'variant': 'ability',
          'content': "When ~ leaves the battlefield, return the exiled cards to their owners' hands and create that many 1/1 white Rabbit creature tokens.{lns}",
        },
      ],
      'pt': {
        'power': 2,
        'toughness': 3,
      },
      'art': 'mfy/miffy-the-kind.jpg',
    }],
    'collectorNumber': 401,
    'tags': {
      'status': 'concept',
      'createdAt': '2025-07-29',
      'set': 'MFY',
      'setting': 'Miffy on a yellow background holding a red balloon her hand.',
      'deck/gw-tokens': 1,
    },
  };
  const exampleCard = new Card(serializedCard);

  const exampleMetadata = {
    'mainCharacter': 'Miffy, The Kind',
    'mainToken': '1/1 white Rabbit creature token',
    'mechanicA': 'lifelink',
    'mechanicB': 'power 2 or less',
    'mechanicC': 'exile',
    'mechanicD': 'protection',
    'creatureTypeA': 'Cat',
    'creatureTypeB': 'Bird',
  };

  const exampleSetBlueprint: SerializableBlueprintWithSource = {
    source: 'set',
    blueprint: {
      subtypes: [{ key: 'string-array/allow', value: ['rabbit', 'bird', 'cat', 'dog', 'pig', 'human', 'advisor'] }],
    },
  };

  const exampleArchetypeBlueprint: SerializableBlueprintWithSource = {
    source: 'archetype',
    blueprint: {
      color: [
        { key: 'string-array/includes-all-of', value: ['white'] },
        { key: 'string-array/length', value: { key: 'number/one-of', value: [1] } },
      ],
    },
  };

  const exampleCycleBlueprint: SerializableBlueprintWithSource = {
    source: 'cycle',
    blueprint: {
      name: [{ key: 'string/contain-one-of', value: ['$[mainCharacter]'] }],
      rarity: [{ key: 'string/contain-one-of', value: ['mythic'] }],
      supertype: [{ key: 'string/contain-one-of', value: ['legendary'] }],
      types: [{ key: 'string-array/includes-all-of', value: ['creature'] }],
      subtypes: [{ key: 'string-array/includes-all-of', value: ['rabbit'] }],
      rules: [{ key: 'string/contain-all-of', value: ['$[mechanicB]', '$[mechanicC]'] }],
    },
  };

  const validator = new BlueprintValidator();
  const result = validator.validate({
    metadata: exampleMetadata,
    blueprints: [exampleSetBlueprint, exampleArchetypeBlueprint, exampleCycleBlueprint],
    card: exampleCard,
  });
  expect(result).toStrictEqual({ success: true });
});
