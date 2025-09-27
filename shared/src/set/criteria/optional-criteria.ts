import { z } from 'zod';

export const OptionalCriteriaSchema = z.union([
  z.object({
    key: z.literal('optional/present'),
    value: z.never(),
  }),
  z.object({
    key: z.literal('optional/absent'),
    value: z.never(),
  }),
]);

export type OptionalCriteria = z.infer<typeof OptionalCriteriaSchema>;

export const checkOptionalCriteria = (criteria: OptionalCriteria, value: unknown): boolean => {
  switch (criteria.key) {
  case 'optional/present':
    return value !== undefined && value !== null;
  case 'optional/absent':
    return value === undefined || value === null;
  }
};
