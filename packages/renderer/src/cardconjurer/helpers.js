// CardConjurer frame-color helper functions.
//
// Ported verbatim from v1 `server/src/card-conjurer.ts:16-76`. These translate a
// Renderable's colors into the single-letter frame codes CardConjurer expects
// (w/u/b/r/g/a/l/m/c/v and their modal variants). Renderer-specific — a future
// non-CC renderer wouldn't use these — so they live here, not in shared.

import { colorToShort } from '@kindred-paths/shared';

/**
 * Regular (non-modal) frame colors: 0 → (l/a), 1 → color, 2 → both, 3+ → m.
 * @param {boolean} isLand
 * @param {string[]} colors
 * @returns {[string, string|undefined]}
 */
export function getFrameColors(isLand, colors) {
  const c = colors.map(colorToShort);
  if (c.length === 0) return [isLand ? 'l' : 'a', undefined];
  if (c.length === 1) return [c[0], undefined];
  if (c.length === 2) return [c[0], c[1]];
  return ['m', undefined];
}

/**
 * Power/toughness frame color: 0 → (c/a), 1 → color, 2+ → m.
 * @param {boolean} isLand
 * @param {string[]} colors
 * @returns {string}
 */
export function getPowerToughnessColor(isLand, colors) {
  if (colors.length === 0) return isLand ? 'c' : 'a';
  if (colors.length === 1) return colorToShort(colors[0]);
  return 'm';
}

/**
 * Modal-face frame colors. Same idea as getFrameColors but with an 'l' suffix on lands
 * (e.g. 'wl' = white-land) and 'ml' for multi-land.
 * @param {any} renderable
 * @returns {[string, string|undefined]}
 */
export function getModalFrameColors(renderable) {
  const isLand = renderable.types.includes('land');
  const source = isLand ? renderable.producibleColors : renderable.color;
  const color = source.map((c) => (c === 'colorless' ? '' : colorToShort(c)));

  if (color.length === 0) return [isLand ? 'l' : 'a', undefined];

  const leftColor = isLand ? `${color[0]}l` : color[0];
  if (color.length === 1) return [leftColor, undefined];

  if (color.length === 2) {
    const rightColor = isLand ? `${color[1]}l` : color[1];
    return [leftColor, rightColor];
  }

  return [isLand ? 'ml' : 'm', undefined];
}

/**
 * Modal P/T frame color: vehicle → 'v', else 0 → 'a', 1 → color, 2+ → 'm'.
 * @param {string[]} color
 * @param {boolean} isVehicle
 * @returns {string}
 */
export function getModalPowerToughnessColor(color, isVehicle) {
  if (isVehicle) return 'v';
  if (color.length === 0) return 'a';
  if (color.length === 1) return colorToShort(color[0]);
  return 'm';
}

/**
 * Modal legendary crown color: dual-color-land → first color letter; vehicle → 'a';
 * otherwise → the modal color letter unchanged.
 * @param {string} color
 * @returns {string}
 */
export function getModalLegendaryCrownColor(color) {
  if (color.length > 1 && color.endsWith('l')) return color.charAt(0);
  if (color === 'v') return 'a';
  return color;
}
