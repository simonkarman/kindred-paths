import { SerializableArchetype, SerializableCardReference, SerializableCycle, SerializableMatrix } from './serializable-set';
import { SerializedCard } from '../serialized-card';
import { Set } from './set';
import { SerializableBlueprint } from './serializable-blueprint';
import { BlueprintValidator, CriteriaFailureReason, SerializableBlueprintWithSource } from './blueprint-validator';
import { capitalize } from '../typography';

export type SlotStatus = 'missing' | 'skip' | 'invalid' | 'valid';
export type MatrixLocation = { type: 'matrix' }
  | { type: 'archetype', index: number }
  | { type: 'cycle', index: number }
  | { type: 'slot', archetypeIndex: number, cycleKey: string };

function findAvailable(key: string, checker: (k: string) => boolean): string | undefined {
  let index = 1;
  let newKey = key;
  while (checker(newKey)) {
    newKey = `${key}_${index}`;
    index += 1;
    if (index > 99) return undefined; // Prevent infinite loop -> no change
  }
  return newKey;
}

export class Matrix {
  private static readonly blueprintValidator = new BlueprintValidator();

  private set: Set;
  private blueprint?: SerializableBlueprint;
  private metadataKeys: string[];
  private cycles: SerializableCycle[];
  private archetypes: SerializableArchetype[];

  constructor(set: Set, serializableMatrix: SerializableMatrix) {
    this.set = set;
    this.blueprint = serializableMatrix.blueprint;
    this.metadataKeys = serializableMatrix.metadataKeys;
    this.cycles = serializableMatrix.cycles;
    this.archetypes = serializableMatrix.archetypes;
  }

  static new(set: Set): Matrix {
    return new Matrix(set, {
      metadataKeys: [],
      cycles: [],
      archetypes: [],
    });
  }

  toJson(): SerializableMatrix {
    return structuredClone({
      blueprint: this.blueprint,
      metadataKeys: this.metadataKeys,
      cycles: this.cycles,
      archetypes: this.archetypes,
    });
  }

  getSet(): Set {
    return this.set;
  }

  // Matrix
  getMatrixBlueprint(): SerializableBlueprint | undefined {
    return this.blueprint;
  }

  updateMatrixBlueprint(blueprint: SerializableBlueprint) {
    this.blueprint = blueprint;
  }

  removeMatrixBlueprint() {
    delete this.blueprint;
  }

  // Archetype
  getArchetypes(): SerializableArchetype[] {
    return [...this.archetypes];
  }

  getArchetypeCount(): number {
    return this.archetypes.length;
  }

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

  removeArchetypeBlueprint(archetypeIndex: number) {
    delete this.archetypes[archetypeIndex].blueprint;
  }

  setArchetypeBlueprint(archetypeIndex: number, blueprint: SerializableBlueprint) {
    this.archetypes[archetypeIndex].blueprint = blueprint;
  }

  // Metadata
  getMetadataKey(metadataIndex: number) {
    return this.metadataKeys[metadataIndex];
  }

  getMetadataKeys() {
    return [...this.metadataKeys];
  }

  getMetadataKeyCount(): number {
    return this.metadataKeys.length;
  }

  reorderMetadataKeys(fromIndex: number, toIndex: number) {
    const [movedKey] = this.metadataKeys.splice(fromIndex, 1);
    this.metadataKeys.splice(toIndex, 0, movedKey);
  }

  hasMetadataKey(name: string) {
    return this.metadataKeys.includes(name);
  }

  addMetadataKey(atIndex: number, key: string) {
    const newKey = findAvailable(key, (k: string) => this.metadataKeys.includes(k));
    if (!newKey) return; // No available key found -> no change

    this.metadataKeys.splice(atIndex, 0, newKey);
  }

  updateMetadataKey(metadataIndex: number, _newKey: string) {
    const newKey = findAvailable(_newKey, (k: string) => this.metadataKeys.includes(k));

    const oldKey = this.metadataKeys[metadataIndex];
    if (!newKey || newKey === oldKey) return; // No change

    // Update metadataKey itself
    this.metadataKeys[metadataIndex] = newKey;

    // Update archetypes to rename the metadata key
    this.archetypes.forEach(archetype => {
      if (oldKey in archetype.metadata) {
        archetype.metadata[newKey] = archetype.metadata[oldKey];
        delete archetype.metadata[oldKey];
      }
    });
  }

  deleteMetadataKey(metadataIndex: number) {
    const [keyToDelete] = this.metadataKeys.splice(metadataIndex, 1);
    this.archetypes.forEach(archetype => {
      if (keyToDelete in archetype.metadata) {
        delete archetype.metadata[keyToDelete];
      }
    });
  }

  updateMetadataValue(archetypeIndex: number, metadataKey: string, _value: string) {
    this.archetypes[archetypeIndex].metadata[metadataKey] = _value.trim() === '' ? undefined : _value;
  }

  // Cycle
  getCycles(): SerializableCycle[] {
    return [...this.cycles];
  }

  getCycleCount(): number {
    return this.cycles.length;
  }

  getCycleKey(cycleIndex: number) {
    return this.cycles[cycleIndex].key;
  }

  reorderCycles(fromIndex: number, toIndex: number) {
    const [movedCycle] = this.cycles.splice(fromIndex, 1);
    this.cycles.splice(toIndex, 0, movedCycle);
  }

  addCycle(atIndex: number, key: string) {
    const newKey = findAvailable(key, (k: string) => this.cycles.some(c => c.key === k));
    if (!newKey) return; // No available key found -> no change

    this.cycles.splice(atIndex, 0, { key: newKey });
  }

  updateCycleKey(cycleIndex: number, _newKey: string) {
    const newKey = findAvailable(_newKey, (k: string) => this.cycles.some(c => c.key === k));

    const oldKey = this.cycles[cycleIndex].key;
    if (!newKey || newKey === oldKey) return; // No change

    // Update cycle key itself
    this.cycles[cycleIndex].key = newKey;

    // Update archetypes to rename the cycle key
    this.archetypes.forEach(archetype => {
      if (oldKey in archetype.cycles) {
        archetype.cycles[newKey] = archetype.cycles[oldKey];
        delete archetype.cycles[oldKey];
      }
    });
  }

  deleteCycle(cycleIndex: number) {
    const [cycleToDelete] = this.cycles.splice(cycleIndex, 1);
    this.archetypes.forEach(archetype => {
      if (cycleToDelete.key in archetype.cycles) {
        delete archetype.cycles[cycleToDelete.key];
      }
    });
  }

  removeCycleBlueprint(cycleIndex: number) {
    delete this.cycles[cycleIndex].blueprint;
  }

  setCycleBlueprint(cycleIndex: number, blueprint: SerializableBlueprint) {
    this.cycles[cycleIndex].blueprint = blueprint;
  }

  // Slot
  clearSlot(archetypeIndex: number, cycleKey: string) {
    delete this.archetypes[archetypeIndex].cycles[cycleKey];
  }

  markSlotAsSkip(archetypeIndex: number, cycleKey: string) {
    this.archetypes[archetypeIndex].cycles[cycleKey] = 'skip';
  }

  getBlueprintsForSlot(
    archetypeIndex: number,
    cycleKey: string,
  ): SerializableBlueprintWithSource[] {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype?.cycles[cycleKey];

    return [
      { source: 'set', blueprint: this.blueprint },
      { source: 'archetype', blueprint: archetype?.blueprint },
      { source: 'cycle', blueprint: this.cycles.find(c => c.key === cycleKey)?.blueprint },
      { source: 'slot', blueprint: slot === 'skip' ? undefined : slot?.blueprint },
    ].filter(b => b.blueprint !== undefined) as SerializableBlueprintWithSource[];
  }

  getSlotStatus(
    cards: SerializedCard[],
    archetypeIndex: number,
    cycleKey: string,
  ): { status: SlotStatus, reasons?: CriteriaFailureReason[] } {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype?.cycles[cycleKey];

    if (!slot) return { status: 'missing' };
    if (slot === 'skip') return { status: 'skip' };
    const cardRef = slot.cardRef;
    if (!cardRef) return { status: 'missing' };

    const card = cards.find(c => c.id === cardRef.cardId);
    if (!card) return { status: 'missing' };

    const metadata = archetype.metadata;
    const blueprints = this.getBlueprintsForSlot(archetypeIndex, cycleKey);

    const result = Matrix.blueprintValidator.validate({
      metadata,
      blueprints,
      card,
    });
    return result.success
      ? { status: 'valid' }
      : { status: 'invalid', reasons: result.reasons };
  }

  getSlotStats(cards: SerializedCard[]) {
    const statusCounts = { missing: 0, skip: 0, invalid: 0, valid: 0 };
    this.cycles.forEach(({ key: cycleKey }) => {
      this.archetypes.forEach((_, archetypeIndex) => {
        const { status } = this.getSlotStatus(cards, archetypeIndex, cycleKey);
        statusCounts[status] += 1;
      });
    });
    return statusCounts;
  }

  setSlotBlueprint(
    archetypeIndex: number,
    cycleKey: string,
    blueprint: SerializableBlueprint,
  ) {
    const archetype = this.archetypes[archetypeIndex];
    if (!archetype.cycles[cycleKey] || archetype.cycles[cycleKey] === 'skip') {
      archetype.cycles[cycleKey] = {
        cardRef: { cardId: '' },
        blueprint,
      };
    } else {
      archetype.cycles[cycleKey].blueprint = blueprint;
    }
  }

  removeSlotBlueprint(
    archetypeIndex: number,
    cycleKey: string,
  ) {
    const archetype = this.archetypes[archetypeIndex];
    if (!archetype.cycles[cycleKey] || archetype.cycles[cycleKey] === 'skip') {
      return;
    }
    delete archetype.cycles[cycleKey].blueprint;
    if (!archetype.cycles[cycleKey].cardRef) {
      delete archetype.cycles[cycleKey];
    }
  }

  linkCardToSlot(
    archetypeIndex: number,
    cycleKey: string,
    cardRef: SerializableCardReference,
  ) {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype.cycles[cycleKey];
    if (!slot || slot === 'skip') {
      archetype.cycles[cycleKey] = { cardRef };
    } else {
      slot.cardRef = cardRef;
    }
  }

  unlinkCardFromSlot(
    archetypeIndex: number,
    cycleKey: string,
  ) {
    const archetype = this.archetypes[archetypeIndex];
    if (!archetype.cycles[cycleKey] || archetype.cycles[cycleKey] === 'skip') {
      return;
    }
    delete archetype.cycles[cycleKey].cardRef;
    if (!archetype.cycles[cycleKey].blueprint) {
      delete archetype.cycles[cycleKey];
    }
  }

  // Blueprints
  getBlueprintAt(location: MatrixLocation): SerializableBlueprint | undefined {
    if (location.type === 'matrix') {
      return this.blueprint;

    } else if (location.type === 'archetype') {
      return this.archetypes[location.index]?.blueprint;

    } else if (location.type === 'cycle') {
      return this.cycles[location.index]?.blueprint;

    } else if (location.type === 'slot') {
      const slot = this.archetypes[location.archetypeIndex]?.cycles[location.cycleKey];
      if (slot && slot !== 'skip') {
        return slot.blueprint;
      }
    }
  }

  setBlueprintAt(location: MatrixLocation, blueprint: SerializableBlueprint) {
    if (location.type === 'matrix') {
      this.blueprint = blueprint;

    } else if (location.type === 'archetype') {
      this.archetypes[location.index].blueprint = blueprint;

    } else if (location.type === 'cycle') {
      this.cycles[location.index].blueprint = blueprint;

    } else if (location.type === 'slot') {
      const archetype = this.archetypes[location.archetypeIndex];
      const slot = archetype.cycles[location.cycleKey];
      if (slot === undefined || slot === 'skip') {
        archetype.cycles[location.cycleKey] = { blueprint };
      } else {
        slot.blueprint = blueprint;
      }
    }
  }

  removeBlueprintAt(location: MatrixLocation) {
    if (location.type === 'matrix') {
      delete this.blueprint;

    } else if (location.type === 'archetype') {
      delete this.archetypes[location.index].blueprint;

    } else if (location.type === 'cycle') {
      delete this.cycles[location.index].blueprint;

    } else if (location.type === 'slot') {
      const archetype = this.archetypes[location.archetypeIndex];
      const slot = archetype.cycles[location.cycleKey];
      if (!slot || slot === 'skip') {
        return;
      }
      delete slot.blueprint;
      if (!slot.cardRef) {
        delete archetype.cycles[location.cycleKey];
      }
    }
  }

  getLocationName(location: MatrixLocation) {
    let name = '';
    if (location.type === 'archetype') {
      name = capitalize(this.getArchetype(location.index).name);
    } else if (location.type === 'cycle') {
      name = capitalize(this.getCycleKey(location.index));
    } else if (location.type === 'slot') {
      const archetype = this.getArchetype(location.archetypeIndex);
      name = `"${capitalize(archetype.name)}"."${capitalize(location.cycleKey)}"`;
    }
    return (name.length > 0 ? `${name} ` : '') + `${capitalize(location.type)} Blueprint`;
  }

  getValidCardCount(): number {
    return this.archetypes
      .flatMap(archetype => Object.values(archetype.cycles))
      .filter(slot => slot && slot !== 'skip' && slot.cardRef)
      .length;
  }

  getTotalNonSkippedCardCount(): number {
    const skipped = this.archetypes
      .flatMap(archetype => Object.values(archetype.cycles))
      .filter(slot => slot === 'skip')
      .length;
    return (this.cycles.length * this.archetypes.length) - skipped;
  }
}
