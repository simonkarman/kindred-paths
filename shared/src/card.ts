import { SerializedCard } from './serialized-card';
import { CardFace, permanentTypes } from './card-face';
import { Layout } from './layout';

export type CardLayout = 'normal' | 'modal' | 'adventure' | 'transform';
export const cardLayouts = ['normal', 'modal', 'adventure', 'transform'] as const;

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export const cardRarities = ['common', 'uncommon', 'rare', 'mythic'] as const;

export class Card {
  public readonly id: string;
  public readonly isToken?: true;
  public readonly rarity: CardRarity;
  public readonly collectorNumber: number;
  public readonly tags: { [key: string]: string | number | boolean | undefined };
  public readonly layout: Layout;
  public readonly faces: CardFace[];

  static new(layout: CardLayout): SerializedCard {
    return {
      id: '<new>',
      layout: layout,
      rarity: 'common',
      collectorNumber: 1,
      tags: { status: 'concept', createdAt: new Date().toISOString().substring(0, 10) },
      faces: new Layout(layout).defaultFaces(),
    };
  }

  constructor(props: SerializedCard) {
    this.id = props.id;
    this.isToken = props.isToken;
    this.rarity = props.rarity;
    this.collectorNumber = props.collectorNumber;
    this.tags = props.tags ?? {};
    this.layout = new Layout(props.layout);
    this.faces = props.faces.map((face, index) => new CardFace(face, this, index));

    this.validate();
  }

  public toJson(): SerializedCard {
    return structuredClone({
      id: this.id,
      rarity: this.rarity,
      isToken: this.isToken,
      collectorNumber: this.collectorNumber,
      tags: this.tags,
      layout: this.layout.toJson(),
      faces: this.faces.map(f => f.toJson()),
    });
  }

  public validate() {
    // Ensure card has at least one face and at most two faces
    if (this.faces.length === 0) {
      throw new Error('card must have at least one face');
    }
    if (this.faces.length > 2) {
      throw new Error('card cannot have more than two faces');
    }

    // If the card is a token, ensure it uses the normal layout
    if (this.isToken && this.layout.id !== 'normal') {
      throw new Error('token cards must use the normal layout');
    }

    // Check the number of faces per layout
    if (this.layout.isDualFaceLayout()) {
      if (this.faces.length !== 2) {
        throw new Error(`${this.layout.id} layout cards must have exactly two faces`);
      }
    } else {
      if (this.faces.length !== 1) {
        throw new Error(`${this.layout.id} layout cards must have exactly one face`);
      }
    }

    // Modal Layout
    if (this.layout.id === 'modal') {
      if (this.faces.flatMap(f => f.types).includes('planeswalker')) {
        throw new Error('modal layout cards cannot be planeswalkers');
      }
    }

    // Adventure Layout
    if (this.layout.id === 'adventure') {
      if (this.faces.flatMap(f => f.types).includes('planeswalker')) {
        throw new Error('adventure layout cards cannot be planeswalkers');
      }
      if (this.faces[1].supertype !== undefined) {
        throw new Error('the adventure face of an adventure layout card cannot have a supertype');
      }
      if (permanentTypes.some(permanentType => this.faces[1].types.includes(permanentType))) {
        throw new Error('the adventure face of an adventure layout card cannot be a permanent');
      }
      if (this.faces[1].manaCost === undefined) {
        throw new Error('the adventure face of an adventure layout card must have a mana cost');
      }
      if (this.faces[1].subtypes.length !== 1 || this.faces[1].subtypes[0] !== 'adventure') {
        throw new Error('the adventure face of an adventure layout card must have the subtype "Adventure"');
      }
      if (!permanentTypes.some(permanentType => this.faces[0].types.includes(permanentType))) {
        throw new Error('the main face of an adventure layout card must be a permanent');
      }
    }

    // Transform Layout
    if (this.layout.id === 'transform') {
      const face0IsPermanent = permanentTypes.some(permanentType => this.faces[0].types.includes(permanentType));
      const face1IsPermanent = permanentTypes.some(permanentType => this.faces[1].types.includes(permanentType));
      if (!face0IsPermanent || !face1IsPermanent) {
        throw new Error('both faces of a transform layout card must be permanents');
      }
      if (this.faces[1].manaCost !== undefined) {
        throw new Error('the back face of a transform layout card cannot have a mana cost');
      }
    }

    // Validate each face
    this.faces.forEach(face => face.validate());
  }

  /**
   * Get a tag value as a string.
   *
   * @param tagName the name of the tag to get
   * @param options additional options
   *                - if stringify is true, non-string values will be converted to strings
   *
   * @return the tag value as a string, or undefined if the tag does not exist or is not a string
   */
  getTagAsString(tagName: string, options?: {
    stringify?: boolean,
  }): string | undefined {
    const tagValue = this.tags[tagName];
    if (tagValue === undefined) {
      return undefined;
    }
    if (typeof tagValue === 'string') {
      return tagValue;
    }
    const stringify = options?.stringify ?? false;
    if (!stringify) {
      return undefined;
    }
    return typeof tagValue === 'boolean' ? (tagValue ? 'true' : 'false') : tagValue.toString();
  }

  /**
   * Get a tag value as a number.
   *
   * @param tagName the name of the tag to get
   * @param options additional options
   *                - if parseFromUndefined is true, undefined values will be parsed as 0
   *                - if parseFromString is true, string values will be parsed as numbers
   *                - if parseFromBoolean is true, boolean values will be parsed as 1 for true and 0 for false
   *
   * @return the tag value as a number, or undefined if the tag does not exist or cannot be parsed
   */
  getTagAsNumber(tagName: string, options?: {
    parseFromUndefined?: boolean,
    parseFromString?: boolean,
    parseFromBoolean?: boolean,
  }): number | undefined {
    const tagValue = this.tags[tagName];
    if (tagValue === undefined) {
      if (options?.parseFromUndefined) {
        return 0;
      }
      return undefined;
    }
    if (typeof tagValue === 'number') {
      return tagValue;
    }
    if (options?.parseFromString && typeof tagValue === 'string') {
      const parsed = parseFloat(tagValue);
      return isNaN(parsed) ? undefined : parsed;
    }
    if (options?.parseFromBoolean && typeof tagValue === 'boolean') {
      return tagValue ? 1 : 0;
    }
    return undefined;
  }
}
