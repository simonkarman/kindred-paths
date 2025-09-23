import { Random } from 'kindred-paths';
import { faCancel, faCircleCheck, faCircleXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export type SerializableBlueprint = { id: string }; // Simplified for this example
export type SerializableCardReference = { id: string }; // Simplified for this example

export const validateBlueprintWithCardReference = (props: {
  archetypeMetadata: SerializableArchetype['metadata'],
  blueprint: SerializableBlueprint,
  cardRef: SerializableCardReference,
}): boolean => {
  // 80% chance of being valid, for demo purposes
  return Random.fromSeed(props.blueprint.id + props.cardRef.id).next() < 0.8;
};

export interface SerializableSet {
  name: string,
  metadataKeys: string[],
  cycles: { key: string, blueprint?: SerializableBlueprint }[],
  archetypes: SerializableArchetype[],
}

export interface SerializableArchetype {
  name: string,
  metadata: { [metadataKey: string]: string | undefined }, // for example for a key "mainToken", the value can be "1/1 red Warrior creature token"
  cycles: { [cycleKey: string]: CycleSlot | undefined },
}

export type CycleSlot = 'skip' | { cardRef: SerializableCardReference }

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
