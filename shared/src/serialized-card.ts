import { z } from 'zod';

export const SerializedCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  supertype: z.enum(['basic', 'token', 'legendary']).optional(),
  tokenColors: z.array(z.enum(['white', 'blue', 'black', 'red', 'green'])).optional(),
  types: z.array(z.enum(['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'land'])).nonempty(),
  subtypes: z.array(z.string().min(1)).optional(),
  manaCost: z.record(z.enum(['white', 'blue', 'black', 'red', 'green', 'colorless', 'x']), z.number().int().nonnegative()).default({}),
  rules: z.array(z.object({
    variant: z.enum(['reminder', 'keyword', 'ability', 'inline-reminder', 'flavor']),
    content: z.string().min(1),
  })).optional(),
  pt: z.object({
    power: z.number().int().nonnegative(),
    toughness: z.number().int().nonnegative(),
  }).optional(),
  collectorNumber: z.number().int().min(1),
  art: z.string().min(5).regex(/.+\.(jpeg|jpg|png)$/i).optional(),
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.undefined()])).optional(),
});

export type SerializedCard = z.infer<typeof SerializedCardSchema>;
