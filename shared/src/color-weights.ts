import { CardColor, cardColors, hybridManaColors, isHybridMana } from './colors';
import { SerializedCard } from './serialized-card';
import { SerializedCardFace } from './serialized-card-face';
import { Mana } from './colors';

export type FaceColorWeights = {
  faceIndex: number;
  weights: Map<string, number>;
};

/**
 * Derives a map of color -> fractional weight for a single card face.
 * Each color's weight represents its share of the total colored pip count,
 * so all weights sum to 1 (or the single key 'colorless' maps to 1).
 *
 * Rules:
 * - If the face has no manaCost, use givenColors (empty = colorless), split equally.
 * - Otherwise, each non-hybrid color pip contributes 1 to that color's count.
 *   Each hybrid pip (e.g. {r/g}) contributes 0.5 to each of its two colors.
 *   The final weights are normalized by total pip count.
 * - Generic, colorless, and X pips are ignored for color purposes.
 *
 * Examples:
 *   {2}           -> { colorless: 1 }
 *   {2}{g}        -> { green: 1 }
 *   {1}{r}{b}     -> { red: 0.5, black: 0.5 }
 *   {2}{r}{u}{u}  -> { red: 0.333, blue: 0.667 }
 *   {r/g}         -> { red: 0.5, green: 0.5 }
 *   {1}{r/g}{r/g} -> { red: 0.5, green: 0.5 }
 *   {r}{r/g}      -> { red: 0.75, green: 0.25 }
 */
export function getFaceColorWeights(face: SerializedCardFace): Map<string, number> {
  // Cards without a mana cost use givenColors (lands, tokens, etc.)
  if (face.manaCost === undefined) {
    const given = face.givenColors ?? [];
    if (given.length === 0) return new Map([['colorless', 1]]);
    const w = 1 / given.length;
    const result = new Map<string, number>();
    for (const color of given) {
      result.set(color, (result.get(color) ?? 0) + w);
    }
    return result;
  }

  const manaCost = face.manaCost;
  const colorCounts = new Map<CardColor, number>();
  let total = 0;

  for (const [mana, amount] of Object.entries(manaCost) as [Mana, number | undefined][]) {
    const count = amount ?? 0;
    if (count === 0) continue;
    if (isHybridMana(mana)) {
      const colors = hybridManaColors(mana);
      for (let i = 0; i < count; i++) {
        // Each hybrid pip contributes 0.5 to each of its two colors
        for (const color of colors) {
          colorCounts.set(color, (colorCounts.get(color) ?? 0) + 0.5);
        }
        total += 1;
      }
    } else if ((cardColors as readonly string[]).includes(mana)) {
      colorCounts.set(mana as CardColor, (colorCounts.get(mana as CardColor) ?? 0) + count);
      total += count;
    }
    // generic, colorless, x pips are ignored for color-combination purposes
  }

  if (total === 0) return new Map([['colorless', 1]]);

  const result = new Map<string, number>();
  for (const [color, count] of colorCounts) {
    result.set(color, count / total);
  }
  return result;
}

/**
 * Returns per-face color weights for a card, based on its layout.
 *
 * - normal:    only face 0 is castable → one entry
 * - transform: only face 0 is castable (back side is not cast) → one entry
 * - modal:     both faces are castable → two entries
 * - adventure: both faces are castable → two entries
 */
export function getColorWeights(card: SerializedCard): FaceColorWeights[] {
  const { layout, faces } = card;

  if (layout === 'modal' || layout === 'adventure') {
    return faces.map((face, faceIndex) => ({
      faceIndex,
      weights: getFaceColorWeights(face),
    }));
  }

  // normal and transform: only face 0
  return [{ faceIndex: 0, weights: getFaceColorWeights(faces[0]) }];
}
