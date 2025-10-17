import { Card, loyaltyCostAsString } from 'kindred-paths';

export type PlaneswalkerAbility = { cost: string, content: string, height: number, startHeight: number };
export type PlaneswalkerData = { size: 'regular' | 'tall', rulesFontSize: number, abilities: PlaneswalkerAbility[] };

export const computePlaneswalkerData = (card: Card): PlaneswalkerData | undefined => {
  if (!card.types.includes('planeswalker')) {
    return undefined;
  }

  const abilities = [
    ...(card.renderRules().length > 0 ? [{ cost: '', content: card.renderRules() }] : []),
    ...card.loyaltyAbilities().map(({ cost, content }) => ({ cost: loyaltyCostAsString(cost), content })),
  ];
  const rulesFontSize = -18 + (card.getTagAsNumber('fs/rules') ?? 0);
  const heights = abilities.map(({ content }) => {
    const padding = 115 + rulesFontSize;
    const containsNewLine = content.includes('{lns}');
    const numberOfLines = Math.ceil(content.length / Math.max(10, 33 - (rulesFontSize / 3)) + (containsNewLine ? 0.5 : 0));
    const lineHeight = 75 + (rulesFontSize / 2);
    return padding + (numberOfLines * lineHeight);
  });
  const totalHeight = heights.reduce((a, b) => a + b, 0);
  const size = totalHeight > 820 ? 'tall' : 'regular';

  // Expand abilities to 820 (or 1010 if tall) with a margin of 30
  const targetHeight = (size === 'tall' ? 1010 : 820) - 30;
  if (targetHeight > totalHeight) {
    const additionalHeightPerAbility = Math.max(0, Math.floor((targetHeight - totalHeight) / abilities.length));
    for (let i = 0; i < heights.length; i++) {
      heights[i] += additionalHeightPerAbility;
    }
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
};
