import { CardLayout } from './card';
import { SerializedCardFace } from './serialized-card-face';

export const layoutDescriptions: { [key in CardLayout]: string } = {
  normal: 'A standard card with a single face.',
  modal: 'A card with two faces that can be played as either one.',
  adventure: 'A card with a main face and an adventure face that can be cast as a spell.',
  transform: 'A card with two faces that can transform from one to the other.',
};

export class Layout {
  public readonly id: CardLayout;

  constructor(layout: CardLayout) {
    this.id = layout;
  }

  /**
   * Returns true if this layout has two faces.
   */
  public isDualFaceLayout(): boolean {
    return ['modal', 'adventure', 'transform'].includes(this.id);
  }

  /**
   * Layouts that have to be rendered twice (once for each face).
   *
   * Note: Not all multi face layout cards have to be rendered twice (e.g., adventure cards).
   */
  public isDualRenderLayout(): boolean {
    return ['modal', 'transform'].includes(this.id);
  }

  public description(): string {
    return layoutDescriptions[this.id];
  }

  public defaultFaces(): SerializedCardFace[] {
    const defaultFace: SerializedCardFace = {
      name: 'New Card',
      manaCost: { generic: 1 },
      types: ['creature'],
      pt: { power: 2, toughness: 2 },
    };

    switch (this.id) {
    case 'normal':
      return [defaultFace];

    case 'modal':
      return [defaultFace, {
        name: 'Other Side',
        manaCost: { generic: 2 },
        types: ['creature'],
        pt: { power: 2, toughness: 2 },
      }];

    case 'adventure':
      return [defaultFace, {
        name: 'Other Side',
        manaCost: { generic: 1 },
        types: ['sorcery'],
        subtypes: ['adventure'],
      }];

    case 'transform':
      return [defaultFace, {
        name: 'Other Side',
        types: ['creature'],
        pt: { power: 2, toughness: 2 },
        givenColors: [],
      }];
    }
  }

  toJson(): CardLayout {
    return this.id;
  }
}
