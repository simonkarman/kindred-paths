import { BooleanCriteria } from './boolean-criteria';
import { NumberCriteria } from './number-criteria';
import { ObjectCriteria } from './object-criteria';
import { OptionalCriteria } from './optional-criteria';
import { StringArrayCriteria } from './string-array-criteria';
import { StringCriteria } from './string-criteria';
import { SerializableBlueprint } from '../serializable-blueprint';

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

export function explainAllCriteria(blueprint: SerializableBlueprint): { field: string, explanations: string[] }[] {
  const result: { field: string, explanations: string[] }[] = [];
  for (const fieldKey of Object.keys(blueprint) as (keyof SerializableBlueprint)[]) {
    const criteriaArray = blueprint[fieldKey];
    if (criteriaArray) {
      const explanations: string[] = [];
      for (const criteria of criteriaArray) {
        const explanation = explainCriteria(criteria);
        explanations.push(explanation);
      }
      result.push({ field: fieldKey, explanations: explanations });
    }
  }
  return result;
}

export function explainCriteria(criteria: AnyCriteria): string {
  switch (criteria.key) {
  case 'boolean/true':
    return 'be true';
  case 'boolean/false':
    return 'be false';
  case 'number/one-of':
    return `be one of ${criteria.value.join(' or ')}`;
  case 'number/at-least':
    return `be at least ${criteria.value}`;
  case 'number/at-most':
    return `be at most ${criteria.value}`;
  case 'number/between':
    return `be between ${criteria.value[0]} and ${criteria.value[1]}`;
  case 'object/field-present':
    return `have field "${criteria.value}"`;
  case 'object/field-absent':
    return `not have field "${criteria.value}"`;
  case 'object/number-field':
    return `have number field "${criteria.value[0]}" that must ${explainCriteria(criteria.value[1])}`;
  case 'object/string-field':
    return `have string field "${criteria.value[0]}" that must ${explainCriteria(criteria.value[1])}`;
  case 'object/boolean-field':
    return `have boolean field "${criteria.value[0]}" that must ${explainCriteria(criteria.value[1])}`;
  case 'optional/present':
    return 'be present';
  case 'optional/absent':
    return 'be absent';
  case 'string-array/includes-one-of':
    return `include ${criteria.value.map(v => `"${v}"`).join(' or ')}`;
  case 'string-array/includes-all-of':
    return `include ${criteria.value.map(v => `"${v}"`).join(' and ')}`;
  case 'string-array/allow':
    return `only use values in [${criteria.value.map(v => `"${v}"`).join(', ')}]`;
  case 'string-array/deny':
    return `never use values in [${criteria.value.map(v => `"${v}"`).join(', ')}]`;
  case 'string-array/length':
    return `have length that must ${explainCriteria(criteria.value)}`;
  case 'string/equal':
    return `be "${criteria.value}"`;
  case 'string/contain-one-of':
    return `contain ${criteria.value.map(v => `"${v}"`).join(' or ')}`;
  case 'string/contain-all-of':
    return `contain ${criteria.value.map(v => `"${v}"`).join(' and ')}`;
  case 'string/length':
    return `have length that must ${explainCriteria(criteria.value)}`;
  }
}

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
