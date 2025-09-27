import { z } from 'zod';

export const BooleanCriteriaSchema = z.union([
  z.object({
    key: z.literal('boolean/true'),
    value: z.never(),
  }),
  z.object({
    key: z.literal('boolean/false'),
    value: z.never(),
  }),
]);

export type BooleanCriteria = z.infer<typeof BooleanCriteriaSchema>;

export const checkBooleanCriteria = (criteria: BooleanCriteria, value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    return false;
  }
  switch (criteria.key) {
  case 'boolean/true':
    return value;
  case 'boolean/false':
    return !value;
  }
};
