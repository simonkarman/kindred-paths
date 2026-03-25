import { SerializedCard } from './serialized-card';
import { extractMechanics, MechanicEntry } from './card-mechanic-extractor';
import { CardRarity } from './card';

export type Stage = 'early' | 'mid' | 'late';

export interface RarityWeights {
  common: number;
  uncommon: number;
  rare: number;
  mythic: number;
}

export interface MechanicsAggregatorOptions {
  /** Whether to include keywords (e.g. "flying", "trample") as mechanic entries. Default: false. */
  includeKeywords?: boolean;
  /** Token cards available in the set for extraction. */
  tokens?: SerializedCard[];
  /** Whether to exclude mechanics that are purely activation costs ({T}, {2}{G}, etc.). Default: false. */
  excludeCostOnlyMechanics?: boolean;
  /** Custom rarity weights for scoring. Default: {common: 6, uncommon: 3, rare: 2, mythic: 1} */
  rarityWeights?: RarityWeights;
}

/**
 * Represents the count of mechanics at a specific rarity level.
 */
export interface RarityCount {
  rarity: CardRarity;
  count: number;
}

/**
 * Represents a source card that contributes a mechanic.
 */
export interface CardSource {
  cid: string;
  cardName: string;
  faceIndex: number;
}

/**
 * Represents a mechanic with its rarity distribution.
 */
export interface MechanicWithRarity {
  /** The normalized mechanic text. */
  mechanic: string;
  /** The original mechanic text (for display, first occurrence). */
  original: string;
  /** Count of this mechanic at each rarity level. */
  rarities: RarityCount[];
  /** Total count across all rarities. */
  total: number;
  /** Weighted score for sorting: Common×6 + Uncommon×3 + Rare×2 + Mythic×1. */
  weightedScore: number;
  /** Source cards that contribute this mechanic. */
  sources: CardSource[];
}

/**
 * Represents a cell in the mechanics grid (color × stage).
 */
export interface MechanicsCell {
  /** List of mechanics with their rarity distributions. */
  mechanics: MechanicWithRarity[];
  /** Total count of all mechanics in this cell. */
  total: number;
}

/**
 * The complete aggregated mechanics data structure.
 */
export interface MechanicsAggregation {
  /** Grid data: colorCombination → stage → mechanics cell. */
  grid: Map<string, Map<Stage, MechanicsCell>>;
  /** All unique color combinations found (sorted in WUBRG order). */
  colorCombinations: string[];
  /** Total number of mechanic instances across all cards. */
  totalMechanics: number;
  /** Number of unique mechanics (by normalized text). */
  uniqueMechanics: number;
}

/**
 * Default rarity weights for weighted score calculation.
 * Higher weight = more likely to be encountered in a set.
 */
const defaultRarityWeights: RarityWeights = {
  common: 6,
  uncommon: 3,
  rare: 2,
  mythic: 1,
};

/**
 * Calculate the weighted score for a mechanic based on its rarity distribution.
 */
function calculateWeightedScore(rarities: RarityCount[], weights: RarityWeights): number {
  return rarities.reduce((score, { rarity, count }) => {
    return score + (weights[rarity] * count);
  }, 0);
}

/**
 * Determines if a mechanic is purely an activation cost (only mana/tap symbols).
 * These are not interesting for mechanical analysis and can be filtered out.
 *
 * Matches text that consists entirely of one or more {symbol} groups where symbol
 * is any combination of: W, U, B, R, G, C, T, Q, X, N (normalized numbers), or digits (case-insensitive).
 *
 * Examples filtered: {T}, {2}, {N}, {2}{G}{G}, {X}{X}{R}, {N}{N}
 * Examples kept: Add {G}{G}, Draw a card, Scry N
 */
export function isCostOnlyMechanic(mechanicText: string): boolean {
  const costOnlyPattern = /^\s*(\{[wubrgctqxn0-9]+\}\s*,?\s*)+$/i;
  return costOnlyPattern.test(mechanicText);
}

/**
 * Sort color combinations in WUBRG order.
 * Mono colors first, then 2-color, then 3+, all sorted by WUBRG priority.
 */
function sortColorCombinations(colors: string[]): string[] {
  const colorOrder = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'generic'];

  return colors.sort((a, b) => {
    const aParts = a.split('+');
    const bParts = b.split('+');

    // Sort by number of colors first
    if (aParts.length !== bParts.length) {
      return aParts.length - bParts.length;
    }

    // Then by WUBRG order
    for (let i = 0; i < aParts.length; i++) {
      const aIndex = colorOrder.indexOf(aParts[i]);
      const bIndex = colorOrder.indexOf(bParts[i]);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
    }

    return 0;
  });
}

/**
 * Aggregate mechanics from all cards into a structured grid format.
 */
export function aggregateMechanics(
  cards: SerializedCard[],
  options: MechanicsAggregatorOptions = {},
): MechanicsAggregation {
  const { 
    includeKeywords = false, 
    tokens = [], 
    excludeCostOnlyMechanics = false,
    rarityWeights = defaultRarityWeights,
  } = options;

  // Extract mechanics from all non-token cards
  let allEntries: MechanicEntry[] = cards
    .filter(card => !card.isToken)
    .flatMap(card => extractMechanics(card, { includeKeywords, tokens }));

  // Filter out cost-only mechanics if requested
  if (excludeCostOnlyMechanics) {
    allEntries = allEntries.filter(entry => !isCostOnlyMechanic(entry.fragment.normalized));
  }

  // Build intermediate structure: color → stage → mechanic → { rarityMap, sources }
  type IntermediateMechanic = {
    rarityMap: Map<CardRarity, number>;
    sources: CardSource[];
    firstOriginal: string;
  };
  const grid = new Map<string, Map<Stage, Map<string, IntermediateMechanic>>>();
  const uniqueMechanicsSet = new Set<string>();

  for (const entry of allEntries) {
    const { colors, stage, fragment, rarity, source } = entry;

    uniqueMechanicsSet.add(fragment.normalized);

    // Ensure nested maps exist
    if (!grid.has(colors)) {
      grid.set(colors, new Map());
    }
    const stageMap = grid.get(colors)!;

    if (!stageMap.has(stage)) {
      stageMap.set(stage, new Map());
    }
    const mechanicMap = stageMap.get(stage)!;

    if (!mechanicMap.has(fragment.normalized)) {
      mechanicMap.set(fragment.normalized, {
        rarityMap: new Map(),
        sources: [],
        firstOriginal: fragment.original,
      });
    }
    const mechData = mechanicMap.get(fragment.normalized)!;

    // Increment rarity count
    const currentCount = mechData.rarityMap.get(rarity) ?? 0;
    mechData.rarityMap.set(rarity, currentCount + 1);

    // Track source card (avoid duplicates from the same card)
    if (!mechData.sources.some(s => s.cid === source.cid && s.faceIndex === source.faceIndex)) {
      mechData.sources.push({
        cid: source.cid,
        cardName: source.cardName,
        faceIndex: source.faceIndex,
      });
    }
  }

  // Convert to final structure with MechanicsCell
  const finalGrid = new Map<string, Map<Stage, MechanicsCell>>();

  for (const [color, stageMap] of grid.entries()) {
    const finalStageMap = new Map<Stage, MechanicsCell>();

    for (const [stage, mechanicMap] of stageMap.entries()) {
      const mechanics: MechanicWithRarity[] = [];
      let cellTotal = 0;

      for (const [mechanicNormalized, mechData] of mechanicMap.entries()) {
        const rarities: RarityCount[] = [];
        let mechanicTotal = 0;

        for (const [rarity, count] of mechData.rarityMap.entries()) {
          rarities.push({ rarity, count });
          mechanicTotal += count;
        }

        // Sort rarities by the standard order: common, uncommon, rare, mythic
        const rarityOrder: CardRarity[] = ['common', 'uncommon', 'rare', 'mythic'];
        rarities.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

        const weightedScore = calculateWeightedScore(rarities, rarityWeights);

        mechanics.push({
          mechanic: mechanicNormalized,
          original: mechData.firstOriginal,
          rarities,
          total: mechanicTotal,
          weightedScore,
          sources: mechData.sources,
        });

        cellTotal += mechanicTotal;
      }

      // Sort mechanics by weighted score (descending), then alphabetically
      mechanics.sort((a, b) => {
        if (a.weightedScore !== b.weightedScore) {
          return b.weightedScore - a.weightedScore;
        }
        return a.mechanic.localeCompare(b.mechanic);
      });

      finalStageMap.set(stage, {
        mechanics,
        total: cellTotal,
      });
    }

    finalGrid.set(color, finalStageMap);
  }

  // Get sorted color combinations
  const colorCombinations = sortColorCombinations([...finalGrid.keys()]);

  return {
    grid: finalGrid,
    colorCombinations,
    totalMechanics: allEntries.length,
    uniqueMechanics: uniqueMechanicsSet.size,
  };
}
