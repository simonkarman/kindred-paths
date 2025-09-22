import { Random } from 'kindred-paths';

export type SerializableBlueprint = { id: string }; // Simplified for this example
export type SerializableCardReference = { id: string }; // Simplified for this example

export const validateBlueprintWithCardReference = (archetypeMetadata: SerializableArchetype['metadata'], blueprint: SerializableBlueprint, ref: SerializableCardReference): boolean => {
  // 80% chance of being valid, for demo purposes
  return Random.fromSeed(blueprint.id + ref.id).next() < 0.8;
};

export interface SerializableSet {
  name: string,
  metadataKeys: string[],
  cycleKeys: string[],
  archetypes: SerializableArchetype[],
}

export interface SerializableArchetype {
  name: string,
  metadata: { [metadataKey: string]: string | undefined }, // for example for a key "mainToken", the value can be "1/1 red Warrior creature token"
  cycles: { [cycleKey: string]: CycleSlot | undefined },
}
// The metadata and cycle keys can be undefined in the archetype, as that represents an still empty metadata, or a still empty card slot, respectively. This should be displayed with a warning as still they're still missing

export type CycleSlot = 'skip' | { blueprint: SerializableBlueprint, ref?: SerializableCardReference }

export type SlotStatus = 'missing' | 'skip' | 'blueprint' | 'invalid' | 'valid';
