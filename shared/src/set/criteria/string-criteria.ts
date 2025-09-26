import { checkNumberCriteria, NumberCriteriaSchema } from './number-criteria';
import { z } from 'zod';

export const StringCriteriaSchema = z.union([
  z.object({
    key: z.literal('string/must-include-one-of'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string/must-include-all-of'),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal('string/must-have-length'),
    value: NumberCriteriaSchema,
  }),
]);

export type StringCriteria = z.infer<typeof StringCriteriaSchema>;

export const checkStringCriteria = (criteria: StringCriteria, value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  switch (criteria.key) {
  case 'string/must-include-one-of':
    return criteria.value.some(substring => value.includes(substring));
  case 'string/must-include-all-of':
    return criteria.value.every(substring => value.includes(substring));
  case 'string/must-have-length':
    return checkNumberCriteria(criteria.value, value.length);
  }
};
