import { SerializableArchetype, SerializableAssignment, SerializableCycle, SerializableMatrix } from './serializable-set';
import { SerializedCard } from '../serialized-card';
import { Set } from './set';
import { SerializableBlueprint } from './serializable-blueprint';
import { BlueprintValidator, CriteriaFailureReason, SerializableBlueprintWithSource } from './blueprint-validator';
import { capitalize } from '../typography';

export type SlotStatus =
  /** No card assigned to the slot */
  | 'missing'
  /** Slot is marked as skip, so it doesn't require a card */
  | 'skip'
  /** The first assigned card doesn't meet the slot's blueprint criteria */
  | 'invalid'
  /** The first assigned card meets the slot's blueprint criteria, and it's the only assigned card */
  | 'valid'
  /** The first assigned card meets the slot's blueprint criteria, but there are multiple assigned cards so it's not clear which one will be used */
  | 'valid-undecided';

export type MatrixLocation =
  | { type: 'matrix' }
  | { type: 'archetype', index: number } | { type: 'archetype', name: string }
  | { type: 'cycle', index: number } | { type: 'cycle', key: string }
  | ({ type: 'slot' }
    & ({ archetypeIndex: number } | { archetypeName: string })
    & ({ cycleIndex: number } | { cycleKey: string }))

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

  private readonly set: Set;
  private name: string;
  private blueprint?: SerializableBlueprint;
  private readonly metadataKeys: string[];
  private readonly cycles: SerializableCycle[];
  private readonly archetypes: SerializableArchetype[];

  constructor(set: Set, serializableMatrix: SerializableMatrix) {
    this.set = set;
    this.name = serializableMatrix.name;
    this.blueprint = serializableMatrix.blueprint;
    this.metadataKeys = serializableMatrix.metadataKeys;
    this.cycles = serializableMatrix.cycles;
    this.archetypes = serializableMatrix.archetypes;
  }

  static new(name: string, set: Set): Matrix {
    return new Matrix(set, {
      name,
      metadataKeys: [],
      cycles: [],
      archetypes: [],
    });
  }

  toJson(): SerializableMatrix {
    return structuredClone({
      name: this.name,
      blueprint: this.blueprint,
      metadataKeys: this.metadataKeys,
      cycles: this.cycles,
      archetypes: this.archetypes,
    });
  }

  getSet(): Set {
    return this.set;
  }

  // Name
  getName(): string {
    return this.name;
  }

  setName(name: string) {
    this.name = name;
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
      slots: {},
    });
  }

  getArchetype(archetypeIndex: number): Readonly<SerializableArchetype> {
    return this.archetypes[archetypeIndex];
  }

  deleteArchetype(archetypeIndex: number) {
    this.archetypes.splice(archetypeIndex, 1);
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
      if (oldKey in archetype.slots) {
        archetype.slots[newKey] = archetype.slots[oldKey];
        delete archetype.slots[oldKey];
      }
    });
  }

  deleteCycle(cycleIndex: number) {
    const [cycleToDelete] = this.cycles.splice(cycleIndex, 1);
    this.archetypes.forEach(archetype => {
      if (cycleToDelete.key in archetype.slots) {
        delete archetype.slots[cycleToDelete.key];
      }
    });
  }

  // Slot
  clearSlot(archetypeIndex: number, cycleKey: string) {
    delete this.archetypes[archetypeIndex].slots[cycleKey];
  }

  markSlotAsSkip(archetypeIndex: number, cycleKey: string) {
    this.archetypes[archetypeIndex].slots[cycleKey] = 'skip';
  }

  selectCardForSlot(
    archetypeIndex: number,
    cycleKey: string,
    assignment: SerializableAssignment,
  ) {
    this.assignCardToSlot(archetypeIndex, cycleKey, assignment, 0);
  }

  getSlotAssignments(archetypeIndex: number, cycleKey: string): SerializableAssignment[] {
    const slot = this.archetypes[archetypeIndex].slots[cycleKey];
    if (!slot || slot === 'skip') {
      return [];
    }
    return [...slot.assignments];
  }

  assignCardToSlot(
    archetypeIndex: number,
    cycleKey: string,
    assignment: SerializableAssignment,
    assignmentIndex: number,
  ) {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype.slots[cycleKey];
    if (!slot || slot === 'skip') {
      archetype.slots[cycleKey] = { assignments: [ assignment ] };
    } else {
      const assignments = slot.assignments.filter(a => a.cid !== assignment.cid);
      assignments.splice(assignmentIndex, 0, assignment);
      slot.assignments = assignments;
    }
  }

  unassignCardFromSlot(
    archetypeIndex: number,
    cycleKey: string,
    unassignmentIndex: number,
  ) {
    const archetype = this.archetypes[archetypeIndex];
    if (!archetype.slots[cycleKey] || archetype.slots[cycleKey] === 'skip') {
      return;
    }
    archetype.slots[cycleKey].assignments = archetype.slots[cycleKey].assignments.filter((_, index) => index !== unassignmentIndex);
    if (archetype.slots[cycleKey].assignments.length === 0 && !archetype.slots[cycleKey].blueprint) {
      delete archetype.slots[cycleKey];
    }
  }

  findSlotBlueprints(
    archetypeIndex: number,
    cycleKey: string,
  ): SerializableBlueprintWithSource[] {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype?.slots[cycleKey];

    return [
      { source: 'set', blueprint: this.set.getBlueprintAt({ type: 'set' }) },
      { source: 'matrix', blueprint: this.blueprint },
      { source: 'archetype', blueprint: archetype?.blueprint },
      { source: 'cycle', blueprint: this.cycles.find(c => c.key === cycleKey)?.blueprint },
      { source: 'slot', blueprint: slot === 'skip' ? undefined : slot?.blueprint },
    ].filter(b => b.blueprint !== undefined) as SerializableBlueprintWithSource[];
  }

  computeSlotStatus(
    cards: SerializedCard[],
    archetypeIndex: number,
    cycleKey: string,
  ): { status: SlotStatus, reasons?: CriteriaFailureReason[] } {
    const archetype = this.archetypes[archetypeIndex];
    const slot = archetype?.slots[cycleKey];

    if (!slot) return { status: 'missing' };
    if (slot === 'skip') return { status: 'skip' };
    if (slot.assignments.length === 0) return { status: 'missing' };

    const card = cards.find(c => c.cid === slot.assignments[0].cid);
    if (!card) return { status: 'missing' };

    const metadata = archetype.metadata;
    const blueprints = this.findSlotBlueprints(archetypeIndex, cycleKey);

    const result = Matrix.blueprintValidator.validate({
      metadata,
      blueprints,
      card,
    });
    return result.success
      ? { status: slot.assignments.length === 1 ? 'valid' : 'valid-undecided' }
      : { status: 'invalid', reasons: result.reasons };
  }

  // Blueprints
  getBlueprintAt(location: MatrixLocation): SerializableBlueprint | undefined {
    if (location.type === 'matrix') {
      return this.blueprint;

    } else if (location.type === 'archetype') {
      const archetypeIndex = 'index' in location ? location.index : this.archetypes.findIndex(a => a.name === location.name);
      return this.archetypes[archetypeIndex]?.blueprint;

    } else if (location.type === 'cycle') {
      const cycleIndex = 'index' in location ? location.index : this.cycles.findIndex(c => c.key === location.key);
      return this.cycles[cycleIndex]?.blueprint;

    } else if (location.type === 'slot') {
      const archetypeIndex = 'archetypeIndex' in location
        ? location.archetypeIndex
        : this.archetypes.findIndex(a => a.name === location.archetypeName);
      const cycleKey = 'cycleKey' in location
        ? location.cycleKey
        : this.cycles[location.cycleIndex]?.key;
      const slot = this.archetypes[archetypeIndex]?.slots[cycleKey];
      if (slot && slot !== 'skip') {
        return slot.blueprint;
      }
    }
  }

  setBlueprintAt(location: MatrixLocation, blueprint: SerializableBlueprint) {
    if (location.type === 'matrix') {
      this.blueprint = blueprint;

    } else if (location.type === 'archetype') {
      const archetypeIndex = 'index' in location ? location.index : this.archetypes.findIndex(a => a.name === location.name);
      this.archetypes[archetypeIndex].blueprint = blueprint;

    } else if (location.type === 'cycle') {
      const cycleIndex = 'index' in location ? location.index : this.cycles.findIndex(c => c.key === location.key);
      this.cycles[cycleIndex].blueprint = blueprint;

    } else if (location.type === 'slot') {
      const archetypeIndex = 'archetypeIndex' in location
        ? location.archetypeIndex
        : this.archetypes.findIndex(a => a.name === location.archetypeName);
      const cycleKey = 'cycleKey' in location
        ? location.cycleKey
        : this.cycles[location.cycleIndex]?.key;

      const archetype = this.archetypes[archetypeIndex];
      const slot = archetype?.slots[cycleKey];
      if (slot === undefined || slot === 'skip') {
        archetype.slots[cycleKey] = { assignments: [], blueprint };
      } else {
        slot.blueprint = blueprint;
      }
    }
  }

  removeBlueprintAt(location: MatrixLocation) {
    if (location.type === 'matrix') {
      delete this.blueprint;

    } else if (location.type === 'archetype') {
      const archetypeIndex = 'index' in location ? location.index : this.archetypes.findIndex(a => a.name === location.name);
      delete this.archetypes[archetypeIndex].blueprint;

    } else if (location.type === 'cycle') {
      const cycleIndex = 'index' in location ? location.index : this.cycles.findIndex(c => c.key === location.key);
      delete this.cycles[cycleIndex].blueprint;

    } else if (location.type === 'slot') {
      const archetypeIndex = 'archetypeIndex' in location
        ? location.archetypeIndex
        : this.archetypes.findIndex(a => a.name === location.archetypeName);
      const cycleKey = 'cycleKey' in location
        ? location.cycleKey
        : this.cycles[location.cycleIndex]?.key;

      const archetype = this.archetypes[archetypeIndex];
      const slot = archetype.slots[cycleKey];
      if (!slot || slot === 'skip') {
        return;
      }
      delete slot.blueprint;
      if (slot.assignments.length === 0) {
        delete archetype.slots[cycleKey];
      }
    }
  }

  getLocationName(location: MatrixLocation): string {
    let name = '';
    if (location.type === 'archetype') {
      const archetypeIndex = 'index' in location ? location.index : this.archetypes.findIndex(a => a.name === location.name);
      name = capitalize(this.getArchetype(archetypeIndex).name);

    } else if (location.type === 'cycle') {
      const cycleIndex = 'index' in location ? location.index : this.cycles.findIndex(c => c.key === location.key);
      name = capitalize(this.getCycleKey(cycleIndex));

    } else if (location.type === 'slot') {
      const archetypeIndex = 'archetypeIndex' in location
        ? location.archetypeIndex
        : this.archetypes.findIndex(a => a.name === location.archetypeName);
      const cycleKey = 'cycleKey' in location
        ? location.cycleKey
        : this.cycles[location.cycleIndex]?.key;

      const archetype = this.getArchetype(archetypeIndex);
      name = `"${capitalize(archetype.name)}"."${capitalize(cycleKey)}"`;
    } else {

      name = this.name;
    }
    return (name.length > 0 ? `${name} ` : '') + `${capitalize(location.type)} Blueprint`;
  }

  // Stats
  computeStats(cards: SerializedCard[]) {
    const statusCounts = { missing: 0, skip: 0, invalid: 0, valid: 0, 'valid-undecided': 0 };
    this.cycles.forEach(({ key: cycleKey }) => {
      this.archetypes.forEach((_, archetypeIndex) => {
        const { status } = this.computeSlotStatus(cards, archetypeIndex, cycleKey);
        statusCounts[status] += 1;
      });
    });
    return statusCounts;
  }

  computeNumberOfSlotsWithAtLeastOneAssignment(): number {
    return this.archetypes
      .flatMap(archetype => Object.values(archetype.slots))
      .filter(slot => slot && slot !== 'skip' && slot.assignments.length > 0)
      .length;
  }

  computeNumberOfNonSkipSlots(): number {
    const skipped = this.archetypes
      .flatMap(archetype => Object.values(archetype.slots))
      .filter(slot => slot === 'skip')
      .length;
    return (this.cycles.length * this.archetypes.length) - skipped;
  }
}
