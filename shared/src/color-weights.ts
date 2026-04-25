import { CardColor, cardColors, hybridManaColors, isHybridMana, toOrderedColors } from './colors';
import { SerializedCard } from './serialized-card';
import { SerializedCardFace } from './serialized-card-face';
import { Mana } from './colors';

export type FaceColorWeights = {
  faceIndex: number;
  weights: Map<string, number>;
};

/**
 * Returns the cartesian product of an array of two-element choice tuples.
 * Each element of the result is a flat array of one chosen item per tuple.
 */
function cartesianProduct<T>(options: [T, T][]): T[][] {
  if (options.length === 0) return [[]];
  let result: T[][] = [[]];
  for (const [a, b] of options) {
    const next: T[][] = [];
    for (const existing of result) {
      next.push([...existing, a]);
      next.push([...existing, b]);
    }
    result = next;
  }
  return result;
}

/**
 * Derives a map of color-combination key -> fractional weight for a single card face.
 *
 * Rules:
 * - If the face has no manaCost, use givenColors (empty = colorless).
 * - Otherwise, extract non-hybrid color pips and hybrid pip pairs, then generate all
 *   permutations (cartesian product) of hybrid choices. Each permutation is combined
 *   with the non-hybrid colors, deduplicated, ordered via toOrderedColors, and joined
 *   with '+'. The weight for each resulting key is count / total permutations.
 *
 * Examples:
 *   {2}           -> { colorless: 1 }
 *   {2}{g}        -> { green: 1 }
 *   {1}{r}{b}     -> { 'black+red': 1 }
 *   {1}{r/g}{r/g} -> { red: 0.25, 'red+green': 0.5, green: 0.25 }
 *   {1}{r/g}{r/b} -> { red: 0.25, 'black+red': 0.25, 'red+green': 0.25, 'black+green': 0.25 }
 */
function getFaceColorWeights(face: SerializedCardFace): Map<string, number> {
  // Cards without a mana cost use givenColors (lands, tokens, etc.)
  if (face.manaCost === undefined) {
    const given = face.givenColors ?? [];
    const key = given.length === 0 ? 'colorless' : toOrderedColors(given).join('+');
    return new Map([[key, 1]]);
  }

  const manaCost = face.manaCost;
  const nonHybridColors: CardColor[] = [];
  const hybridOptions: [CardColor, CardColor][] = [];

  for (const [mana, amount] of Object.entries(manaCost) as [Mana, number | undefined][]) {
    const count = amount ?? 0;
    if (count === 0) continue;
    if (isHybridMana(mana)) {
      const colors = hybridManaColors(mana);
      for (let i = 0; i < count; i++) {
        hybridOptions.push(colors);
      }
    } else if ((cardColors as readonly string[]).includes(mana)) {
      for (let i = 0; i < count; i++) {
        nonHybridColors.push(mana as CardColor);
      }
    }
    // generic, colorless, x pips are ignored for color-combination purposes
  }

  const permutations = cartesianProduct(hybridOptions);
  const result = new Map<string, number>();

  for (const perm of permutations) {
    const allColorsSet = new Set<CardColor>([...nonHybridColors, ...perm]);
    const allColors = [...allColorsSet];
    const key = allColors.length === 0
      ? 'colorless'
      : toOrderedColors(allColors).join('+');
    result.set(key, (result.get(key) ?? 0) + 1 / permutations.length);
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
