// CardConjurer frame-color helper functions.
//
// Ported verbatim from v1 `server/src/card-conjurer.ts:16-76`. These translate a
// Renderable's colors into the single-letter frame codes CardConjurer expects
// (w/u/b/r/g/a/l/m/c/v and their modal variants). Renderer-specific — a future
// non-CC renderer wouldn't use these — so they live here, not in shared.

import { colorToShort } from '@kindred-paths/shared';
import type { CardColor } from '@kindred-paths/shared';
import type { Renderable } from './renderable.js';

/** Regular (non-modal) frame colors: 0 → (l/a), 1 → color, 2 → both, 3+ → m. */
export function getFrameColors(isLand: boolean, colors: CardColor[]): [string, string | undefined] {
  const c = colors.map(colorToShort);
  if (c.length === 0) return [isLand ? 'l' : 'a', undefined];
  if (c.length === 1) return [c[0], undefined];
  if (c.length === 2) return [c[0], c[1]];
  return ['m', undefined];
}

/** Power/toughness frame color: 0 → (c/a), 1 → color, 2+ → m. */
export function getPowerToughnessColor(isLand: boolean, colors: CardColor[]): string {
  if (colors.length === 0) return isLand ? 'c' : 'a';
  if (colors.length === 1) return colorToShort(colors[0]);
  return 'm';
}

/**
 * Modal-face frame colors. Same idea as getFrameColors but with an 'l' suffix on lands
 * (e.g. 'wl' = white-land) and 'ml' for multi-land.
 */
export function getModalFrameColors(renderable: Renderable): [string, string | undefined] {
  const isLand = renderable.types.includes('land');
  const source = isLand ? renderable.producibleColors : renderable.color;
  const color = source.map((c) => (c === 'colorless' ? '' : colorToShort(c as CardColor)));

  if (color.length === 0) return [isLand ? 'l' : 'a', undefined];

  const leftColor = isLand ? `${color[0]}l` : color[0];
  if (color.length === 1) return [leftColor, undefined];

  if (color.length === 2) {
    const rightColor = isLand ? `${color[1]}l` : color[1];
    return [leftColor, rightColor];
  }

  return [isLand ? 'ml' : 'm', undefined];
}

/** Modal P/T frame color: vehicle → 'v', else 0 → 'a', 1 → color, 2+ → 'm'. */
export function getModalPowerToughnessColor(color: CardColor[], isVehicle: boolean): string {
  if (isVehicle) return 'v';
  if (color.length === 0) return 'a';
  if (color.length === 1) return colorToShort(color[0]);
  return 'm';
}

/**
 * Modal legendary crown color: dual-color-land → first color letter; vehicle → 'a';
 * otherwise → the modal color letter unchanged.
 */
export function getModalLegendaryCrownColor(color: string): string {
  if (color.length > 1 && color.endsWith('l')) return color.charAt(0);
  if (color === 'v') return 'a';
  return color;
}

/**
 * Converts straight quotes/apostrophes to typographic curly ones. Ported verbatim from
 * CC's own `curlyQuotes()` (packages/renderer/external/cardconjurer/js/creator-23.js:2460-2462).
 *
 * CC applies this to EVERY text field whenever text is set via its UI editor
 * (creator-23.js:1227: `card.text[...].text = curlyQuotes(document.querySelector('#text-editor').value);`)
 * — regardless of which field is currently selected (title, rules, abilities, mana cost,
 * etc. all go through the same code path). Our driver writes `card.text[key].text`
 * directly, bypassing CC's UI entirely, so we must apply this transform ourselves or any
 * card text containing a straight quote/apostrophe renders with the wrong glyph (visibly
 * different width — Wave 4 found this via card 47's ability text, which contains `"`).
 */
export function curlyQuotes(input: string): string {
  return input
    .replace(/ '/g, ' \u2018')
    .replace(/^'/, '\u2018')
    .replace(/'/g, '\u2019')
    .replace(/ "/g, ' \u201c')
    .replace(/" /g, '\u201d ')
    .replace(/\."/, '.\u201d')
    .replace(/"$/, '\u201d')
    .replace(/"\)/g, '\u201d)')
    .replace(/"/g, '\u201c');
}
