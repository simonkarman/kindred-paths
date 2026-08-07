// Planeswalker layout data used by the CardConjurer driver.
//
// Ported verbatim from v1 `server/src/utils/compute-planeswalker-data.ts`. This is
// renderer-specific (the height calculations, target-fill logic, and start-height
// bookkeeping only make sense for how CardConjurer's planeswalker frames position their
// ability boxes) so it lives here, not in shared.

import { loyaltyCostAsString } from '@kindred-paths/shared';
import type { Renderable } from './renderable.js';

export type PlaneswalkerAbility = {
  cost: string;
  content: string;
  height: number;
  startHeight: number;
};

export type PlaneswalkerData = {
  size: 'regular' | 'tall';
  rulesFontSize: number;
  abilities: PlaneswalkerAbility[];
};

/**
 * Compute planeswalker driver inputs, or return undefined if the card isn't a planeswalker.
 * Output shape mirrors v1 exactly so the driver's shiftPerNumberOfAbilities table lookup
 * (see v1 card-conjurer.ts:546-551) works unchanged.
 */
export function computePlaneswalkerData(renderable: Renderable): PlaneswalkerData | undefined {
  if (!renderable.types.includes('planeswalker')) return undefined;

  const abilities: Array<{ cost: string; content: string }> = [
    ...(renderable.hasRules ? [{ cost: '', content: renderable.rules }] : []),
    ...(renderable.loyaltyAbilities ?? []).map(({ cost, content }) => ({
      cost: loyaltyCostAsString(cost),
      content,
    })),
  ];

  const fsRules = renderable.tags?.['fs/rules'];
  const rulesFontSize = -18 + (typeof fsRules === 'number' ? fsRules : 0);

  // Rough line-count heuristic — matches v1 exactly (line 17-23). Not a real text-metrics
  // measurement; produces "regular" vs "tall" bucketing that has proven adequate across the
  // v1 corpus.
  const heights = abilities.map(({ content }) => {
    const padding = 115 + rulesFontSize;
    const containsNewLine = content.includes('{lns}');
    const numberOfLines = Math.ceil(
      content.length / Math.max(10, 33 - rulesFontSize / 3) + (containsNewLine ? 0.5 : 0),
    );
    const lineHeight = 75 + rulesFontSize / 2;
    return padding + numberOfLines * lineHeight;
  });
  const totalHeight = heights.reduce((a, b) => a + b, 0);
  const size: PlaneswalkerData['size'] = totalHeight > 820 ? 'tall' : 'regular';

  // Expand abilities to fill the target height with a margin of 30.
  const targetHeight = (size === 'tall' ? 1010 : 820) - 30;
  if (targetHeight > totalHeight && abilities.length > 0) {
    const additional = Math.max(0, Math.floor((targetHeight - totalHeight) / abilities.length));
    for (let i = 0; i < heights.length; i++) heights[i] += additional;
  }

  return {
    size,
    rulesFontSize,
    abilities: abilities.map((ability, index) => ({
      ...ability,
      height: heights[index],
      startHeight: heights.slice(0, index).reduce((a, b) => a + b, 0),
    })),
  };
}
