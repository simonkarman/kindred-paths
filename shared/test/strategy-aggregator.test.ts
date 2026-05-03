import { describe, expect, test } from 'vitest';
import {
  aggregateStrategies,
  Bucket,
  BucketConfig,
  getBucketIndex,
  SerializableStrategy,
  SerializedCard,
  ToBucketNameFn,
} from '../src';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(
  cid: string,
  layout: SerializedCard['layout'],
  faces: SerializedCard['faces'],
): SerializedCard {
  return { cid, rarity: 'common', collectorNumber: 1, layout, faces };
}

/** A toBucketName stub driven by explicit per-face maps. */
function stubToBucketName(
  face0Map: Record<string, string | string[]>,
  face1Map: Record<string, string | string[]> = {},
): ToBucketNameFn {
  return (card, faceIndex) => {
    const map = faceIndex === 0 ? face0Map : face1Map;
    return map[card.cid] ?? 'unmapped';
  };
}

function makeBucketConfig(buckets: Bucket[] | string[][], toBucketName: ToBucketNameFn): BucketConfig {
  if ('matches' in buckets[0]) {
    // Already in Bucket format
    return {
      buckets: buckets as Bucket[],
      toBucketName,
    };
  }
  // Convert from string[][] format
  return {
    buckets: (buckets as string[][]).map(b => ({ title: b.join(), matches: b })),
    toBucketName,
  };
}

const SIMPLE_BUCKETS = [
  { title: 'Low', matches: ['low'] },
  { title: 'Mid', matches: ['mid'] },
  { title: 'High', matches: ['high'] },
  { title: '*', matches: ['*'] },
];

const CREATURE_FACE: SerializedCard['faces'][0] = {
  name: 'Test Creature',
  types: ['creature'],
  manaCost: { green: 1 },
  pt: { power: 1, toughness: 1 },
};

const HYBRID_FACE: SerializedCard['faces'][0] = {
  name: 'Hybrid Test',
  types: ['creature'],
  manaCost: { 'red/green': 1 },
  pt: { power: 1, toughness: 1 },
};

const INSTANT_FACE: SerializedCard['faces'][0] = {
  name: 'Test Instant',
  types: ['instant'],
  manaCost: { blue: 1 },
};

const GREEN_STRATEGY: SerializableStrategy = {
  name: 'Green creatures',
  filters: ['type:creature color:green'],
};

// ---------------------------------------------------------------------------
// getBucketIndex
// ---------------------------------------------------------------------------

describe('getBucketIndex', () => {
  const buckets = [
    { title: 'AB', matches: ['a', 'b'] },
    { title: 'C', matches: ['c'] },
    { title: '*', matches: ['*'] },
  ];

  test('finds exact match in first bucket', () => {
    expect(getBucketIndex('a', buckets)).toBe(0);
    expect(getBucketIndex('b', buckets)).toBe(0);
  });

  test('finds exact match in middle bucket', () => {
    expect(getBucketIndex('c', buckets)).toBe(1);
  });

  test('falls back to * bucket for unknown name', () => {
    expect(getBucketIndex('z', buckets)).toBe(2);
  });

  test('returns -1 when no * bucket and name not found', () => {
    expect(getBucketIndex('z', [{ title: 'A', matches: ['a'] }, { title: 'B', matches: ['b'] }])).toBe(-1);
  });

  test('* itself resolves to the * bucket', () => {
    expect(getBucketIndex('*', buckets)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// aggregateStrategies — single-name toBucketName
// ---------------------------------------------------------------------------

describe('aggregateStrategies', () => {
  test('single normal card lands in correct bucket, total = 1', () => {
    const card = makeCard('aaaaaaaa', 'normal', [CREATURE_FACE]);
    const result = aggregateStrategies([card], [GREEN_STRATEGY], {
      buckets: SIMPLE_BUCKETS,
      toBucketName: stubToBucketName({ aaaaaaaa: 'low' }),
    });

    const row = result.rows[0];
    expect(row.total).toBe(1);
    expect(row.buckets[0].total).toBe(1); // 'low'
    expect(row.buckets[1].total).toBe(0);
    expect(row.buckets[2].total).toBe(0);
    expect(row.buckets[3].total).toBe(0);
  });

  test('card with unknown bucket name falls into * bucket', () => {
    const card = makeCard('aaaaaaaa', 'normal', [CREATURE_FACE]);
    const config = makeBucketConfig(SIMPLE_BUCKETS, stubToBucketName({ aaaaaaaa: 'nomatch' }));
    const result = aggregateStrategies([card], [GREEN_STRATEGY], config);

    expect(result.rows[0].buckets[3].total).toBe(1); // *
    expect(result.rows[0].buckets[0].total).toBe(0);
  });

  test('card discarded when bucket name unmatched and no * bucket', () => {
    const card = makeCard('aaaaaaaa', 'normal', [CREATURE_FACE]);
    const config = makeBucketConfig([
      { title: 'A', matches: ['a'] },
      { title: 'B', matches: ['b'] },
    ], stubToBucketName({ aaaaaaaa: 'z' }));
    const result = aggregateStrategies([card], [GREEN_STRATEGY], config);

    result.rows[0].buckets.forEach(b => expect(b.total).toBe(0));
  });

  test('zero matching cards → all buckets empty', () => {
    const card = makeCard('aaaaaaaa', 'normal', [{ name: 'Forest', types: ['land'] }]);
    const config = makeBucketConfig(SIMPLE_BUCKETS, stubToBucketName({ aaaaaaaa: 'low' }));
    const result = aggregateStrategies([card], [GREEN_STRATEGY], config);

    result.rows[0].buckets.forEach(b => expect(b.total).toBe(0));
  });

  test('buckets in result mirror the config buckets', () => {
    const config = makeBucketConfig(SIMPLE_BUCKETS, stubToBucketName({}));
    const result = aggregateStrategies([], [GREEN_STRATEGY], config);
    expect(result.buckets).toEqual(SIMPLE_BUCKETS);
  });

  // -------------------------------------------------------------------------
  // CardFaceRef carries the bucketName
  // -------------------------------------------------------------------------

  describe('CardFaceRef.bucketName', () => {
    test('ref carries the bucket name returned by toBucketName', () => {
      const card = makeCard('aaaaaaaa', 'normal', [CREATURE_FACE]);
      const config = makeBucketConfig(SIMPLE_BUCKETS, stubToBucketName({ aaaaaaaa: 'low' }));
      const result = aggregateStrategies([card], [GREEN_STRATEGY], config);
      const bucket = result.rows[0].buckets[0];

      expect(bucket.refs).toHaveLength(1);
      expect(bucket.refs[0]).toMatchObject({ cid: 'aaaaaaaa', faceIndex: 0, bucketName: 'low', contribution: 1, filterWeight: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // modal / transform layout rules
  // -------------------------------------------------------------------------

  describe('modal cards', () => {
    const modalStrategy: SerializableStrategy = {
      name: 'Spells',
      filters: ['type:instant', 'type:sorcery'],
    };
    const modalCard = makeCard('bbbbbbbb', 'modal', [
      { name: 'Face A', types: ['instant'], manaCost: { blue: 1 } },
      { name: 'Face B', types: ['sorcery'], manaCost: { red: 1, generic: 2 } },
    ]);

    test('each face lands in its own bucket independently', () => {
      const config = makeBucketConfig(
        SIMPLE_BUCKETS,
        stubToBucketName({ bbbbbbbb: 'low' }, { bbbbbbbb: 'mid' }),
      );
      const result = aggregateStrategies([modalCard], [modalStrategy], config);
      const row = result.rows[0];
      expect(row.buckets[0].total).toBe(1); // low — face 0
      expect(row.buckets[1].total).toBe(1); // mid — face 1
    });

    test('modal card with both faces in same bucket counts as 1', () => {
      const config = makeBucketConfig(
        SIMPLE_BUCKETS,
        stubToBucketName({ bbbbbbbb: 'low' }, { bbbbbbbb: 'low' }),
      );
      const result = aggregateStrategies([modalCard], [modalStrategy], config);
      expect(result.rows[0].buckets[0].total).toBe(1);
      expect(result.rows[0].buckets[0].refs).toHaveLength(2);
    });

    test('row total is unique matching cards, not faces', () => {
      const config = makeBucketConfig(
        SIMPLE_BUCKETS,
        stubToBucketName({ bbbbbbbb: 'low' }, { bbbbbbbb: 'mid' }),
      );
      expect(aggregateStrategies([modalCard], [modalStrategy], config).rows[0].total).toBe(1);
    });
  });

  describe('transform cards — only face 0 is castable', () => {
    const transformCard = makeCard('cccccccc', 'transform', [
      { name: 'Front', types: ['creature'], manaCost: { white: 1 }, pt: { power: 2, toughness: 2 } },
      { name: 'Back', types: ['creature'], givenColors: ['white'], pt: { power: 3, toughness: 3 } },
    ]);
    const whiteStrategy: SerializableStrategy = {
      name: 'White creatures',
      filters: ['type:creature color:white'],
    };

    test('only face 0 contributes to buckets', () => {
      const config = makeBucketConfig(
        SIMPLE_BUCKETS,
        stubToBucketName({ cccccccc: 'low' }, { cccccccc: 'high' }),
      );
      const result = aggregateStrategies([transformCard], [whiteStrategy], config);
      expect(result.rows[0].buckets[0].total).toBe(1); // low — face 0
      expect(result.rows[0].buckets[2].total).toBe(0); // high — face 1 not counted
    });
  });

  // -------------------------------------------------------------------------
  // Hybrid mana — color weight distribution
  // -------------------------------------------------------------------------

  describe('hybrid mana color weights', () => {
    const hybridStrategy: SerializableStrategy = {
      name: 'Red or green',
      filters: ['color:red', 'color:green'],
    };

    test('{r/g} distributes weight: red 0.5, green 0.5', () => {
      const card = makeCard('dddddddd', 'normal', [HYBRID_FACE]);
      const config = makeBucketConfig(
        [['slot'], ['*']],
        stubToBucketName({ dddddddd: 'slot' }),
      );
      const result = aggregateStrategies([card], [hybridStrategy], config);
      const colorMap = Object.fromEntries(
        result.rows[0].buckets[0].colors.map(c => [c.color, c.count]),
      );
      expect(colorMap['red']).toBeCloseTo(0.5);
      expect(colorMap['green']).toBeCloseTo(0.5);
    });

    test('hybrid card total is still 1', () => {
      const card = makeCard('dddddddd', 'normal', [HYBRID_FACE]);
      const config = makeBucketConfig(
        [['slot'], ['*']],
        stubToBucketName({ dddddddd: 'slot' }),
      );
      expect(aggregateStrategies([card], [hybridStrategy], config).rows[0].buckets[0].total).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multi-name toBucketName — weight division across buckets
  // -------------------------------------------------------------------------

  describe('multi-name toBucketName', () => {
    const anyStrategy: SerializableStrategy = {
      name: 'Any instant',
      filters: ['type:instant'],
    };

    test('two names → weight halved in each bucket, total = 1 in each', () => {
      const card = makeCard('eeeeeeee', 'normal', [INSTANT_FACE]);
      const config = makeBucketConfig(
        [['a'], ['b'], ['*']],
        stubToBucketName({ eeeeeeee: ['a', 'b'] }),
      );
      const result = aggregateStrategies([card], [anyStrategy], config);
      const row = result.rows[0];

      expect(row.buckets[0].total).toBe(1);
      expect(row.buckets[1].total).toBe(1);
      expect(row.buckets[0].colors[0].count).toBeCloseTo(0.5);
      expect(row.buckets[1].colors[0].count).toBeCloseTo(0.5);
    });

    test('three names → weight divided by 3', () => {
      const card = makeCard('eeeeeeee', 'normal', [INSTANT_FACE]);
      const config = makeBucketConfig(
        [['a'], ['b'], ['c'], ['*']],
        stubToBucketName({ eeeeeeee: ['a', 'b', 'c'] }),
      );
      const result = aggregateStrategies([card], [anyStrategy], config);

      [0, 1, 2].forEach(i => {
        expect(result.rows[0].buckets[i].total).toBe(1);
        expect(result.rows[0].buckets[i].colors[0].count).toBeCloseTo(1 / 3);
      });
    });

    test('two names both mapping to same bucket: two refs, total still 1, weights sum to full', () => {
      const card = makeCard('eeeeeeee', 'normal', [INSTANT_FACE]);
      // 'a' and 'z' (unknown) both resolve to *
      const config = makeBucketConfig(
        [['*']],
        stubToBucketName({ eeeeeeee: ['a', 'z'] }),
      );
      const result = aggregateStrategies([card], [anyStrategy], config);
      const bucket = result.rows[0].buckets[0];

      expect(bucket.total).toBe(1);
      expect(bucket.refs).toHaveLength(2);
      // each ref has half weight but together they sum to 1
      expect(bucket.refs[0].contribution).toBeCloseTo(0.5);
      expect(bucket.refs[1].contribution).toBeCloseTo(0.5);
      expect(bucket.colors[0].count).toBeCloseTo(1);
    });

    test('each ref carries the bucket name it was placed by', () => {
      const card = makeCard('eeeeeeee', 'normal', [INSTANT_FACE]);
      const config = makeBucketConfig(
        [['a'], ['b'], ['*']],
        stubToBucketName({ eeeeeeee: ['a', 'b'] }),
      );
      const result = aggregateStrategies([card], [anyStrategy], config);

      expect(result.rows[0].buckets[0].refs[0].bucketName).toBe('a');
      expect(result.rows[0].buckets[1].refs[0].bucketName).toBe('b');
    });

    test('single-name return (string, not array) still works', () => {
      const card = makeCard('eeeeeeee', 'normal', [INSTANT_FACE]);
      const config = makeBucketConfig(
        [['a'], ['*']],
        stubToBucketName({ eeeeeeee: 'a' }),
      );
      const result = aggregateStrategies([card], [anyStrategy], config);
      expect(result.rows[0].buckets[0].total).toBe(1);
      expect(result.rows[0].buckets[0].colors[0].count).toBeCloseTo(1);
    });
  });
});

// ---------------------------------------------------------------------------
// aggregateStrategies — weighted filters
// ---------------------------------------------------------------------------

describe('weighted filters', () => {
  const card = makeCard('ffffffff', 'normal', [{ name: 'Token Maker', types: ['sorcery'], manaCost: { green: 1 } }]);
  const config: BucketConfig = {
    buckets: [{ title: 'Slot', matches: ['slot'] }, { title: 'Catch-All', matches: ['*'] }],
    toBucketName: stubToBucketName({ ffffffff: 'slot' }),
  };

  test('string filter has implicit weight 1', () => {
    const strategy: SerializableStrategy = { name: 'S', filters: ['type:sorcery'] };
    const result = aggregateStrategies([card], [strategy], config);
    const ref = result.rows[0].buckets[0].refs[0];
    expect(ref.filterWeight).toBe(1);
    expect(ref.contribution).toBeCloseTo(1);
  });

  test('weighted object filter multiplies contribution', () => {
    const strategy: SerializableStrategy = {
      name: 'S',
      filters: [{ query: 'type:sorcery', weight: 2 }],
    };
    const result = aggregateStrategies([card], [strategy], config);
    const ref = result.rows[0].buckets[0].refs[0];
    expect(ref.filterWeight).toBe(2);
    expect(ref.contribution).toBeCloseTo(2);
  });

  test('card matching two filters uses highest weight (max, not sum)', () => {
    const strategy: SerializableStrategy = {
      name: 'S',
      filters: [
        'type:sorcery', // weight 1
        { query: 'color:green', weight: 3 }, // weight 3
      ],
    };
    const result = aggregateStrategies([card], [strategy], config);
    const ref = result.rows[0].buckets[0].refs[0];
    expect(ref.filterWeight).toBe(3);
    expect(ref.contribution).toBeCloseTo(3);
  });

  test('card matching only lower-weight filter uses that weight', () => {
    // The card is a sorcery (green) but not an instant
    const strategy: SerializableStrategy = {
      name: 'S',
      filters: [
        'type:sorcery', // weight 1, matches
        { query: 'type:instant', weight: 5 }, // weight 5, does NOT match
      ],
    };
    const result = aggregateStrategies([card], [strategy], config);
    const ref = result.rows[0].buckets[0].refs[0];
    expect(ref.filterWeight).toBe(1);
    expect(ref.contribution).toBeCloseTo(1);
  });

  test('card not matching any filter has no refs', () => {
    const strategy: SerializableStrategy = {
      name: 'S',
      filters: [{ query: 'type:instant', weight: 2 }],
    };
    const result = aggregateStrategies([card], [strategy], config);
    expect(result.rows[0].buckets[0].refs).toHaveLength(0);
    expect(result.rows[0].total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// aggregateStrategies — adventure card face isolation
// ---------------------------------------------------------------------------

describe('adventure card face isolation', () => {
  // Only face 0 (the creature) has rules that match; face 1 (the adventure spell)
  // should NOT appear in the refs even though both faces are castable.
  const adventureCard = makeCard('gggggggg', 'adventure', [
    {
      name: 'Drift Chaplain',
      types: ['creature'],
      subtypes: ['human', 'cleric'],
      manaCost: { generic: 3, white: 1 },
      pt: { power: 3, toughness: 2 },
      rules: [
        { variant: 'keyword', content: 'vigilance' },
        { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
      ],
    },
    {
      name: 'Shield of Faith',
      types: ['instant'],
      subtypes: ['adventure'],
      manaCost: { white: 1 },
      rules: [
        { variant: 'ability', content: 'Target creature you control gets +2/+0 until end of turn. Untap it.' },
      ],
    },
  ]);

  const asteroidStrategy: SerializableStrategy = {
    name: 'Asteroid Generation',
    filters: ['rules:"create" rules:"Asteroid token"'],
  };

  const config: BucketConfig = {
    buckets: [{ title: 'Slot', matches: ['slot'] }, { title: '*', matches: ['*'] }],
    toBucketName: stubToBucketName({ gggggggg: 'slot' }, { gggggggg: 'slot' }),
  };

  test('only the matching face (face 0) produces a ref', () => {
    const result = aggregateStrategies([adventureCard], [asteroidStrategy], config);
    const refs = result.rows[0].buckets[0].refs;
    expect(refs).toHaveLength(1);
    expect(refs[0].faceIndex).toBe(0);
  });

  test('non-matching face (face 1) does not appear in refs', () => {
    const result = aggregateStrategies([adventureCard], [asteroidStrategy], config);
    const refs = result.rows[0].buckets[0].refs;
    expect(refs.every(r => r.faceIndex !== 1)).toBe(true);
  });

  test('card total is still 1 despite only one face contributing', () => {
    const result = aggregateStrategies([adventureCard], [asteroidStrategy], config);
    expect(result.rows[0].total).toBe(1);
    expect(result.rows[0].buckets[0].total).toBe(1);
  });

  test('query matching both faces produces refs for both faces', () => {
    // type:instant matches face 1; type:creature matches face 0 — OR logic means both match
    // but here we use a filter that matches each face individually via separate strategies
    const bothFacesStrategy: SerializableStrategy = {
      name: 'White cards',
      filters: ['color:white'],
    };
    const result = aggregateStrategies([adventureCard], [bothFacesStrategy], config);
    const refs = result.rows[0].buckets[0].refs;
    // Both faces are white, so both should contribute
    expect(refs).toHaveLength(2);
    expect(refs.map(r => r.faceIndex).sort()).toEqual([0, 1]);
  });
});
