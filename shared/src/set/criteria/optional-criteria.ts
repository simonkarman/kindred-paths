import { z } from 'zod';

export const OptionalCriteriaSchema = z.union([
  z.object({
    key: z.literal('optional/is-present'),
    value: z.never(),
  }),
  z.object({
    key: z.literal('optional/is-absent'),
    value: z.never(),
  }),
]);

export type OptionalCriteria = z.infer<typeof OptionalCriteriaSchema>;

export const checkOptionalCriteria = (criteria: OptionalCriteria, value: unknown): boolean => {
  switch (criteria.key) {
  case 'optional/is-present':
    return value !== undefined && value !== null;
  case 'optional/is-absent':
    return value === undefined || value === null;
  }
};
