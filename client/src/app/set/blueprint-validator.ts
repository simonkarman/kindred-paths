import { Card } from 'kindred-paths';
import { getCard } from '@/utils/server';

type Criteria<Key extends string, V = void> = { key: Key, value: V };

// Optional Criteria
//   must be present <void>
//   must be absent <void>
type PresentOptionalCriteria = Criteria<'is-present'>;
type AbsentOptionalCriteria = Criteria<'is-absent'>;
type OptionalCriteria = PresentOptionalCriteria | AbsentOptionalCriteria;
const checkOptionalCriteria = (criteria: OptionalCriteria, value: unknown): boolean => {
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
type NumberCriteria = MustBeOneOfNumberCriteria | MustBeAtLeastNumberCriteria | MustBeAtMostNumberCriteria | MustBeBetweenNumberCriteria;
const checkNumberCriteria = (criteria: NumberCriteria, value: unknown): boolean => {
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
type StringCriteria = MustIncludeOneOfStringCriteria | MustIncludeAllOfStringCriteria | MustHaveLengthStringCriteria;
const checkStringCriteria = (criteria: StringCriteria, value: unknown): boolean => {
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
type BooleanCriteria = MustBeTrueBooleanCriteria | MustBeFalseBooleanCriteria;
const checkBooleanCriteria = (criteria: BooleanCriteria, value: unknown): boolean => {
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
type StringArrayCriteria = MustIncludeOneOfStringArrayCriteria | MustIncludeAllOfStringArrayCriteria | MustOnlyUseFromStringArrayCriteria | MustHaveLengthStringArrayCriteria;
const checkStringArrayCriteria = (criteria: StringArrayCriteria, value: unknown): boolean => {
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
type ObjectCriteria = MustHaveKeyObjectCriteria | MustNotHaveKeyObjectCriteria | NumberValueForKeyInObjectCriteria | StringValueForKeyInObjectCriteria | BooleanValueForKeyInObjectCriteria;
const checkObjectCriteria = (criteria: ObjectCriteria, value: unknown): boolean => {
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

export type SerializableBlueprintWithSource = { source: string, blueprint: SerializableBlueprint };
export type SerializableCardReference = { cardId: string };
export type CriteriaFailureReason = { source: string, location: string, criteria: Criteria<string, unknown>, value: unknown };
export class BlueprintValidator {

  validate(props: {
    metadata: { [metadataKey: string]: string | undefined },
    blueprints: SerializableBlueprintWithSource[],
    card: Card,
  }): ({ success: true } | { success: false, reasons: CriteriaFailureReason[] }) {
    const reasons: CriteriaFailureReason[] = [];
    props.blueprints.forEach(({ source, blueprint }) => {
      const blueprintWithMetadata = {
        ...Object.entries(blueprint).map(([key, criteria]) => [key, criteria.map(c => {
          const regex = /^\$\[(.+?)]$/;
          if (c.value && typeof c.value === 'string') {
            const match = c.value.match(regex);
            if (match && match[1] && match[1] in props.metadata) {
              const metadataKey = match[1];
              return { ...c, value: props.metadata[metadataKey] ?? '' };
            }
            return c;
          }
          if (c.value && Array.isArray(c.value)) {
            return {
              ...c, value: c.value.map(v => {
                if (typeof v === 'string') {
                  const match = v.match(regex);
                  if (match && match[1] && match[1] in props.metadata) {
                    const metadataKey = match[1];
                    return props.metadata[metadataKey] ?? '';
                  }
                }
                return v;
              }),
            };
          }
          return c;
        })] as const).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {} as SerializableBlueprint),
      };
      reasons.push(...this.validateCard(source, blueprintWithMetadata, props.card));
    });
    if (reasons.length === 0) {
      return { success: true };
    }
    return { success: false, reasons };
  }

  private validateCard(
    source: string,
    blueprint: SerializableBlueprint,
    card: Card
  ): CriteriaFailureReason[] {
    const reasons: Omit<CriteriaFailureReason, 'source'>[] = [];
    if (blueprint.name) {
      blueprint.name.forEach(c => {
        if (!checkStringCriteria(c, card.name)) {
          reasons.push({ location: 'name', criteria: c, value: card.name });
        }
      });
    }
    if (blueprint.rarity) {
      blueprint.rarity.forEach(c => {
        if (!checkStringCriteria(c, card.rarity)) {
          reasons.push({ location: 'rarity', criteria: c, value: card.rarity });
        }
      });
    }
    if (blueprint.isToken) {
      blueprint.isToken.forEach(c => {
        if (!checkBooleanCriteria(c, card.isToken)) {
          reasons.push({ location: 'isToken', criteria: c, value: card.isToken });
        }
      });
    }
    if (blueprint.supertype) {
      blueprint.supertype.forEach(c => {
        if (c.key === 'is-present' || c.key === 'is-absent') {
          if (!checkOptionalCriteria(c, card.supertype)) {
            reasons.push({ location: 'supertype', criteria: c, value: card.supertype });
          }
        } else {
          if (!checkStringCriteria(c, card.supertype ?? '')) {
            reasons.push({ location: 'supertype', criteria: c, value: card.supertype });
          }
        }
      });
    }
    if (blueprint.tokenColors) {
      blueprint.tokenColors.forEach(c => {
        if (!checkStringArrayCriteria(c, card.tokenColors)) {
          reasons.push({ location: 'tokenColors', criteria: c, value: card.tokenColors });
        }
      });
    }
    if (blueprint.types) {
      blueprint.types.forEach(c => {
        if (!checkStringArrayCriteria(c, card.types)) {
          reasons.push({ location: 'types', criteria: c, value: card.types });
        }
      });
    }
    if (blueprint.subtypes) {
      blueprint.subtypes.forEach(c => {
        if (!checkStringArrayCriteria(c, card.subtypes)) {
          reasons.push({ location: 'subtypes', criteria: c, value: card.subtypes });
        }
      });
    }
    if (blueprint.manaValue) {
      const manaValue = card.manaValue();
      blueprint.manaValue.forEach(c => {
        if (!checkNumberCriteria(c, manaValue)) {
          reasons.push({ location: 'manaValue', criteria: c, value: manaValue });
        }
      });
    }
    if (blueprint.color) {
      const color = card.color();
      blueprint.color.forEach(c => {
        if (!checkStringArrayCriteria(c, color)) {
          reasons.push({ location: 'color', criteria: c, value: color });
        }
      });
    }
    if (blueprint.colorIdentity) {
      const colorIdentity = card.colorIdentity();
      blueprint.colorIdentity.forEach(c => {
        if (!checkStringArrayCriteria(c, colorIdentity)) {
          reasons.push({ location: 'colorIdentity', criteria: c, value: colorIdentity });
        }
      });
    }
    if (blueprint.rules) {
      const rulesText = card.rules.filter(r => r.variant === 'keyword' || r.variant === 'ability').map(r => r.content).join('\n').toLowerCase();
      blueprint.rules.forEach(c => {
        if (!checkStringCriteria(c, rulesText)) {
          reasons.push({ location: 'rules', criteria: c, value: rulesText });
        }
      });
    }
    if (blueprint.pt) {
      blueprint.pt.forEach(c => {
        if (!checkOptionalCriteria(c, card.pt)) {
          reasons.push({ location: 'pt', criteria: c, value: card.pt });
        }
      });
    }
    if (blueprint.power) {
      blueprint.power.forEach(c => {
        if (!checkNumberCriteria(c, card.pt?.power)) {
          reasons.push({ location: 'pt.power', criteria: c, value: card.pt?.power });
        }
      });
    }
    if (blueprint.toughness) {
      blueprint.toughness.forEach(c => {
        if (!checkNumberCriteria(c, card.pt?.toughness)) {
          reasons.push({ location: 'pt.toughness', criteria: c, value: card.pt?.toughness });
        }
      });
    }
    if (blueprint.powerToughnessDiff) {
      const powerToughnessDiff = (card.pt?.power ?? 0) - (card.pt?.toughness ?? 0);
      blueprint.powerToughnessDiff.forEach(c => {
        if (!checkNumberCriteria(c, powerToughnessDiff)) {
          reasons.push({ location: 'pt.power - pt.toughness', criteria: c, value: powerToughnessDiff });
        }
      });
    }
    if (blueprint.loyalty) {
      blueprint.loyalty.forEach(c => {
        if (!checkNumberCriteria(c, card.loyalty)) {
          reasons.push({ location: 'loyalty', criteria: c, value: card.loyalty });
        }
      });
    }
    if (blueprint.tags) {
      blueprint.tags.forEach(c => {
        if (!checkObjectCriteria(c, card.tags)) {
          reasons.push({ location: 'tags', criteria: c, value: card.tags });
        }
      });
    }
    if (blueprint.creatableTokens) {
      const tokens = card.getCreatableTokenNames();
      blueprint.creatableTokens.forEach(c => {
        if (!checkStringArrayCriteria(c, tokens)) {
          reasons.push({ location: 'creatableTokens', criteria: c, value: tokens });
        }
      });
    }
    return reasons.map(r => ({ ...r, source }));
  }
}

(async () => {
  const serializableCard = await getCard('mfy-401-miffy-the-kind');
  if (!serializableCard) {
    console.error('Failed to fetch example card');
    return;
  }
  const exampleCard = new Card(serializableCard);

  const exampleMetadata = {
    'mainCharacter': 'Miffy, The Kind',
    'mainToken': '1/1 white Rabbit creature token',
    'mechanicA': 'lifelink',
    'mechanicB': 'power 2 or less',
    'mechanicC': 'exile',
    'mechanicD': 'protection',
    'creatureTypeA': 'Cat',
    'creatureTypeB': 'Bird'
  }

  const exampleSetBlueprint: SerializableBlueprintWithSource = {
    source: 'set',
    blueprint: {
      subtypes: [{ key: 'string-array/must-only-use-from', value: ['rabbit', 'bird', 'cat', 'dog', 'pig', 'human', 'advisor'] }],
    }
  };

  const exampleArchetypeBlueprint: SerializableBlueprintWithSource = {
    source: 'archetype',
    blueprint: {
      color: [
        { key: 'string-array/must-include-all-of', value: ['white'] },
        { key: 'string-array/must-have-length', value: { key: 'number/must-be-one-of', value: [1] } },
      ],
    }
  };

  const exampleCycleBlueprint: SerializableBlueprintWithSource = {
    source: 'cycle',
    blueprint: {
      name: [{ key: 'string/must-include-one-of', value: ['$[mainCharacter]'] }],
      rarity: [{ key: 'string/must-include-one-of', value: ['mythic'] }],
      supertype: [{ key: 'string/must-include-one-of', value: ['legendary'] }],
      types: [{ key: 'string-array/must-include-all-of', value: ['creature'] }],
      subtypes: [{ key: 'string-array/must-include-all-of', value: ['rabbit'] }],
      rules: [{ key: 'string/must-include-all-of', value: ['$[mechanicB]', '$[mechanicC]'] }]
    }
  }

  const validator = new BlueprintValidator();
  const result = validator.validate({
    metadata: exampleMetadata,
    blueprints: [exampleSetBlueprint, exampleArchetypeBlueprint, exampleCycleBlueprint],
    card: exampleCard,
  });
  return `Blueprint Validator test result: ${JSON.stringify(result, null, 2)}`;
})().then(console.info)
