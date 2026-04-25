import { describe, expect, test } from 'vitest';
import { CardColor, getColorWeights, ManaCost, SerializedCard, SerializedCardFace } from '../src';

/** Helper to create a SerializedCard with proper literal types from a plain object. */
function asCard(props: SerializedCard): SerializedCard {
  return props;
}

/** Minimal single-face card with a given manaCost. */
function cardWithCost(manaCost: ManaCost): SerializedCard {
  return asCard({
    cid: 'test0001',
    rarity: 'common',
    collectorNumber: 1,
    layout: 'normal',
    faces: [{ name: 'Test Card', types: ['creature'], manaCost }],
  });
}

/** Minimal card with no manaCost but optional givenColors. */
function cardWithGivenColors(givenColors?: CardColor[]): SerializedCard {
  return asCard({
    cid: 'test0001',
    rarity: 'common',
    collectorNumber: 1,
    layout: 'normal',
    isToken: true,
    faces: [{ name: 'Test Card', types: ['artifact'], givenColors }],
  });
}

/** Shorthand: extract weights from a single-face result and convert to a plain object. */
function weightsOf(card: SerializedCard, faceIndex = 0): Record<string, number> {
  const result = getColorWeights(card);
  const entry = result.find(e => e.faceIndex === faceIndex);
  if (!entry) throw new Error(`No FaceColorWeights found for faceIndex ${faceIndex}`);
  return Object.fromEntries(entry.weights);
}

describe('getColorWeights', () => {
  describe('colorless cards', () => {
    test('{2} -> colorless: 1', () => {
      const result = getColorWeights(cardWithCost({ generic: 2 }));
      expect(result).toHaveLength(1);
      expect(result[0].faceIndex).toBe(0);
      expect(weightsOf(cardWithCost({ generic: 2 }))).toEqual({ colorless: 1 });
    });

    test('{0} (empty mana cost object) -> colorless: 1', () => {
      expect(weightsOf(cardWithCost({}))).toEqual({ colorless: 1 });
    });

    test('{x} -> colorless: 1 (x pips ignored for color)', () => {
      expect(weightsOf(cardWithCost({ x: 1 }))).toEqual({ colorless: 1 });
    });

    test('{c} -> colorless: 1 (colorless pip)', () => {
      expect(weightsOf(cardWithCost({ colorless: 1 }))).toEqual({ colorless: 1 });
    });
  });

  describe('mono-color cards', () => {
    test('{g} -> green: 1', () => {
      expect(weightsOf(cardWithCost({ green: 1 }))).toEqual({ green: 1 });
    });

    test('{2}{g} -> green: 1', () => {
      expect(weightsOf(cardWithCost({ generic: 2, green: 1 }))).toEqual({ green: 1 });
    });

    test('{w}{w} -> white: 1', () => {
      expect(weightsOf(cardWithCost({ white: 2 }))).toEqual({ white: 1 });
    });

    test('{u} -> blue: 1', () => {
      expect(weightsOf(cardWithCost({ blue: 1 }))).toEqual({ blue: 1 });
    });

    test('{b} -> black: 1', () => {
      expect(weightsOf(cardWithCost({ black: 1 }))).toEqual({ black: 1 });
    });

    test('{r} -> red: 1', () => {
      expect(weightsOf(cardWithCost({ red: 1 }))).toEqual({ red: 1 });
    });
  });

  describe('multi-color cards (no hybrid)', () => {
    test('{1}{r}{b} -> black+red: 1', () => {
      expect(weightsOf(cardWithCost({ generic: 1, red: 1, black: 1 }))).toEqual({ 'black+red': 1 });
    });

    test('{r}{g} -> red+green: 1', () => {
      expect(weightsOf(cardWithCost({ red: 1, green: 1 }))).toEqual({ 'red+green': 1 });
    });

    test('{w}{u}{b}{r}{g} -> white+blue+black+red+green: 1 (5-color)', () => {
      expect(weightsOf(cardWithCost({ white: 1, blue: 1, black: 1, red: 1, green: 1 }))).toEqual({ 'white+blue+black+red+green': 1 });
    });
  });

  describe('single hybrid pip', () => {
    test('{r/g} -> red: 0.5, green: 0.5', () => {
      expect(weightsOf(cardWithCost({ 'red/green': 1 }))).toEqual({ red: 0.5, green: 0.5 });
    });

    test('{w/u} -> white: 0.5, blue: 0.5', () => {
      expect(weightsOf(cardWithCost({ 'white/blue': 1 }))).toEqual({ white: 0.5, blue: 0.5 });
    });
  });

  describe('two hybrid pips of the same type', () => {
    test('{1}{r/g}{r/g} -> red: 0.25, red+green: 0.5, green: 0.25', () => {
      // permutations: (r,r), (r,g), (g,r), (g,g)
      expect(weightsOf(cardWithCost({ generic: 1, 'red/green': 2 }))).toEqual({
        red: 0.25,
        'red+green': 0.5,
        green: 0.25,
      });
    });
  });

  describe('two hybrid pips of different types', () => {
    test('{1}{r/g}{r/b} -> red: 0.25, black+red: 0.25, red+green: 0.25, black+green: 0.25', () => {
      // permutations: (r,r), (r,b), (g,r), (g,b)
      expect(weightsOf(cardWithCost({ generic: 1, 'red/green': 1, 'black/red': 1 }))).toEqual({
        red: 0.25,
        'black+red': 0.25,
        'red+green': 0.25,
        'black+green': 0.25,
      });
    });
  });

  describe('hybrid pips combined with non-hybrid colors', () => {
    test('{r}{r/g} -> red: 0.5, red+green: 0.5 (hybrid redundant with existing red)', () => {
      // permutations: (r), (g) merged with fixed [red]
      // (red + r -> red), (red + g -> red+green)
      expect(weightsOf(cardWithCost({ red: 1, 'red/green': 1 }))).toEqual({ red: 0.5, 'red+green': 0.5 });
    });

    test('{w}{r/g} -> red+white: 0.5, green+white: 0.5', () => {
      expect(weightsOf(cardWithCost({ white: 1, 'red/green': 1 }))).toEqual({ 'red+white': 0.5, 'green+white': 0.5 });
    });
  });

  describe('cards without manaCost (use givenColors)', () => {
    test('no manaCost, no givenColors -> colorless: 1', () => {
      expect(weightsOf(cardWithGivenColors(undefined))).toEqual({ colorless: 1 });
    });

    test('no manaCost, empty givenColors -> colorless: 1', () => {
      expect(weightsOf(cardWithGivenColors([]))).toEqual({ colorless: 1 });
    });

    test('no manaCost, givenColors [green] -> green: 1', () => {
      expect(weightsOf(cardWithGivenColors(['green']))).toEqual({ green: 1 });
    });

    test('no manaCost, givenColors [red, green] -> red+green: 1', () => {
      expect(weightsOf(cardWithGivenColors(['red', 'green']))).toEqual({ 'red+green': 1 });
    });
  });

  describe('multi-face layouts', () => {
    const blueFace: SerializedCardFace = { name: 'Front', types: ['instant'], manaCost: { blue: 1 } };
    const redFace: SerializedCardFace = { name: 'Back', types: ['instant'], manaCost: { red: 1 } };

    test('normal with two faces: only face 0 returned', () => {
      const card = asCard({ cid: 'test0002', rarity: 'common', collectorNumber: 1, layout: 'normal', faces: [blueFace, redFace] });
      const result = getColorWeights(card);
      expect(result).toHaveLength(1);
      expect(result[0].faceIndex).toBe(0);
      expect(Object.fromEntries(result[0].weights)).toEqual({ blue: 1 });
    });

    test('transform with two faces: only face 0 returned', () => {
      const card = asCard({ cid: 'test0002', rarity: 'common', collectorNumber: 1, layout: 'transform', faces: [blueFace, redFace] });
      const result = getColorWeights(card);
      expect(result).toHaveLength(1);
      expect(result[0].faceIndex).toBe(0);
      expect(Object.fromEntries(result[0].weights)).toEqual({ blue: 1 });
    });

    test('modal with two faces: both faces returned', () => {
      const card = asCard({ cid: 'test0002', rarity: 'common', collectorNumber: 1, layout: 'modal', faces: [blueFace, redFace] });
      const result = getColorWeights(card);
      expect(result).toHaveLength(2);
      expect(result[0].faceIndex).toBe(0);
      expect(Object.fromEntries(result[0].weights)).toEqual({ blue: 1 });
      expect(result[1].faceIndex).toBe(1);
      expect(Object.fromEntries(result[1].weights)).toEqual({ red: 1 });
    });

    test('adventure with two faces: both faces returned', () => {
      const card = asCard({ cid: 'test0002', rarity: 'common', collectorNumber: 1, layout: 'adventure', faces: [blueFace, redFace] });
      const result = getColorWeights(card);
      expect(result).toHaveLength(2);
      expect(result[0].faceIndex).toBe(0);
      expect(Object.fromEntries(result[0].weights)).toEqual({ blue: 1 });
      expect(result[1].faceIndex).toBe(1);
      expect(Object.fromEntries(result[1].weights)).toEqual({ red: 1 });
    });

    test('modal with one face (defensive): only face 0 returned', () => {
      const card = asCard({ cid: 'test0002', rarity: 'common', collectorNumber: 1, layout: 'modal', faces: [blueFace] });
      const result = getColorWeights(card);
      expect(result).toHaveLength(1);
      expect(result[0].faceIndex).toBe(0);
      expect(Object.fromEntries(result[0].weights)).toEqual({ blue: 1 });
    });

    test('modal with hybrid back face: back face weights are correct', () => {
      const hybridFace: SerializedCardFace = { name: 'Back', types: ['sorcery'], manaCost: { 'red/green': 1 } };
      const card = asCard({ cid: 'test0002', rarity: 'common', collectorNumber: 1, layout: 'modal', faces: [blueFace, hybridFace] });
      const result = getColorWeights(card);
      expect(result).toHaveLength(2);
      expect(Object.fromEntries(result[0].weights)).toEqual({ blue: 1 });
      expect(Object.fromEntries(result[1].weights)).toEqual({ red: 0.5, green: 0.5 });
    });
  });
});
