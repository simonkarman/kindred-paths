import { z } from 'zod';

export const NumberCriteriaSchema = z.union([
  z.object({
    key: z.literal('number/one-of'),
    value: z.array(z.number()),
  }),
  z.object({
    key: z.literal('number/at-least'),
    value: z.number(),
  }),
  z.object({
    key: z.literal('number/at-most'),
    value: z.number(),
  }),
  z.object({
    key: z.literal('number/between'),
    value: z.tuple([z.number(), z.number()]),
  }),
]);
export type NumberCriteria = z.infer<typeof NumberCriteriaSchema>;

export const checkNumberCriteria = (criteria: NumberCriteria, value: unknown): boolean => {
  if (typeof value !== 'number') {
    return false;
  }
  switch (criteria.key) {
  case 'number/one-of':
    return criteria.value.includes(value);
  case 'number/at-least':
    return value >= criteria.value;
  case 'number/at-most':
    return value <= criteria.value;
  case 'number/between':
    return value >= criteria.value[0] && value <= criteria.value[1];
  }
};
