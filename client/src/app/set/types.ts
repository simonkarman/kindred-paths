import { faCancel, faCircleCheck, faCircleXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  BlueprintValidator,
  CriteriaFailureReason,
  SerializableBlueprint,
  SerializableBlueprintWithSource,
  SerializableCardReference,
} from '@/app/set/blueprint-validator';
import { Card } from 'kindred-paths';

export interface SerializableSet {
  name: string,
  blueprint?: SerializableBlueprint,
  metadataKeys: string[],
  cycles: { key: string, blueprint?: SerializableBlueprint }[],
  archetypes: SerializableArchetype[],
}

export interface SerializableArchetype {
  name: string,
  blueprint?: SerializableBlueprint,
  metadata: { [metadataKey: string]: string | undefined },
  cycles: { [cycleKey: string]: CycleSlot },
}

export type CycleSlot = /*(missing)*/ undefined | 'skip' | CycleSlotCard
export type CycleSlotCard = { blueprint?: SerializableBlueprint, cardRef: SerializableCardReference, count: number };

export type CycleSlotStatus = 'missing' | 'skip' | 'invalid' | 'valid';

export const getStatusConfig = (status: CycleSlotStatus) => {
  switch (status) {
    case 'missing':
      return {
        label: 'Missing',
        icon: faTriangleExclamation,
        bgColor: 'bg-yellow-50 hover:bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-600'
      };
    case 'skip':
      return {
        label: 'Skip',
        icon: faCancel,
        bgColor: 'bg-gray-50 hover:bg-gray-100',
        textColor: 'text-gray-500',
        borderColor: 'border-gray-200',
        iconColor: 'text-gray-300'
      };
    case 'invalid':
      return {
        label: 'Invalid',
        icon: faCircleXmark,
        bgColor: 'bg-red-50 hover:bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        iconColor: 'text-red-600'
      };
    case 'valid':
      return {
        label: 'Valid',
        icon: faCircleCheck,
        bgColor: 'bg-green-50 hover:bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        iconColor: 'text-green-600'
      };
  }
};

export const getBlueprintsForCycleSlot = (
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

const blueprintValidator = new BlueprintValidator();
export const getCycleSlotStatus = (
  cards: Card[],
  set: SerializableSet,
  archetypeIndex: number,
  cycleKey: string,
): { status: CycleSlotStatus, reasons?: CriteriaFailureReason[] } => {
  const archetype = set.archetypes[archetypeIndex];
  const slot = archetype?.cycles[cycleKey];

  if (!slot) return { status: 'missing' };
  if (slot === 'skip') return { status: 'skip' };
  const card = cards.find(c => c.id === slot.cardRef.cardId);
  if (!card) return { status: 'missing' };

  const metadata = archetype.metadata;
  const blueprints = getBlueprintsForCycleSlot(set, archetypeIndex, cycleKey);

  const result = blueprintValidator.validate({
    metadata,
    blueprints,
    card,
  });
  return result.success
    ? { status: 'valid' }
    : { status: 'invalid', reasons: result.reasons };
};
