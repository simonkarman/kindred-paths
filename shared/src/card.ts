import { SerializedCard } from './serialized-card';
import { CardFace } from './card-face';

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export const cardRarities = ['common', 'uncommon', 'rare', 'mythic'] as const;

export class Card {
  public readonly id: string;
  public readonly isToken?: true;
  public readonly rarity: CardRarity;
  public readonly collectorNumber: number;
  public readonly tags: { [key: string]: string | number | boolean | undefined };
  public readonly faces: CardFace[];

  static new(): SerializedCard {
    return {
      id: '<new>',
      rarity: 'common',
      collectorNumber: 1,
      tags: { status: 'concept', createdAt: new Date().toISOString().substring(0, 10) },
      faces: [{
        name: 'New Card',
        manaCost: { colorless: 1 },
        types: ['creature'],
      }],
    };
  }

  constructor(props: SerializedCard) {
    this.id = props.id;
    this.isToken = props.isToken;
    this.rarity = props.rarity;
    this.collectorNumber = props.collectorNumber;
    this.tags = props.tags ?? {};
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

    // If the card is a token, ensure it has only one face
    if (this.isToken && this.faces.length !== 1) {
      throw new Error('token cards can only have one face');
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
