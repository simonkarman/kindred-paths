import fs from 'fs/promises';
import { Card, SerializedCard, hash } from 'kindred-paths';
import { CardConjurer } from '../card-conjurer';
import { getSetForCard } from '../config/sets';
import { computeCardId } from '../utils/card-utils';

export class RenderService {
  private cardConjurer: CardConjurer;

  public readonly rendersCacheDir = './.cache/renders';
  public readonly previewsCacheDir = './.cache/previews';

  constructor(cardConjurerUrl: string) {
    this.cardConjurer = new CardConjurer(cardConjurerUrl);
  }

  async start(): Promise<void> {
    await this.cardConjurer.start();
  }

  private async getExistingRender(key: string): Promise<Buffer | undefined> {
    try {
      const path = `${this.rendersCacheDir}/${key}.png`;
      return await fs.readFile(path);
    }
    catch {
      return undefined;
    }
  }

  private async saveRender(key: string, render: Buffer): Promise<void> {
    const path = `${this.rendersCacheDir}/${key}.png`;
    await fs.mkdir(this.rendersCacheDir, { recursive: true });
    await fs.writeFile(path, render);
  }

  async getRender(card: Card): Promise<{ fromCache: boolean, render: Buffer }> {
    // If there is card art, use a hash of the image as the art property
    // This ensures the card will be rendered if the art itself changes
    let art: string | undefined = undefined;
    if (card.art) {
      try {
        const artBuffer = await fs.readFile(`./content/art/${card.art}`);
        art = hash(artBuffer.toString('base64'));
      } catch (error) {
        console.error(`Error reading art file ${art}:`, error);
      }
    }

    // Get the set for the card
    const set = getSetForCard(card);

    // Create a unique key for the render based on card properties and art
    const key = hash(JSON.stringify({
      ...card.toJson(),
      id: undefined,
      tags: undefined,
      collectorNumber: card.collectorNumber - (set.collectorNumberOffset || 0),
      fontSizeTags: Object.entries(card.tags).filter(([k]) => k.startsWith('fs/')),
      artTags: Object.entries(card.tags).filter(([k]) => k.startsWith('art/')),

      // Include other properties that might affect the render
      set,
      art,
    }));

    // Check if the render already exists
    const existingRender = await this.getExistingRender(key);
    if (existingRender) {
      return { fromCache: true, render: existingRender };
    }

    // If not, render the card using Card Conjurer
    const render = await this.cardConjurer.renderCard(card, set);
    await this.saveRender(key, render);
    return { fromCache: false, render };
  }

  async generatePreview(cardData: SerializedCard): Promise<{ render: Buffer, fromCache: boolean }> {
    const card = new Card(cardData);
    const { render, fromCache } = await this.getRender(card);

    // Save the card json to the previews directory
    if (!fromCache) {
      const previewId = `${new Date().toISOString()}-${computeCardId(card)}`;
      const previewPath = `${this.previewsCacheDir}/${previewId}.json`;
      await fs.mkdir(this.previewsCacheDir, { recursive: true });
      await fs.writeFile(previewPath, JSON.stringify(card.toJson(), null, 2), 'utf-8');
    }

    return { render, fromCache };
  }
}

export const renderService = new RenderService(process.env.CARD_CONJURER_URL || "http://localhost:4102");
