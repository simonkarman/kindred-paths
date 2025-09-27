import { BooleanCriteria } from './boolean-criteria';
import { NumberCriteria } from './number-criteria';
import { ObjectCriteria } from './object-criteria';
import { OptionalCriteria } from './optional-criteria';
import { StringArrayCriteria } from './string-array-criteria';
import { StringCriteria } from './string-criteria';

export type AnyCriteria = BooleanCriteria | NumberCriteria | ObjectCriteria | OptionalCriteria | StringArrayCriteria | StringCriteria;

export const allCriteriaKeys: AnyCriteria['key'][] = [
  'string/equal',
  'string/contain-one-of',
  'string/contain-all-of',
  'string/length',
  'boolean/true',
  'boolean/false',
  'optional/present',
  'optional/absent',
  'string-array/allow',
  'string-array/deny',
  'string-array/includes-one-of',
  'string-array/includes-all-of',
  'string-array/length',
  'number/one-of',
  'number/at-least',
  'number/at-most',
  'number/between',
  'object/field-present',
  'object/field-absent',
  'object/number-field',
  'object/string-field',
  'object/boolean-field',
];

export function defaultCriteriaFor(key: AnyCriteria['key'], defaultStringValue = 'abc'): AnyCriteria {
  switch (key) {
  case 'boolean/true':
    return { key } as BooleanCriteria;
  case 'boolean/false':
    return { key } as BooleanCriteria;
  case 'number/one-of':
    return { key, value: [0] };
  case 'number/at-least':
    return { key, value: 0 };
  case 'number/at-most':
    return { key, value: 5 };
  case 'number/between':
    return { key, value: [0, 5] };
  case 'object/field-present':
    return { key, value: defaultStringValue };
  case 'object/field-absent':
    return { key, value: defaultStringValue };
  case 'object/number-field':
    return { key, value: [defaultStringValue, { key: 'number/one-of', value: [0] }] };
  case 'object/string-field':
    return { key, value: [defaultStringValue, { key: 'string/equal', value: defaultStringValue }] };
  case 'object/boolean-field':
    return { key, value: [defaultStringValue, { key: 'boolean/true' } as BooleanCriteria ] };
  case 'optional/present':
    return { key } as OptionalCriteria;
  case 'optional/absent':
    return { key } as OptionalCriteria;
  case 'string-array/includes-one-of':
    return { key, value: [defaultStringValue] };
  case 'string-array/includes-all-of':
    return { key, value: [defaultStringValue] };
  case 'string-array/allow':
    return { key, value: [defaultStringValue] };
  case 'string-array/deny':
    return { key, value: [defaultStringValue] };
  case 'string-array/length':
    return { key, value: { key: 'number/at-least', value: 1 } };
  case 'string/equal':
    return { key, value: defaultStringValue };
  case 'string/contain-one-of':
    return { key, value: [defaultStringValue] };
  case 'string/contain-all-of':
    return { key, value: [defaultStringValue] };
  case 'string/length':
    return { key, value: { key: 'number/at-least', value: 1 } };
  }
}
