import { ReactNode } from 'react';
import { CardRarity } from 'kindred-paths';
import { typographyRarityColors } from '@/utils/typography';

export function RarityText({ children, rarity }: { rarity: CardRarity, children?: ReactNode }) {
  const gradient = typographyRarityColors.get(rarity)!;
  return <span
    key={rarity}
    style={{ color: gradient[0] }}
  >
    {children ? children : (rarity[0].toUpperCase() + rarity.slice(1))}
  </span>;
}
