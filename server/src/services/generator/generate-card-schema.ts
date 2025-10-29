import { z } from 'zod';

// TODO: Expand this to allow for multi face cards
export const GenerateCardSchema = z.object({
  name: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  isToken: z.literal(true).optional(),
  supertype: z.enum(['basic', 'legendary']).optional(),
  tokenColors: z.array(z.enum(['white', 'blue', 'black', 'red', 'green'])).optional(),
  types: z.array(z.enum(['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'land', 'planeswalker'])).nonempty(),
  subtypes: z.array(z.string().min(1)).optional(),
  manaCost: z.record(z.enum(['white', 'blue', 'black', 'red', 'green', 'colorless', 'x']), z.number().int().nonnegative()).default({}),
  rules: z.array(z.object({
    variant: z.enum(['keyword', 'ability', 'flavor']),
    content: z.string().min(1),
  })).optional(),
  pt: z.object({
    power: z.number().int().nonnegative(),
    toughness: z.number().int().nonnegative(),
  }).optional(),
  loyalty: z.number().int().nonnegative().optional(),
});

export type GenerateCard = z.infer<typeof GenerateCardSchema>;
