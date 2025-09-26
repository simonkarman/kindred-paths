export type Criteria<Key extends string, V = void> = { key: Key, value: V };

// Optional Criteria
//   must be present <void>
//   must be absent <void>
type PresentOptionalCriteria = Criteria<'is-present'>;
type AbsentOptionalCriteria = Criteria<'is-absent'>;
export type OptionalCriteria = PresentOptionalCriteria | AbsentOptionalCriteria;
export const checkOptionalCriteria = (criteria: OptionalCriteria, value: unknown): boolean => {
  switch (criteria.key) {
  case 'is-present':
    return value !== undefined && value !== null;
  case 'is-absent':
    return value === undefined || value === null;
  }
};

// Number Criteria
//   must be one of <number[]>
//   must be at least <number>
//   must at most <number>
//   must be between <[number, number]>
type MustBeOneOfNumberCriteria = Criteria<'number/must-be-one-of', number[]>;
type MustBeAtLeastNumberCriteria = Criteria<'number/must-be-at-least', number>;
type MustBeAtMostNumberCriteria = Criteria<'number/must-be-at-most', number>;
type MustBeBetweenNumberCriteria = Criteria<'number/must-be-between', [number, number]>;
export type NumberCriteria = MustBeOneOfNumberCriteria | MustBeAtLeastNumberCriteria | MustBeAtMostNumberCriteria | MustBeBetweenNumberCriteria;
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

// String Criteria
//   must include one of <string[]>
//   must include all of <string[]>
//   must have length <!validation<number>>
type MustIncludeOneOfStringCriteria = Criteria<'string/must-include-one-of', string[]>;
type MustIncludeAllOfStringCriteria = Criteria<'string/must-include-all-of', string[]>;
type MustHaveLengthStringCriteria = Criteria<'string/must-have-length', NumberCriteria>;
export type StringCriteria = MustIncludeOneOfStringCriteria | MustIncludeAllOfStringCriteria | MustHaveLengthStringCriteria;
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

// Boolean Criteria
//   must be true
//   must be false
type MustBeTrueBooleanCriteria = Criteria<'boolean/must-be-true'>;
type MustBeFalseBooleanCriteria = Criteria<'boolean/must-be-false'>;
export type BooleanCriteria = MustBeTrueBooleanCriteria | MustBeFalseBooleanCriteria;
export const checkBooleanCriteria = (criteria: BooleanCriteria, value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    return false;
  }
  switch (criteria.key) {
  case 'boolean/must-be-true':
    return value;
  case 'boolean/must-be-false':
    return !value;
  }
};

// String[] Criteria
//   must include one of <string[]>
//   must include all of <string[]>
//   must only use from <string[]>
//   must have length <!validation<number>>
type MustIncludeOneOfStringArrayCriteria = Criteria<'string-array/must-include-one-of', string[]>;
type MustIncludeAllOfStringArrayCriteria = Criteria<'string-array/must-include-all-of', string[]>;
type MustOnlyUseFromStringArrayCriteria = Criteria<'string-array/must-only-use-from', string[]>;
type MustHaveLengthStringArrayCriteria = Criteria<'string-array/must-have-length', NumberCriteria>;
export type StringArrayCriteria = MustIncludeOneOfStringArrayCriteria | MustIncludeAllOfStringArrayCriteria | MustOnlyUseFromStringArrayCriteria
  | MustHaveLengthStringArrayCriteria;
export const checkStringArrayCriteria = (criteria: StringArrayCriteria, value: unknown): boolean => {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
    return false;
  }
  const stringArray = value as string[];
  switch (criteria.key) {
  case 'string-array/must-include-one-of':
    return criteria.value.some(v => stringArray.includes(v));
  case 'string-array/must-include-all-of':
    return criteria.value.every(v => stringArray.includes(v));
  case 'string-array/must-only-use-from':
    return stringArray.every(v => criteria.value.includes(v));
  case 'string-array/must-have-length':
    return checkNumberCriteria(criteria.value, stringArray.length);
  }
};

// Object (and Record<string, ?>) Criteria
//   must have key <string>
//   must not have key <string>
//   must have number value for <[string, !validation<number>]>
//   must have string value for <[string, !validation<string>]>
//   must have boolean value for <[string, !validation<boolean>]>
type MustHaveKeyObjectCriteria = Criteria<'object/must-have-key', string>;
type MustNotHaveKeyObjectCriteria = Criteria<'object/must-not-have-key', string>;
type NumberValueForKeyInObjectCriteria = Criteria<'object/number', [string, NumberCriteria]>;
type StringValueForKeyInObjectCriteria = Criteria<'object/string', [string, StringCriteria]>;
type BooleanValueForKeyInObjectCriteria = Criteria<'object/boolean', [string, BooleanCriteria]>;
export type ObjectCriteria = MustHaveKeyObjectCriteria | MustNotHaveKeyObjectCriteria | NumberValueForKeyInObjectCriteria
  | StringValueForKeyInObjectCriteria | BooleanValueForKeyInObjectCriteria;
export const checkObjectCriteria = (criteria: ObjectCriteria, value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as { [key: string]: unknown };
  switch (criteria.key) {
  case 'object/must-have-key':
    return criteria.value in obj;
  case 'object/must-not-have-key':
    return !(criteria.value in obj);
  case 'object/number': {
    const [key, numberCriteria] = criteria.value;
    return checkNumberCriteria(numberCriteria, obj[key]);
  }
  case 'object/string': {
    const [key, stringCriteria] = criteria.value;
    return checkStringCriteria(stringCriteria, obj[key]);
  }
  case 'object/boolean': {
    const [key, booleanCriteria] = criteria.value;
    return checkBooleanCriteria(booleanCriteria, obj[key]);
  }
  }
};

export type SerializableBlueprint = {
  name?: StringCriteria[],
  rarity?: StringCriteria[],
  isToken?: BooleanCriteria[],
  supertype?: (OptionalCriteria | StringCriteria)[],
  tokenColors?: StringArrayCriteria[],
  types?: StringArrayCriteria[],
  subtypes?: StringArrayCriteria[],
  manaValue?: NumberCriteria[],
  color?: StringArrayCriteria[],
  colorIdentity?: StringArrayCriteria[],
  rules?: StringCriteria[],
  pt?: OptionalCriteria[],
  power?: NumberCriteria[],
  toughness?: NumberCriteria[],
  powerToughnessDiff?: NumberCriteria[],
  loyalty?: NumberCriteria[],
  tags?: ObjectCriteria[],
  creatableTokens?: StringArrayCriteria[],
}
