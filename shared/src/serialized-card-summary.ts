import { z } from 'zod';
import { SerializedCardSchema } from './serialized-card';

export const SerializedCardSummarySchema = z.object({
  id: z.string().min(1),
  card: SerializedCardSchema.omit({ rules: true, art: true }),
  color: z.array(z.enum(['white', 'blue', 'black', 'red', 'green'])),
  colorIdentity: z.array(z.enum(['white', 'blue', 'black', 'red', 'green'])),
  manaValue: z.number().int().nonnegative(),
  hasArt: z.boolean(),
});

export type SerializedCardSummary = z.infer<typeof SerializedCardSummarySchema>;
