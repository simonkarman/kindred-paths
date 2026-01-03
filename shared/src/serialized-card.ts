import { z } from 'zod';
import { SerializedCardFaceSchema } from './serialized-card-face';

export const SerializedCardSchema = z.object({
  id: z.string().min(1),
  isToken: z.literal(true).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  collectorNumber: z.number().int().min(1),
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.undefined()])).optional(),
  layout: z.enum(['normal', 'modal', 'adventure', 'transform']),
  faces: z.array(SerializedCardFaceSchema).min(1).max(2),
});

export type SerializedCard = z.infer<typeof SerializedCardSchema>;

export const computeCardId = (card: SerializedCard) => {
  const set = typeof card.tags?.set === 'string' ? `${card.tags.set}-` : '';
  const collectorNumberAsString = ('0000' + card.collectorNumber).slice(-4);
  const prefix = set + `${collectorNumberAsString}-`;
  const faceParts = card.faces.map(face => {
    if (card.isToken) {
      const supertype = face.supertype ? `${face.supertype}-` : '';
      const pt = face.pt ? `${face.pt.power}-${face.pt.toughness}-` : '';
      const colors = face.givenColors
        ? (face.givenColors.length === 0 ? 'colorless-' : face.givenColors.map(tc => `${tc}-`).join(''))
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
