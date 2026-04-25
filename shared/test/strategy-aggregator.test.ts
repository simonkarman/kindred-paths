import { describe, expect, test } from 'vitest';
import {
  aggregateStrategies,
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

function makeBucketConfig(buckets: string[][], toBucketName: ToBucketNameFn): BucketConfig {
  return { buckets, toBucketName };
}

const SIMPLE_BUCKETS = [['low'], ['mid'], ['high'], ['*']];

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
  const buckets = [['a', 'b'], ['c'], ['*']];

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
    expect(getBucketIndex('z', [['a'], ['b']])).toBe(-1);
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
    const config = makeBucketConfig([['a'], ['b']], stubToBucketName({ aaaaaaaa: 'z' }));
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
      expect(bucket.refs[0]).toMatchObject({ cid: 'aaaaaaaa', faceIndex: 0, bucketName: 'low', contribution: 1 });
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
