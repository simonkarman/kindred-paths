import { SerializedCard } from 'kindred-paths';

export const computeCardId = (card: SerializedCard) => {
  const set = typeof card.tags?.set === 'string' ? `${card.tags.set}-` : '';
  const collectorNumberAsString = ('0000' + card.collectorNumber).slice(-4);
  const prefix = set + `${collectorNumberAsString}-`;
  const faceParts = card.faces.map(face => {
    if (card.isToken) {
      const supertype = face.supertype ? `${face.supertype}-` : '';
      const pt = face.pt ? `${face.pt.power}-${face.pt.toughness}-` : '';
      const colors = face.tokenColors
        ? (face.tokenColors.length === 0 ? 'colorless-' : face.tokenColors.map(tc => `${tc}-`).join(''))
        : 'colorless-';
      return `${supertype}${pt}${colors}${face.name}-${face.types.join('-')}-token`;
    }
    if (face.supertype === 'basic') {
      return `basic-${face.name}`;
    }
    return face.name;
  });

  const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  return sanitize([prefix, ...faceParts].join('-'));
};
