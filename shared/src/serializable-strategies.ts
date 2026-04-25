import { z } from 'zod';

export const SerializableStrategySchema = z.object({
  name: z.string(),
  description: z.string().optional(),

  /**
   * An array of card-filterer query strings. A card matches the strategy if it
   * matches ANY of the filters (OR logic).
   */
  filters: z.array(z.string()).min(1),
});
export type SerializableStrategy = z.infer<typeof SerializableStrategySchema>;

export const SerializableStrategiesConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  strategies: z.array(SerializableStrategySchema),
});
export type SerializableStrategiesConfig = z.infer<typeof SerializableStrategiesConfigSchema>;
