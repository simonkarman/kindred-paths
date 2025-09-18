import { SerializedCard } from 'kindred-paths';

export const computeCardId = (card: SerializedCard) => {
  const set = typeof card.tags?.set === 'string' ? `${card.tags.set}-` : '';
  const prefix = set + `${card.collectorNumber}-`;
  const sanitize = (str: string) => (prefix + str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');

  if (card.supertype === 'token') {
    const pt = card.pt ? `${card.pt.power}-${card.pt.toughness}-` : '';
    const colors = card.tokenColors
      ? (card.tokenColors.length === 0 ? 'colorless-' : card.tokenColors.map(tc => `${tc}-`).join(''))
      : 'colorless-';
    return sanitize(`${pt}${colors}${card.name}-token`);
  }
  if (card.supertype === 'basic') {
    return sanitize(`basic-${card.name}`);
  }
  return sanitize(card.name);
};
