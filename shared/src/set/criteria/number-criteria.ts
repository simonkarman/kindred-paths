import { z } from 'zod';

export const NumberCriteriaSchema = z.union([
  z.object({
    key: z.literal('number/must-be-one-of'),
    value: z.array(z.number()),
  }),
  z.object({
    key: z.literal('number/must-be-at-least'),
    value: z.number(),
  }),
  z.object({
    key: z.literal('number/must-be-at-most'),
    value: z.number(),
  }),
  z.object({
    key: z.literal('number/must-be-between'),
    value: z.tuple([z.number(), z.number()]),
  }),
]);
export type NumberCriteria = z.infer<typeof NumberCriteriaSchema>;

export const checkNumberCriteria = (criteria: NumberCriteria, value: unknown): boolean => {
  if (typeof value !== 'number') {
    return false;
  }
  switch (criteria.key) {
  case 'number/must-be-one-of':
    return criteria.value.includes(value);
  case 'number/must-be-at-least':
    return value >= criteria.value;
  case 'number/must-be-at-most':
    return value <= criteria.value;
  case 'number/must-be-between':
    return value >= criteria.value[0] && value <= criteria.value[1];
  }
};
