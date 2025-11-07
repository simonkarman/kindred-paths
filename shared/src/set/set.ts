import { SerializableSet } from './serializable-set';
import { Matrix, MatrixLocation } from './matrix';
import { SerializedCard } from '../serialized-card';

export type SetLocation = {
  matrixIndex: number,
  matrixLocation: MatrixLocation,
};

export class Set {
  private id: string;
  private name: string;
  private matrices: Matrix[];

  constructor(serializableSet: SerializableSet) {
    this.id = serializableSet.id;
    this.name = serializableSet.name;
    this.matrices = serializableSet.matrices.map(matrix => new Matrix(this, matrix));
  }

  static new(name: string): Set {
    return new Set({
      id: crypto.randomUUID(),
      name,
      matrices: [{
        metadataKeys: [],
        cycles: [],
        archetypes: [],
      }],
    });
  }

  toJson(): SerializableSet {
    return structuredClone({
      id: this.id,
      name: this.name,
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

  getMatrixCount(): number {
    return this.matrices.length;
  }

  getMatrix(matrixIndex: number): Matrix {
    return this.matrices[matrixIndex];
  }

  addMatrix() {
    this.matrices.push(Matrix.new(this));
  }

  getMatrices(): Matrix[] {
    return [...this.matrices];
  }

  // Validate
  validateAndCorrect(cards: SerializedCard[]): string[] {
    const messages: string[] = [];

    // check that there are no slots without a blueprint AND without a cardRef
    this.matrices.forEach(m => m.getArchetypes().forEach(archetype => {
      Object.entries(archetype.cycles).forEach(([cycleKey, slot]) => {
        if (slot && slot !== 'skip' && !slot.blueprint && !slot.cardRef) {
          delete archetype.cycles[cycleKey];
          messages.push(`Removed invalid slot in archetype "${archetype.name}", cycle "${cycleKey}" as it didn't have a blueprint or a card linked.`);
        }
      });
    }));

    // check that all cardRefs point to an existing card
    const cardIdsToLocations = new Map<string, string[]>();
    this.matrices.forEach(m => m.getArchetypes().forEach(archetype => {
      Object.entries(archetype.cycles).forEach(([cycleKey, slot]) => {
        if (slot && slot !== 'skip' && slot.cardRef) {
          const cardId = slot.cardRef.cardId;
          const cardExists = cards.some(c => c.id === cardId);
          if (!cardExists) {
            messages.push(`Unlinked non-existing card "${cardId}" from slot in archetype "${archetype.name}", cycle "${cycleKey}".`);
            delete slot.cardRef;
            if (!slot.blueprint) {
              delete archetype.cycles[cycleKey];
            }
          } else {
            const locations = cardIdsToLocations.get(cardId) ?? [];
            cardIdsToLocations.set(cardId, [...locations, `"${archetype.name}"."${cycleKey}"`]);
          }
        }
      });
    }));

    // check that no card is linked more than once
    cardIdsToLocations.forEach((locations, cardId) => {
      if (locations.length > 1) {
        messages.push(
          `Card "${cardId}" is linked to ${locations.length} locations (${locations.join(' and ')}). ` +
          'You can fix this by unlinking the card from one of these locations. Each card should only be linked to up to one location.',
        );
      }
    });

    // Check that all cards with the set tag are linked to a slot
    const cardsWithSetTag = cards.filter(c => c.tags?.set === this.name);
    cardsWithSetTag.forEach(card => {
      if (!card.isToken && !cardIdsToLocations.has(card.id)) {
        messages.push(
          `Card "${card.id}" (with tag "set=${this.name}") is not linked to any slot.`,
        );
      }
    });

    return messages;
  }
}
