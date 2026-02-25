import { z } from 'zod';
import { SerializableBlueprintSchema } from './serializable-blueprint';

export const SerializableCardReferenceSchema = z.object({
  cid: z.string(),
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

export const SerializableMatrixSchema = z.object({
  name: z.string(),
  blueprint: SerializableBlueprintSchema.optional(),
  metadataKeys: z.array(z.string()),
  cycles: z.array(SerializableCycleSchema),
  archetypes: z.array(SerializableArchetypeSchema),
});
export type SerializableMatrix = z.infer<typeof SerializableMatrixSchema>;

export const SerializableSetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /**
   * Whether the set requires all card to be represented in the set's matrices and archetypes.
   *
   * Default: true
   */
  exhaustive: z.boolean().optional().default(true),
  /**
   * Whether the set allows the same card to be assigned to multiple slots across the set's matrices and archetypes.
   *
   * Default: false
   */
  allowMultiAssignment: z.boolean().optional().default(false),
  matrices: z.array(SerializableMatrixSchema),
});
export type SerializableSet = z.infer<typeof SerializableSetSchema>;
