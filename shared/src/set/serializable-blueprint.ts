import { z } from 'zod';
import {
  BooleanCriteriaSchema,
  NumberCriteriaSchema,
  ObjectCriteriaSchema,
  OptionalCriteriaSchema,
  StringArrayCriteriaSchema,
  StringCriteriaSchema,
} from './criteria';

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

export const blueprintFields = Object.keys(SerializableBlueprintSchema.shape) as (keyof SerializableBlueprint)[];

export type BlueprintCriteriaType = 'string' | 'boolean' | 'optional' | 'string-array' | 'number' | 'object';
export function getCriteriaTypesForSerializableBlueprintField(field: keyof SerializableBlueprint): BlueprintCriteriaType[] {
  switch (field) {
  case 'name': return ['string'];
  case 'rarity': return ['string'];
  case 'isToken': return ['boolean'];
  case 'supertype': return ['optional', 'string'];
  case 'tokenColors': return ['string-array'];
  case 'types': return ['string-array'];
  case 'subtypes': return ['string-array'];
  case 'manaValue': return ['number'];
  case 'color': return ['string-array'];
  case 'colorIdentity': return ['string-array'];
  case 'rules': return ['string'];
  case 'pt': return ['optional'];
  case 'power': return ['number'];
  case 'toughness': return ['number'];
  case 'powerToughnessDiff': return ['number'];
  case 'loyalty': return ['number'];
  case 'tags': return ['object'];
  case 'creatableTokens': return ['string-array'];
  default: return [];
  }
}
