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
