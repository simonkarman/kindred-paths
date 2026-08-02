// CardConjurer-specific `Renderable` type + Card → Renderable mapping.
//
// This is the render-ready view of a Card at a given face index, shaped for CardConjurer's
// input contract (frame color letters, adventure/transform/MDFC layout metadata, mana as a
// string, etc.). It is renderer-specific — a future non-CardConjurer renderer would define
// its own equivalent — so it lives here under packages/renderer/src/cardconjurer/, not in
// @kindred-paths/shared.
//
// Ported verbatim from v1 `server/src/card-conjurer.ts` (the Renderable type) and
// `server/src/services/render-service.ts` (the Card → Renderable mapping in getRender()),
// with two changes:
//   - JavaScript instead of TypeScript (matches the rest of the renderer package)
//   - the `set` metadata (author, symbol, offset, shortName) is left undefined for now;
//     it comes in during Wave 6 when set symbols land. Cards without a symbol render fine.
//
// See docs/v2-architecture.md §4 (renderer architecture) and the Renderable type in
// server/src/card-conjurer.ts:78-126 for the source-of-truth shape.

import { Card, capitalize, colorToShort, enumerate } from '@kindred-paths/shared';

/**
 * Build a Renderable from a v1 Card JSON object at a given face index. Accepts either the
 * plain JSON shape from `collection/cards/*.json` or a Card instance.
 *
 * @param {any} cardJsonOrInstance
 * @param {number} faceIndex
 * @returns {any}  a Renderable (see the shape in v1 server/src/card-conjurer.ts:78-126)
 */
export function cardToRenderable(cardJsonOrInstance, faceIndex = 0) {
  const card = cardJsonOrInstance instanceof Card ? cardJsonOrInstance : new Card(cardJsonOrInstance);
  const cardFace = card.faces[faceIndex];
  if (!cardFace) throw new Error(`card has no face at index ${faceIndex}`);

  // MDFC — the other face is either a land (special "otherText" shape) or a
  // creature/spell (PT-prefixed subtype/type + mana cost).
  let mdfc;
  if (card.layout.id === 'modal') {
    const otherFace = card.faces[faceIndex === 0 ? 1 : 0];
    const side = faceIndex === 0 ? 'front' : 'back';

    if (otherFace.types.includes('land')) {
      const producibleColors = otherFace.producibleColors();
      mdfc = {
        side,
        otherFrameColor: 'l',
        otherCardType: 'Land',
        otherText: `{t}: Add ${enumerate(
          producibleColors.map((c) => (c === 'colorless' ? '{c}' : `{${colorToShort(c)}}`)),
          { lastSeparator: 'or' }
        )}`,
      };
    } else {
      const ptPrefix = otherFace.pt ? `${otherFace.pt.power}/${otherFace.pt.toughness} ` : '';
      const otherColors = otherFace.color();
      const otherFrameColor = otherColors.length === 0
        ? (otherFace.types.includes('artifact') ? 'a' : 'l')
        : otherColors.length === 1
          ? colorToShort(otherColors[0])
          : 'm';
      mdfc = {
        side,
        otherFrameColor,
        otherCardType: ptPrefix + (otherFace.subtypes.length > 0
          ? capitalize(otherFace.subtypes[0])
          : capitalize(otherFace.types[otherFace.types.length - 1])),
        otherText: otherFace.renderManaCost(),
      };
    }
  }

  // Adventure — face 1 is embedded in the primary render. v1 errors on rendering face 1
  // directly; we replicate that.
  let adventure;
  if (card.layout.id === 'adventure') {
    if (faceIndex === 1) throw new Error('adventure back faces cannot be rendered alone');
    const adventureFace = card.faces[1];
    adventure = {
      manaCost: adventureFace.renderManaCost(),
      title: adventureFace.name,
      type: adventureFace.renderTypeLine(),
      rules: adventureFace.renderRules(),
      color: adventureFace.color(),
    };
  }

  // Transform — front has a "reverse PT" text drawn from the back face's PT.
  let transform;
  if (card.layout.id === 'transform') {
    if (faceIndex === 0) {
      const otherPt = card.faces[1].pt;
      transform = { side: 'front', flipText: otherPt ? `${otherPt.power}/${otherPt.toughness}` : '' };
    } else {
      transform = { side: 'back' };
    }
  }

  return {
    name: cardFace.name,
    isToken: card.isToken,
    manaCost: cardFace.renderManaCost(),
    color: cardFace.color(),
    producibleColors: cardFace.producibleColors(),
    typeLine: cardFace.renderTypeLine(),
    types: cardFace.types,
    subtypes: cardFace.subtypes,
    supertype: cardFace.supertype,
    hasRules: cardFace.renderRules().length > 0,
    rules: cardFace.renderRules(),
    pt: cardFace.pt,
    loyalty: cardFace.loyalty,
    loyaltyAbilities: cardFace.loyaltyAbilities(),
    art: cardFace.art,
    tags: {
      borderless: card.getTagAsString('borderless') === 'true' || card.tags['borderless'] === true,
      'fs/rules': card.getTagAsNumber('fs/rules'),
      'art/focus': card.getTagAsString('art/focus'),
    },
    rarity: card.rarity,
    collectorNumber: card.collectorNumber,
    // set metadata comes in Wave 6 (set symbol wiring). Leaving undefined means CC skips
    // the set-symbol and collector-info blocks — cards still render, just without a symbol.
    set: undefined,
    mdfc,
    adventure,
    transform,
  };
}
