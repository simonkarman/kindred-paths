import { z } from 'zod';
import { SerializableBlueprintSchema } from './serializable-blueprint';

export const SerializableCardReferenceSchema = z.object({
  cardId: z.string(),
});
export type SerializableCardReference = z.infer<typeof SerializableCardReferenceSchema>;

export const SerializableSlotSchema = z.object({
  blueprint: SerializableBlueprintSchema.optional(),
  cardRef: SerializableCardReferenceSchema.optional(),
});
export type SerializableSlot = z.infer<typeof SerializableSlotSchema>;

export const SerializableArchetypeSchema = z.object({
  name: z.string(),
  blueprint: SerializableBlueprintSchema.optional(),
  metadata: z.record(z.string().optional()),
  cycles: z.record(z.union([z.literal('skip'), SerializableSlotSchema]).optional()),
});
export type SerializableArchetype = z.infer<typeof SerializableArchetypeSchema>;

const SerializableCycleSchema = z.object({
  key: z.string(),
  blueprint: SerializableBlueprintSchema.optional(),
});
export type SerializableCycle = z.infer<typeof SerializableCycleSchema>;

export const SerializableSetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  blueprint: SerializableBlueprintSchema.optional(),
  metadataKeys: z.array(z.string()),
  cycles: z.array(SerializableCycleSchema),
  archetypes: z.array(SerializableArchetypeSchema),
});
export type SerializableSet = z.infer<typeof SerializableSetSchema>;
