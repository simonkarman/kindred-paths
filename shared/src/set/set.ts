import { MultiAssignmentPolicy, SerializableSet, SerializableSetSchema } from './serializable-set';
import { MatrixLocation, Matrix } from './matrix';
import { computeCardSlug, SerializedCard } from '../serialized-card';
import { SerializableBlueprint } from './serializable-blueprint';

export type SetLocation =
  | { type: 'set' }
  | { type: 'matrix', index: number } | { type: 'matrix', name: string }
  | (Exclude<MatrixLocation, { type: 'matrix' }> & ({ matrixIndex: number } | { matrixName: string }));

export class Set {
  private readonly id: string;
  private name: string;
  private exhaustive: boolean;
  private multiAssignmentPolicy: MultiAssignmentPolicy;
  private blueprint?: SerializableBlueprint;
  private readonly matrices: Matrix[];

  constructor(serializableSet: SerializableSet) {
    this.id = serializableSet.id;
    this.name = serializableSet.name;
    this.exhaustive = serializableSet.exhaustive;
    this.multiAssignmentPolicy = serializableSet.multiAssignmentPolicy;
    this.blueprint = serializableSet.blueprint;
    this.matrices = serializableSet.matrices.map(matrix => new Matrix(this, matrix));
  }

  static new(name: string): Set {
    return new Set(SerializableSetSchema.parse({
      id: crypto.randomUUID(),
      name,
      matrices: [{
        name: 'Main',
        metadataKeys: [],
        cycles: [],
        archetypes: [],
      }],
    }));
  }

  toJson(): SerializableSet {
    return structuredClone({
      id: this.id,
      name: this.name,
      exhaustive: this.exhaustive,
      multiAssignmentPolicy: this.multiAssignmentPolicy,
      blueprint: this.blueprint,
      matrices: this.matrices.map(matrix => matrix.toJson()),
    });
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  updateName(name: string) {
    this.name = name;
  }

  setExhaustive(exhaustive: boolean) {
    this.exhaustive = exhaustive;
  }

  setMultiAssignmentPolicy(multiAssignmentPolicy: MultiAssignmentPolicy) {
    this.multiAssignmentPolicy = multiAssignmentPolicy;
  }

  getMatrixCount(): number {
    return this.matrices.length;
  }

  getMatrix(matrixIndex: number): Matrix {
    return this.matrices[matrixIndex];
  }

  addMatrix(name: string) {
    this.matrices.push(Matrix.new(name, this));
  }

  removeMatrix(matrixIndex: number) {
    this.matrices.splice(matrixIndex, 1);
    if (this.matrices.length === 0) {
      this.addMatrix('Main');
    }
  }

  getMatrices(): Matrix[] {
    return [...this.matrices];
  }

  // Blueprints
  getBlueprintAt(location: SetLocation): SerializableBlueprint | undefined {
    if (location.type === 'set') {
      return this.blueprint;

    } else if (location.type === 'matrix') {
      const matrixIndex = 'index' in location ? location.index : this.matrices.findIndex(m => m.getName() === location.name);
      return this.matrices[matrixIndex]?.getBlueprintAt({ type: 'matrix' });

    } else {
      const matrix = 'matrixIndex' in location
        ? this.matrices[location.matrixIndex]
        : this.matrices.find(m => m.getName() === location.matrixName);
      return matrix?.getBlueprintAt(location);
    }
  }

  setBlueprintAt(location: SetLocation, blueprint: SerializableBlueprint) {
    if (location.type === 'set') {
      this.blueprint = blueprint;

    } else if (location.type === 'matrix') {
      const matrixIndex = 'index' in location ? location.index : this.matrices.findIndex(m => m.getName() === location.name);
      this.matrices[matrixIndex]?.setBlueprintAt({ type: 'matrix' }, blueprint);

    } else {
      const matrix = 'matrixIndex' in location
        ? this.matrices[location.matrixIndex]
        : this.matrices.find(m => m.getName() === location.matrixName);
      matrix?.setBlueprintAt(location, blueprint);
    }
  }

  removeBlueprintAt(location: SetLocation) {
    if (location.type === 'set') {
      this.blueprint = undefined;

    } else if (location.type === 'matrix') {
      const matrixIndex = 'index' in location ? location.index : this.matrices.findIndex(m => m.getName() === location.name);
      this.matrices[matrixIndex]?.removeBlueprintAt({ type: 'matrix' });

    } else {
      const matrix = 'matrixIndex' in location
        ? this.matrices[location.matrixIndex]
        : this.matrices.find(m => m.getName() === location.matrixName);
      matrix?.removeBlueprintAt(location);
    }
  }

  getLocationName(location: SetLocation): string {
    if (location.type === 'set') {
      return 'Set Blueprint';

    } else if (location.type === 'matrix') {
      const matrixName = 'index' in location ? this.matrices[location.index]?.getName() : location.name;
      return `${matrixName} Matrix Blueprint`;

    } else {
      const matrix = 'matrixIndex' in location
        ? this.matrices[location.matrixIndex]
        : this.matrices.find(m => m.getName() === location.matrixName);
      if (!matrix) {
        throw new Error(`Matrix not found for location: ${JSON.stringify(location)}`);
      }
      return matrix.getLocationName(location);
    }
  }

  // Validate
  validateAndCorrect(cards: SerializedCard[]): string[] {
    const messages: string[] = [];

    // check that all assignments point to an existing card AND gather info for multi-assignment policy validation
    const assignmentPolicyCardIdsToLocations = new Map<string, string[]>();
    this.matrices.forEach(m => m.getArchetypes().forEach(archetype => {
      Object.entries(archetype.slots).forEach(([cycleKey, slot]) => {
        if (slot && slot !== 'skip') {
          slot.assignments = slot.assignments.map((assignment, assignmentIndex) => {
            const cardExists = cards.some(c => c.cid === assignment.cid);
            if (!cardExists) {
              messages.push(`Unassigned non-existing card "${assignment.cid}" from slot in archetype "${archetype.name}", cycle "${cycleKey}".`);
              return undefined;
            } else {
              const isPartOfMultiAssignmentPolicy = (this.multiAssignmentPolicy === 'unique-selected' && assignmentIndex === 0)
                || (this.multiAssignmentPolicy === 'unique-all');
              if (isPartOfMultiAssignmentPolicy) {
                const locations = assignmentPolicyCardIdsToLocations.get(assignment.cid) ?? [];
                assignmentPolicyCardIdsToLocations.set(assignment.cid, [...locations, `"${m.getName()}"."${archetype.name}"."${cycleKey}"`]);
              }
              return assignment;
            }
          }).filter(a => a !== undefined);
        }
      });
    }));

    // check that there are no slots without a blueprint AND without any assignments
    this.matrices.forEach(m => m.getArchetypes().forEach(archetype => {
      Object.entries(archetype.slots).forEach(([cycleKey, slot]) => {
        if (slot && slot !== 'skip' && !slot.blueprint && slot.assignments.length === 0) {
          delete archetype.slots[cycleKey];
          messages.push(
            `Removed invalid slot in archetype "${archetype.name}", cycle "${cycleKey}" as`
            + ' it didn\'t have a blueprint or at least one card assigned.',
          );
        }
      });
    }));

    // Check that no card is assigned more than once according to the multi-assignment policy
    assignmentPolicyCardIdsToLocations.forEach((locations, cardId) => {
      if (locations.length > 1) {
        messages.push(
          `Card "${cardId}" is assigned to ${locations.length} locations (${locations.join(' and ')}). ` +
          'You can fix this by unassigning the card from one of these locations. Each card should only be assigned to up to one location.',
        );
      }
    });

    if (this.exhaustive) {
      // Check that all cards with the set tag are assigned to a slot
      const cardsWithSetTag = cards.filter(c => c.tags?.set === this.name);
      cardsWithSetTag.forEach(card => {

        if (!card.isToken && !assignmentPolicyCardIdsToLocations.has(card.cid)) {
          messages.push(
            `Card "${computeCardSlug(card)} (#${card.cid})" (with tag "set=${this.name}") is not assigned to any slot.`,
          );
        }
      });
    }
    return messages;
  }
}
