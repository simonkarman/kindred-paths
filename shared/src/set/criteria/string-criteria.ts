import { checkNumberCriteria, NumberCriteriaSchema } from './number-criteria';
import { z } from 'zod';

export const StringCriteriaSchema = z.union([
  z.object({
    key: z.literal('string/equal'),
    value: z.string(),
  }),
  z.object({
    key: z.literal('string/contain-one-of'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string/contain-all-of'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string/length'),
    value: NumberCriteriaSchema,
  }),
]);

export type StringCriteria = z.infer<typeof StringCriteriaSchema>;

export const checkStringCriteria = (criteria: StringCriteria, value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  switch (criteria.key) {
  case 'string/equal':
    return value === criteria.value;
  case 'string/contain-one-of':
    return criteria.value.some(substring => value.includes(substring));
  case 'string/contain-all-of':
    return criteria.value.every(substring => value.includes(substring));
  case 'string/length':
    return checkNumberCriteria(criteria.value, value.length);
  }
};
