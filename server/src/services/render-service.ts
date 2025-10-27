import fs from 'fs/promises';
import fsSync from 'fs';
import { z } from 'zod';
import { Card, CardFace, hash, SerializedCard } from 'kindred-paths';
import { CardConjurer, Renderable } from '../card-conjurer';
import { computeCardId } from '../utils/card-utils';
import { configuration } from '../configuration';

const SetMetadataOnDiskSchema = z.object({
  author: z.string().optional(),
  collectorNumberOffset: z.number().optional(),
});

type SetMetadataOnDisk = z.infer<typeof SetMetadataOnDiskSchema>;

export type SetMetadata = {
  author: string;
  shortName: string;
  symbol?: string;
  collectorNumberOffset?: number;
};

const UnknownSet = (): SetMetadata => ({
  shortName: 'SET',
  author: 'Simon Karman',
});

export class RenderService {
  private cardConjurer: CardConjurer;

  constructor(cardConjurerUrl: string) {
    this.cardConjurer = new CardConjurer(cardConjurerUrl);
  }

  async start(): Promise<void> {
    await this.cardConjurer.start();
  }

  private async getExistingRender(key: string): Promise<Buffer | undefined> {
    try {
      const path = `${configuration.rendersCacheDir}/${key}.png`;
      return await fs.readFile(path);
    }
    catch {
      return undefined;
    }
  }

  private async saveRender(key: string, render: Buffer): Promise<void> {
    const path = `${configuration.rendersCacheDir}/${key}.png`;
    await fs.mkdir(configuration.rendersCacheDir, { recursive: true });
    await fs.writeFile(path, render);
  }

  async getRender(cardFace: CardFace, force: boolean): Promise<{ fromCache: boolean, render: Buffer }> {
    // If there is card art, use a hash of the image as the art property
    // This ensures the card will be rendered only if the art itself changes
    let artHash: string | undefined = undefined;
    if (cardFace.art) {
      try {
        const artBuffer = await fs.readFile(`${configuration.artDir}/${cardFace.art}`);
        artHash = hash(artBuffer.toString('base64'));
      } catch (error) {
        console.error(`Error reading art file ${cardFace.art}:`, error);
      }
    }

    // Get the set for the card
    const set = this.getSetMetadataForCard(cardFace.card);

    // Prepare renderable object
    const renderable: Renderable = {
      name: cardFace.name,
      isToken: cardFace.card.isToken,
      manaCost: cardFace.renderManaCost(),
      color: cardFace.color(),
      predefinedColors: cardFace.tokenColors,
      typeLine: cardFace.renderTypeLine(),
      types: cardFace.types,
      subtypes: cardFace.subtypes,
      supertype: cardFace.supertype,
      hasRules: cardFace.rules.length > 0,
      rules: cardFace.renderRules(),
      pt: cardFace.pt,
      loyalty: cardFace.loyalty,
      loyaltyAbilities: cardFace.loyaltyAbilities(),
      art: cardFace.art,
      tags: {
        borderless: cardFace.card.getTagAsString('borderless') === 'true' || cardFace.card.tags['borderless'] === true,
        'fs/rules': cardFace.card.getTagAsNumber('fs/rules'),
        'art/focus': cardFace.card.getTagAsString('art/focus'),
      },
      rarity: cardFace.card.rarity,
      collectorNumber: cardFace.card.collectorNumber,
      set,
    };

    // Create a unique key for the renderable object and the content of the art file
    const key = hash(JSON.stringify({
      ...renderable,
      art: artHash,
    }));

    if (!force) {
      // Check if the render already exists
      const existingRender = await this.getExistingRender(key);
      if (existingRender) {
        return { fromCache: true, render: existingRender };
      }
    }

    // If not, render the card using Card Conjurer
    const render = await this.cardConjurer.renderCard(renderable);
    await this.saveRender(key, render);
    return { fromCache: false, render };
  }

  async generatePreview(cardData: SerializedCard, faceIndex: number): Promise<{ render: Buffer, fromCache: boolean }> {
    const card = new Card(cardData);
    const { render, fromCache } = await this.getRender(card.faces[faceIndex], false);

    // Save the card json to the previews directory
    if (!fromCache) {
      const previewId = `${new Date().toISOString()}-${computeCardId(card)}`;
      const previewPath = `${configuration.previewsCacheDir}/${previewId}.json`;
      await fs.mkdir(configuration.previewsCacheDir, { recursive: true });
      await fs.writeFile(previewPath, JSON.stringify(card.toJson(), null, 2), 'utf-8');
    }

    return { render, fromCache };
  }

  private getSetMetadataForCard(card: Card): SetMetadata {
    // If the set tag is a 3-letter string, use that as the set for the card (enforce lowercase)
    const shortName = typeof card.tags.set === 'string' && card.tags.set.length === 3
      ? card.tags.set.toLowerCase()
      : undefined;

    // If the card does not belong to a set, return as unknown.
    const unknownSet = UnknownSet();
    if (!shortName) {
      return unknownSet;
    }

    // Find set disk metadata in content/symbols/<set>.json
    const setMetadataFileName = `${configuration.symbolDir}/${shortName}-metadata.json`;
    let setMetadataOnDisk: SetMetadataOnDisk | undefined = undefined;
    if (fsSync.existsSync(setMetadataFileName)) {
      const fileContents = fsSync.readFileSync(setMetadataFileName, 'utf-8');
      const parsed = SetMetadataOnDiskSchema.safeParse(JSON.parse(fileContents));
      if (parsed.success) {
        setMetadataOnDisk = parsed.data;
      } else {
        console.warn(`Invalid set metadata for set ${shortName}: ${parsed.error}`);
      }
    }

    // Find set icon based on rarity
    const customSymbolPath = `${configuration.symbolDir}/${shortName}-${card.rarity[0]}.svg`;
    const hasCustomSymbol = fsSync.existsSync(customSymbolPath);
    if (setMetadataOnDisk && !hasCustomSymbol) {
      console.warn(`Missing ${card.rarity[0]} set symbol for custom set ${shortName}. Expected at ${customSymbolPath}`);
    }

    // Find overriding card author
    let author = setMetadataOnDisk?.author ?? unknownSet.author;
    const authorTag = card.tags.author;
    if (authorTag && typeof authorTag === 'string' && authorTag.trim().length > 0) {
      author = authorTag;
    }

    return {
      author,
      shortName: shortName.toUpperCase(),
      symbol: hasCustomSymbol ? `custom/${shortName}` : shortName,
      collectorNumberOffset: setMetadataOnDisk?.collectorNumberOffset,
    };
  }
}

export const renderService = new RenderService(process.env.CARD_CONJURER_URL || 'http://localhost:4102');
