import { Card } from '../card';
import { SerializableBlueprint } from './serializable-blueprint';
import { BlueprintValidator, CriteriaFailureReason, SerializableBlueprintWithSource } from './blueprint-validator';

export type SerializableCardReference = { cardId: string };
export type SerializableSlot = { blueprint?: SerializableBlueprint, cardRef: SerializableCardReference };

export interface SerializableArchetype {
  name: string,
  blueprint?: SerializableBlueprint,
  metadata: { [metadataKey: string]: string | undefined },
  cycles: { [cycleKey: string]: /*(missing)*/ undefined | 'skip' | SerializableSlot },
}

export interface SerializableSet {
  name: string,
  blueprint?: SerializableBlueprint,
  metadataKeys: string[],
  cycles: { key: string, blueprint?: SerializableBlueprint }[],
  archetypes: SerializableArchetype[],
}

export type SlotStatus = 'missing' | 'skip' | 'invalid' | 'valid';
export const getBlueprintsForSlot = (
  set: SerializableSet,
  archetypeIndex: number,
  cycleKey: string,
): SerializableBlueprintWithSource[] => {
  const archetype = set.archetypes[archetypeIndex];
  const slot = archetype?.cycles[cycleKey];
  if (!slot || slot === 'skip') return [];

  return [
    { source: 'set', blueprint: set.blueprint },
    { source: 'archetype', blueprint: archetype.blueprint },
    { source: 'cycle', blueprint: set.cycles.find(c => c.key === cycleKey)?.blueprint },
    { source: 'slot', blueprint: slot.blueprint },
  ].filter(b => b.blueprint !== undefined) as SerializableBlueprintWithSource[];
};

export const getSlotStatus = (
  cards: Card[],
  set: SerializableSet,
  archetypeIndex: number,
  cycleKey: string,
): { status: SlotStatus, reasons?: CriteriaFailureReason[] } => {
  const blueprintValidator = new BlueprintValidator();
  const archetype = set.archetypes[archetypeIndex];
  const slot = archetype?.cycles[cycleKey];

  if (!slot) return { status: 'missing' };
  if (slot === 'skip') return { status: 'skip' };
  const card = cards.find(c => c.id === slot.cardRef.cardId);
  if (!card) return { status: 'missing' };

  const metadata = archetype.metadata;
  const blueprints = getBlueprintsForSlot(set, archetypeIndex, cycleKey);

  const result = blueprintValidator.validate({
    metadata,
    blueprints,
    card,
  });
  return result.success
    ? { status: 'valid' }
    : { status: 'invalid', reasons: result.reasons };
};
