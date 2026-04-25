import { z } from 'zod';

const WeightedFilterSchema = z.object({
  query: z.string(),
  weight: z.number().positive(),
});

export const StrategyFilterSchema = z.union([z.string(), WeightedFilterSchema]);
export type StrategyFilter = z.infer<typeof StrategyFilterSchema>;

/** Extracts the query string from a filter (string shorthand or weighted object). */
export function getFilterQuery(filter: StrategyFilter): string {
  return typeof filter === 'string' ? filter : filter.query;
}

/** Extracts the weight from a filter. String filters always have weight 1. */
export function getFilterWeight(filter: StrategyFilter): number {
  return typeof filter === 'string' ? 1 : filter.weight;
}

export const SerializableStrategySchema = z.object({
  name: z.string(),
  description: z.string().optional(),

  /**
   * An array of card-filterer query strings or weighted filter objects.
   * A card matches the strategy if it matches ANY of the filters (OR logic).
   * When a card matches multiple filters, the highest weight among matched filters is used.
   * String filters are shorthand for weight 1.
   */
  filters: z.array(StrategyFilterSchema).min(1),
});
export type SerializableStrategy = z.infer<typeof SerializableStrategySchema>;

export const SerializableStrategiesConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  strategies: z.array(SerializableStrategySchema),
});
export type SerializableStrategiesConfig = z.infer<typeof SerializableStrategiesConfigSchema>;
