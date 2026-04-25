import { filterCardsBasedOnSearch } from './card-filterer';
import { SerializedCard } from './serialized-card';
import { SerializableStrategy, getFilterQuery, getFilterWeight } from './serializable-strategies';
import { getColorWeights } from './color-weights';

export type CardFaceRef = {
  /** The card ID. */
  cid: string;
  /** Index of the face that contributed (0 for primary, 1 for secondary). */
  faceIndex: number;
  /** The bucket name returned by toBucketName that placed this ref in its bucket. */
  bucketName: string;
  /** Fractional weight this face contributed to the color entry.
   *  When toBucketName returns N names, the original weight is divided by N,
   *  then multiplied by the highest matched filter weight. */
  contribution: number;
  /** The highest filter weight among all filters this card matched. */
  filterWeight: number;
};

export type StrategyColorEntry = {
  /** A color key: single color name, 'colorless', or multi-color like 'red+black'. */
  color: string;
  /** Total fractional weight contributed to this color entry. */
  count: number;
  /** Per-face references that contributed to this color entry. */
  refs: CardFaceRef[];
};

export type StrategyBucketCell = {
  /** The bucket names that belong to this bucket column (e.g. ['mv:2', 'mv:3'] or ['*']). */
  bucketNames: string[];
  /** Per-color-combination weights for this bucket, only containing entries with count > 0. */
  colors: StrategyColorEntry[];
  /** Count of unique cards in this bucket (a modal card with two faces counts as 1). */
  total: number;
  /** All card-face references in this bucket, across all color entries. */
  refs: CardFaceRef[];
};

export type StrategyRow = {
  strategy: SerializableStrategy;
  /** One cell per mana value bucket. */
  buckets: StrategyBucketCell[];
  /** Total unique matching cards for this strategy across all buckets. */
  total: number;
};

export type StrategyAggregation = {
  rows: StrategyRow[];
  /** The bucket columns used (mirrors the bucket config). */
  buckets: string[][];
};

/**
 * A function that returns a bucket name (or multiple bucket names) for a given card face.
 * When multiple names are returned the face's color weight is divided evenly across each name,
 * but the card still counts as 1 unique card in every bucket it lands in.
 */
export type ToBucketNameFn = (card: SerializedCard, faceIndex: number) => string | string[];

export type BucketConfig = {
  /** The bucket columns. Each column is an array of bucket name strings.
   *  A column containing '*' is the catch-all for any name not found elsewhere. */
  buckets: string[][];
  /** Function that maps a card face to one or more bucket names. */
  toBucketName: ToBucketNameFn;
};

/**
 * Returns the bucket index for a given bucket name, or -1 if it doesn't fit in any bucket.
 * First looks for an exact match; if none is found, falls back to the first bucket containing '*'.
 */
export function getBucketIndex(bucketName: string, buckets: string[][]): number {
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].includes(bucketName)) {
      return i;
    }
  }
  // Fall back to the catch-all bucket
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].includes('*')) {
      return i;
    }
  }
  return -1;
}

/**
 * Aggregates the given cards against the given strategies and bucket config.
 * For each strategy, a card matches if it satisfies ANY of the strategy's filters (OR logic).
 * When a card matches multiple filters, the highest filter weight is used as a contribution multiplier.
 * Each castable face of a card independently determines its own bucket(s) via toBucketName.
 * When toBucketName returns N names, the face's color weight is divided by N across those buckets.
 */
export function aggregateStrategies(
  cards: SerializedCard[],
  strategies: SerializableStrategy[],
  bucketConfig: BucketConfig,
): StrategyAggregation {
  const { buckets, toBucketName } = bucketConfig;

  const rows: StrategyRow[] = strategies.map(strategy => {
    // Collect matching cards using OR logic across all filters, tracking max weight per cid
    const cidMaxWeight = new Map<string, number>();
    for (const filter of strategy.filters) {
      const query = getFilterQuery(filter);
      const weight = getFilterWeight(filter);
      const matched = filterCardsBasedOnSearch(cards, query);
      for (const card of matched) {
        const current = cidMaxWeight.get(card.cid) ?? 0;
        if (weight > current) cidMaxWeight.set(card.cid, weight);
      }
    }
    const matchedCards = cards.filter(c => cidMaxWeight.has(c.cid));

    // Temporary accumulator: bucketIndex -> colorKey -> { count, refs }
    const acc: Map<number, Map<string, { count: number; refs: CardFaceRef[] }>> = new Map();
    // Unique cids per bucket (for total count — a card spanning multiple buckets counts as 1)
    const bucketUniqueCids: Map<number, Set<string>> = new Map();
    for (let i = 0; i < buckets.length; i++) {
      acc.set(i, new Map());
      bucketUniqueCids.set(i, new Set());
    }

    for (const card of matchedCards) {
      const faceWeights = getColorWeights(card);
      const filterWeight = cidMaxWeight.get(card.cid) ?? 1;

      for (const { faceIndex, weights } of faceWeights) {
        const rawNames = toBucketName(card, faceIndex);
        const names = Array.isArray(rawNames) ? rawNames : [rawNames];
        const divisor = names.length;

        for (const bucketName of names) {
          const bucketIndex = getBucketIndex(bucketName, buckets);
          if (bucketIndex === -1) continue;

          bucketUniqueCids.get(bucketIndex)!.add(card.cid);

          const bucketAcc = acc.get(bucketIndex)!;
          for (const [colorKey, weight] of weights) {
            const dividedWeight = (weight / divisor) * filterWeight;
            const existing = bucketAcc.get(colorKey) ?? { count: 0, refs: [] };
            existing.count += dividedWeight;
            existing.refs.push({ cid: card.cid, faceIndex, bucketName, contribution: dividedWeight, filterWeight });
            bucketAcc.set(colorKey, existing);
          }
        }
      }
    }

    // Convert accumulator to StrategyBucketCell[]
    const bucketCells: StrategyBucketCell[] = buckets.map((bucketNames, i) => {
      const bucketAcc = acc.get(i)!;
      const colors: StrategyColorEntry[] = [...bucketAcc.entries()]
        .filter(([, e]) => e.count > 0)
        .map(([color, e]) => ({ color, count: e.count, refs: e.refs }));
      const allRefs = colors.flatMap(e => e.refs);
      const uniqueCids = bucketUniqueCids.get(i)!;
      return {
        bucketNames,
        colors,
        total: uniqueCids.size,
        refs: allRefs,
      };
    });

    const strategyTotal = new Set(matchedCards.map(c => c.cid)).size;

    return { strategy, buckets: bucketCells, total: strategyTotal };
  });

  return { rows, buckets };
}
