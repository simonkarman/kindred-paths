import { SerializedCard } from './serialized-card';
import { extractMechanics, MechanicEntry } from './card-mechanic-extractor';
import { CardRarity } from './card';

export type Stage = 'early' | 'mid' | 'late';

export interface MechanicsAggregatorOptions {
  /** Whether to include keywords (e.g. "flying", "trample") as mechanic entries. Default: false. */
  includeKeywords?: boolean;
  /** Token cards available in the set for extraction. */
  tokens?: SerializedCard[];
}

/**
 * Represents the count of mechanics at a specific rarity level.
 */
export interface RarityCount {
  rarity: CardRarity;
  count: number;
}

/**
 * Represents a mechanic with its rarity distribution.
 */
export interface MechanicWithRarity {
  /** The normalized mechanic text. */
  mechanic: string;
  /** The original mechanic text (for display). */
  original: string;
  /** Count of this mechanic at each rarity level. */
  rarities: RarityCount[];
  /** Total count across all rarities. */
  total: number;
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
  const { includeKeywords = false, tokens = [] } = options;
  
  // Extract mechanics from all non-token cards
  const allEntries: MechanicEntry[] = cards
    .filter(card => !card.isToken)
    .flatMap(card => extractMechanics(card, { includeKeywords, tokens }));
  
  // Group mechanics: color → stage → mechanic → rarity → count
  const grid = new Map<string, Map<Stage, Map<string, Map<CardRarity, number>>>>();
  const uniqueMechanicsSet = new Set<string>();
  
  for (const entry of allEntries) {
    const { colors, stage, fragment, rarity } = entry;
    
    // Track unique mechanics
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
      mechanicMap.set(fragment.normalized, new Map());
    }
    const rarityMap = mechanicMap.get(fragment.normalized)!;
    
    // Increment count for this rarity
    const currentCount = rarityMap.get(rarity) ?? 0;
    rarityMap.set(rarity, currentCount + 1);
  }
  
  // Convert to final structure with MechanicsCell
  const finalGrid = new Map<string, Map<Stage, MechanicsCell>>();
  
  for (const [color, stageMap] of grid.entries()) {
    const finalStageMap = new Map<Stage, MechanicsCell>();
    
    for (const [stage, mechanicMap] of stageMap.entries()) {
      const mechanics: MechanicWithRarity[] = [];
      let cellTotal = 0;
      
      // Also need to track original text - use first occurrence
      const mechanicOriginals = new Map<string, string>();
      for (const entry of allEntries) {
        if (entry.colors === color && entry.stage === stage) {
          if (!mechanicOriginals.has(entry.fragment.normalized)) {
            mechanicOriginals.set(entry.fragment.normalized, entry.fragment.original);
          }
        }
      }
      
      for (const [mechanicNormalized, rarityMap] of mechanicMap.entries()) {
        const rarities: RarityCount[] = [];
        let mechanicTotal = 0;
        
        for (const [rarity, count] of rarityMap.entries()) {
          rarities.push({ rarity, count });
          mechanicTotal += count;
        }
        
        // Sort rarities by the standard order: common, uncommon, rare, mythic
        const rarityOrder: CardRarity[] = ['common', 'uncommon', 'rare', 'mythic'];
        rarities.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));
        
        mechanics.push({
          mechanic: mechanicNormalized,
          original: mechanicOriginals.get(mechanicNormalized) ?? mechanicNormalized,
          rarities,
          total: mechanicTotal,
        });
        
        cellTotal += mechanicTotal;
      }
      
      // Sort mechanics by total count (descending), then alphabetically
      mechanics.sort((a, b) => {
        if (a.total !== b.total) {
          return b.total - a.total;
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
