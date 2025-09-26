import { checkNumberCriteria, NumberCriteriaSchema } from './number-criteria';
import { checkStringCriteria, StringCriteriaSchema } from './string-criteria';
import { BooleanCriteriaSchema, checkBooleanCriteria } from './boolean-criteria';
import { z } from 'zod';

export const ObjectCriteriaSchema = z.union([
  z.object({
    key: z.literal('object/must-have-key'),
    value: z.string(),
  }),
  z.object({
    key: z.literal('object/must-not-have-key'),
    value: z.string(),
  }),
  z.object({
    key: z.literal('object/number'),
    value: z.tuple([z.string(), NumberCriteriaSchema]),
  }),
  z.object({
    key: z.literal('object/string'),
    value: z.tuple([z.string(), StringCriteriaSchema]),
  }),
  z.object({
    key: z.literal('object/boolean'),
    value: z.tuple([z.string(), BooleanCriteriaSchema]),
  }),
]);

export type ObjectCriteria = z.infer<typeof ObjectCriteriaSchema>;

export const checkObjectCriteria = (criteria: ObjectCriteria, value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as { [key: string]: unknown };
  switch (criteria.key) {
  case 'object/must-have-key':
    return criteria.value in obj;
  case 'object/must-not-have-key':
    return !(criteria.value in obj);
  case 'object/number': {
    const [key, numberCriteria] = criteria.value;
    return checkNumberCriteria(numberCriteria, obj[key]);
  }
  case 'object/string': {
    const [key, stringCriteria] = criteria.value;
    return checkStringCriteria(stringCriteria, obj[key]);
  }
  case 'object/boolean': {
    const [key, booleanCriteria] = criteria.value;
    return checkBooleanCriteria(booleanCriteria, obj[key]);
  }
  }
};
