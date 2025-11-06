import { z } from 'zod';

export const SerializedCardFaceSchema = z.object({
  name: z.string().min(1),
  tokenColors: z.array(z.enum(['white', 'blue', 'black', 'red', 'green'])).optional(),
  manaCost: z.record(z.enum(['white', 'blue', 'black', 'red', 'green', 'colorless', 'x']), z.number().int().nonnegative()).default({}).optional(),
  types: z.array(z.enum(['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'land', 'planeswalker'])).nonempty(),
  subtypes: z.array(z.string().min(1)).optional(),
  supertype: z.enum(['basic', 'legendary']).optional(),
  rules: z.array(z.object({
    variant: z.enum(['card-type-reminder', 'keyword', 'ability', 'inline-reminder', 'flavor']),
    content: z.string().min(1),
  })).optional(),
  pt: z.object({
    power: z.number().int().nonnegative(),
    toughness: z.number().int().nonnegative(),
  }).optional(),
  loyalty: z.number().int().nonnegative().optional(),
  art: z.string().min(5).regex(/.+\.(jpeg|jpg|png)$/i).optional(),
});
export type SerializedCardFace = z.infer<typeof SerializedCardFaceSchema>;
