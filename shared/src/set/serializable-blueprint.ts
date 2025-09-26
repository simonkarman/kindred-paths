import { z } from 'zod';
import { StringCriteriaSchema } from './criteria/string-criteria';
import { BooleanCriteriaSchema } from './criteria/boolean-criteria';
import { OptionalCriteriaSchema } from './criteria/optional-criteria';
import { StringArrayCriteriaSchema } from './criteria/string-array-criteria';
import { NumberCriteriaSchema } from './criteria/number-criteria';
import { ObjectCriteriaSchema } from './criteria/object-criteria';

export const SerializableBlueprintSchema = z.object({
  name: z.array(StringCriteriaSchema),
  rarity: z.array(StringCriteriaSchema),
  isToken: z.array(BooleanCriteriaSchema),
  supertype: z.array(z.union([OptionalCriteriaSchema, StringCriteriaSchema])),
  tokenColors: z.array(StringArrayCriteriaSchema),
  types: z.array(StringArrayCriteriaSchema),
  subtypes: z.array(StringArrayCriteriaSchema),
  manaValue: z.array(NumberCriteriaSchema),
  color: z.array(StringArrayCriteriaSchema),
  colorIdentity: z.array(StringArrayCriteriaSchema),
  rules: z.array(StringCriteriaSchema),
  pt: z.array(OptionalCriteriaSchema),
  power: z.array(NumberCriteriaSchema),
  toughness: z.array(NumberCriteriaSchema),
  powerToughnessDiff: z.array(NumberCriteriaSchema),
  loyalty: z.array(NumberCriteriaSchema),
  tags: z.array(ObjectCriteriaSchema),
  creatableTokens: z.array(StringArrayCriteriaSchema),
}).partial();

export type SerializableBlueprint = z.infer<typeof SerializableBlueprintSchema>;
