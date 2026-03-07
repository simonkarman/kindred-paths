import { z } from 'zod';
import { SerializableBlueprintSchema } from './serializable-blueprint';

export const SerializableAssignmentSchema = z.object({
  cid: z.string(),
});
export type SerializableAssignment = z.infer<typeof SerializableAssignmentSchema>;

export const SerializableSlotSchema = z.object({
  blueprint: SerializableBlueprintSchema.optional(),
  assignments: z.array(SerializableAssignmentSchema),
});
export type SerializableSlot = z.infer<typeof SerializableSlotSchema>;

export const SerializableArchetypeSchema = z.object({
  name: z.string(),
  blueprint: SerializableBlueprintSchema.optional(),
  metadata: z.record(z.string().optional()),
  slots: z.record(z.union([z.literal('skip'), SerializableSlotSchema]).optional()),
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
   */
  exhaustive: z.boolean().optional().default(true),

  /**
   * Policy that defines how the set handles the same card being assigned to multiple slots.
   */
  multiAssignmentPolicy: z.enum(['unrestricted', 'unique-selected', 'unique-all'] as const).optional().default('unique-selected'),

  blueprint: SerializableBlueprintSchema.optional(),
  matrices: z.array(SerializableMatrixSchema),
});
export type SerializableSet = z.infer<typeof SerializableSetSchema>;

export type MultiAssignmentPolicy = SerializableSet['multiAssignmentPolicy'];
