import { Card } from '../card';
import { SerializableBlueprint } from './serializable-blueprint';
import { Criteria } from './criteria/criteria';
import { checkStringCriteria } from './criteria/string-criteria';
import { checkBooleanCriteria } from './criteria/boolean-criteria';
import { checkOptionalCriteria } from './criteria/optional-criteria';
import { checkStringArrayCriteria } from './criteria/string-array-criteria';
import { checkNumberCriteria } from './criteria/number-criteria';
import { checkObjectCriteria } from './criteria/object-criteria';
import { SerializedCard } from '../serialized-card';

export type SerializableBlueprintWithSource = {
  source: string,
  blueprint: SerializableBlueprint,
};

export type CriteriaFailureReason = {
  source: string,
  location: string,
  criteria: Criteria<string, unknown>,
  value: unknown,
};

export class BlueprintValidator {
  validate(props: {
    metadata: { [metadataKey: string]: string | undefined },
    blueprints: SerializableBlueprintWithSource[],
    card: SerializedCard,
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
    _card: SerializedCard,
  ): CriteriaFailureReason[] {
    const card = new Card(_card);
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
        if (c.key === 'optional/present' || c.key === 'optional/absent') {
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
