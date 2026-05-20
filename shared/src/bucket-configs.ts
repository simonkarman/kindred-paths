import { SerializedCard } from './serialized-card';
import { BucketConfig } from './strategy-aggregator';

/** Single catch-all bucket — everything lands in one column. Useful for a flat color overview. */
export const AllCardsBucketConfig: BucketConfig = {
  buckets: [
    { title: 'All Cards', matches: ['*'] },
  ],
  toBucketName: (_card: SerializedCard, _faceIndex: number) => 'all',
};

/** Four mana-value buckets: 0–2, 3, 4–5, 6+. The classic limited curve view. */
export const MvBucketConfig: BucketConfig = {
  buckets: [
    { title: 'MV <2', matches: ['mv:0', 'mv:1', 'mv:2'] },
    { title: 'MV 3', matches: ['mv:3'] },
    { title: 'MV 4-5', matches: ['mv:4', 'mv:5'] },
    { title: 'MV >6', matches: ['*'] },
  ],
  toBucketName: (card: SerializedCard, faceIndex: number) => {
    const face = card.faces[faceIndex];
    const mv = Object.entries(face?.manaCost ?? {}).reduce(
      (sum, [type, amount]) => sum + (type === 'x' ? 0 : (amount ?? 0)),
      0,
    );
    return `mv:${mv}`;
  },
};

/** Buckets by broad card type: Creature, Spell (instant/sorcery), Permanent (artifact/enchantment/planeswalker), Land. */
export const CardTypeBucketConfig: BucketConfig = {
  buckets: [
    { title: 'Creature', matches: ['creature'] },
    { title: 'Spell', matches: ['instant', 'sorcery'] },
    { title: 'Other', matches: ['*'] },
    { title: 'Land', matches: ['land'] },
  ],
  toBucketName: (card: SerializedCard, faceIndex: number) => {
    const types = card.faces[faceIndex]?.types ?? [];
    return types[types.length - 1];
  },
};

/** Buckets by rarity: Common, Uncommon, Rare, Mythic. */
export const RarityBucketConfig: BucketConfig = {
  buckets: [
    { title: 'Common', matches: ['common'] },
    { title: 'Uncommon', matches: ['uncommon'] },
    { title: 'Rare', matches: ['rare'] },
    { title: 'Mythic', matches: ['*'] },
  ],
  toBucketName: (card: SerializedCard, _faceIndex: number) => card.rarity,
};

/**
 * Registry of all available bucket configs, keyed by display name.
 * Add new configs here to make them available everywhere (UI dropdown, MCP parameter).
 */
export const BucketConfigs: Record<string, BucketConfig> = {
  'All Cards': AllCardsBucketConfig,
  'Mana Value': MvBucketConfig,
  'Card Type': CardTypeBucketConfig,
  'Rarity': RarityBucketConfig,
};

export const DefaultBucketConfigName = 'Mana Value';
