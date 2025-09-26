import { BlueprintValidator, CriteriaFailureReason, SerializableBlueprintWithSource } from './blueprint-validator';
import { Card } from '../card';
import { SerializableArchetype, SerializableCycle, SerializableSet } from './serializable-set';
import { SerializableBlueprint } from './serializable-blueprint';

export type SlotStatus = 'missing' | 'skip' | 'invalid' | 'valid';

export class Set {
  private readonly blueprintValidator = new BlueprintValidator();

  private name: string;
  private blueprint?: SerializableBlueprint;
  private metadataKeys: string[];
  private cycles: SerializableCycle[];
  private archetypes: SerializableArchetype[];

  constructor(serializableSet: SerializableSet) {
    this.name = serializableSet.name;
    this.blueprint = serializableSet.blueprint;
    this.metadataKeys = serializableSet.metadataKeys;
    this.cycles = serializableSet.cycles;
    this.archetypes = serializableSet.archetypes;
  }

  static empty(name: string): Set {
    return new Set({
      name,
      metadataKeys: [],
      cycles: [],
      archetypes: [],
    });
  }

  serialize(): SerializableSet {
    return structuredClone({
      name: this.name,
      blueprint: this.blueprint,
      metadataKeys: this.metadataKeys,
      cycles: this.cycles,
      archetypes: this.archetypes,
    });
  }

  // Set
  updateName(name: string) {
    this.name = name;
  }

  // Archetype
  updateArchetypeName(archetypeIndex: number, name: string) {
    this.archetypes[archetypeIndex].name = name;
  }

  addArchetype(name: string) {
    this.archetypes.push({
      name,
      metadata: {},
      cycles: {},
    });
  }

  getArchetype(archetypeIndex: number): Readonly<SerializableArchetype> {
    return this.archetypes[archetypeIndex];
  }

  deleteArchetype(archetypeIndex: number) {
    this.archetypes.splice(archetypeIndex, 1);
  }

  // Metadata
  updateMetadata(archetypeIndex: number, metadataKey: string, _value: string) {
    this.archetypes[archetypeIndex].metadata[metadataKey] = _value.trim() === '' ? undefined : _value;
  }

  reorderMetadataKeys(fromIndex: number, toIndex: number) {
    const [movedKey] = this.metadataKeys.splice(fromIndex, 1);
    this.metadataKeys.splice(toIndex, 0, movedKey);
  }

  hasMetadataKey(name: string) {
    return this.metadataKeys.includes(name);
  }

  addMetadataKey(atIndex: number, name: string) {
    this.metadataKeys.splice(atIndex, 0, name);
  }

  // Cycle

  // Status
  private getBlueprintsForSlot(
    archetypeIndex: number,
    cycleKey: string,
  ): SerializableBlueprintWithSource[] {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype?.cycles[cycleKey];
    if (!slot || slot === 'skip') return [];

    return [
      { source: 'set', blueprint: this.blueprint },
      { source: 'archetype', blueprint: archetype.blueprint },
      { source: 'cycle', blueprint: this.cycles.find(c => c.key === cycleKey)?.blueprint },
      { source: 'slot', blueprint: slot.blueprint },
    ].filter(b => b.blueprint !== undefined) as SerializableBlueprintWithSource[];
  }

  getSlotStatus(
    cards: Card[],
    archetypeIndex: number,
    cycleKey: string,
  ): { status: SlotStatus, reasons?: CriteriaFailureReason[] } {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype?.cycles[cycleKey];

    if (!slot) return { status: 'missing' };
    if (slot === 'skip') return { status: 'skip' };
    const card = cards.find(c => c.id === slot.cardRef.cardId);
    if (!card) return { status: 'missing' };

    const metadata = archetype.metadata;
    const blueprints = this.getBlueprintsForSlot(archetypeIndex, cycleKey);

    const result = this.blueprintValidator.validate({
      metadata,
      blueprints,
      card,
    });
    return result.success
      ? { status: 'valid' }
      : { status: 'invalid', reasons: result.reasons };
  }

  getStatusCounts(cards: Card[]) {
    const statusCounts = { missing: 0, skip: 0, invalid: 0, valid: 0 };
    this.cycles.forEach(({ key: cycleKey }) => {
      this.archetypes.forEach((_, archetypeIndex) => {
        const { status } = this.getSlotStatus(cards, archetypeIndex, cycleKey);
        statusCounts[status] += 1;
      });
    });
    return statusCounts;
  }
}
