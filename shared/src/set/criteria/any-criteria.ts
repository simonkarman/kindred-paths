import { BooleanCriteria } from './boolean-criteria';
import { NumberCriteria } from './number-criteria';
import { ObjectCriteria } from './object-criteria';
import { OptionalCriteria } from './optional-criteria';
import { StringArrayCriteria } from './string-array-criteria';
import { StringCriteria } from './string-criteria';

export type AnyCriteria = BooleanCriteria | NumberCriteria | ObjectCriteria | OptionalCriteria | StringArrayCriteria | StringCriteria;

export const allCriteriaKeys: AnyCriteria['key'][] = [
  'string/must-include-one-of',
  'string/must-include-all-of',
  'string/must-have-length',
  'boolean/must-be-true',
  'boolean/must-be-false',
  'optional/is-present',
  'optional/is-absent',
  'string-array/must-only-use-from',
  'string-array/must-include-one-of',
  'string-array/must-include-all-of',
  'string-array/must-have-length',
  'number/must-be-one-of',
  'number/must-be-at-least',
  'number/must-be-at-most',
  'number/must-be-between',
  'object/must-have-key',
  'object/must-not-have-key',
  'object/number',
  'object/string',
  'object/boolean',
];

export function defaultCriteriaFor(key: AnyCriteria['key']): AnyCriteria {
  const defaultStringValue = 'abc';
  switch (key) {
  case 'boolean/must-be-true':
    return { key } as BooleanCriteria;
  case 'boolean/must-be-false':
    return { key } as BooleanCriteria;
  case 'number/must-be-one-of':
    return { key, value: [0] };
  case 'number/must-be-at-least':
    return { key, value: 0 };
  case 'number/must-be-at-most':
    return { key, value: 5 };
  case 'number/must-be-between':
    return { key, value: [0, 5] };
  case 'object/must-have-key':
    return { key, value: defaultStringValue };
  case 'object/must-not-have-key':
    return { key, value: defaultStringValue };
  case 'object/number':
    return { key, value: [defaultStringValue, { key: 'number/must-be-one-of', value: [0] }] };
  case 'object/string':
    return { key, value: [defaultStringValue, { key: 'string/must-include-one-of', value: [defaultStringValue] }] };
  case 'object/boolean':
    return { key, value: [defaultStringValue, { key: 'boolean/must-be-true' } as BooleanCriteria ] };
  case 'optional/is-present':
    return { key } as OptionalCriteria;
  case 'optional/is-absent':
    return { key } as OptionalCriteria;
  case 'string-array/must-include-one-of':
    return { key, value: [defaultStringValue] };
  case 'string-array/must-include-all-of':
    return { key, value: [defaultStringValue] };
  case 'string-array/must-only-use-from':
    return { key, value: [defaultStringValue] };
  case 'string-array/must-have-length':
    return { key, value: { key: 'number/must-be-at-least', value: 1 } };
  case 'string/must-include-one-of':
    return { key, value: [defaultStringValue] };
  case 'string/must-include-all-of':
    return { key, value: [defaultStringValue] };
  case 'string/must-have-length':
    return { key, value: { key: 'number/must-be-at-least', value: 1 } };
  }
}
