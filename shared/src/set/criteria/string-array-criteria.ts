import { checkNumberCriteria, NumberCriteriaSchema } from './number-criteria';
import { z } from 'zod';

export const StringArrayCriteriaSchema = z.union([
  z.object({
    key: z.literal('string-array/must-include-one-of'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string-array/must-include-all-of'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string-array/must-only-use-from'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string-array/must-have-length'),
    value: NumberCriteriaSchema,
  }),
]);

export type StringArrayCriteria = z.infer<typeof StringArrayCriteriaSchema>;

export const checkStringArrayCriteria = (criteria: StringArrayCriteria, value: unknown): boolean => {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
    return false;
  }
  const stringArray = value as string[];
  switch (criteria.key) {
  case 'string-array/must-include-one-of':
    return criteria.value.some(v => stringArray.includes(v));
  case 'string-array/must-include-all-of':
    return criteria.value.every(v => stringArray.includes(v));
  case 'string-array/must-only-use-from':
    return stringArray.every(v => criteria.value.includes(v));
  case 'string-array/must-have-length':
    return checkNumberCriteria(criteria.value, stringArray.length);
  }
};
