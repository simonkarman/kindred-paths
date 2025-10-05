import fs from 'fs/promises';
import { Card, SerializedCardSchema, SerializedCard } from 'kindred-paths';
import { computeCardId } from '../utils/card-utils';

export class CardService {
  public readonly cardsDir = './content/cards';
  public readonly artDir = './content/art';

  async getAllCards(): Promise<SerializedCard[]> {
    try {
      const files = await fs.readdir(this.cardsDir);
      return await Promise.all(files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
        .map(async (id) => {
          const card = await this.getCardById(id);
          return card!.toJson();
        })
      );
    } catch (error) {
      console.error('Error reading set directory:', error);
      return [];
    }
  }

  async getCardById(id: string): Promise<Card | undefined> {
    try {
      const data = await fs.readFile(`${this.cardsDir}/${id}.json`, 'utf-8');
      const parsed = JSON.parse(data);
      parsed.id = id;
      const result = SerializedCardSchema.safeParse(parsed);
      if (result.success) {
        return new Card(result.data);
      } else {
        console.error(`Invalid card data for ${id}:`, result.error);
        return undefined;
      }
    } catch (error) {
      console.error(`Error reading card ${id}:`, error);
      return undefined;
    }
  }

  async saveCard(card: Card, override?: Omit<Partial<SerializedCard>, 'id'>): Promise<SerializedCard> {
    const serializedCard = card.toJson();
    const path = `${this.cardsDir}/${card.id}.json`;
    await fs.mkdir(this.cardsDir, { recursive: true });
    const value: SerializedCard = { ...serializedCard, ...override };
    await fs.writeFile(path, JSON.stringify({ ...value, id: undefined }, null, 2), 'utf-8');
    return value;
  }

  async createCard(cardData: SerializedCard): Promise<{ success: true, card: SerializedCard } | { success: false, error: string, statusCode: number }> {
    const id = computeCardId(cardData);

    // Check if card with this ID already exists
    const existingCard = await this.getCardById(id);
    if (existingCard) {
      return { success: false, error: `Card with ID ${id} already exists`, statusCode: 409 };
    }

    // Try to create a new Card instance
    let card;
    try {
      card = new Card({ ...cardData, id });
    } catch (error) {
      return { success: false, error: 'Invalid card data', statusCode: 400 };
    }

    // If the new art is in the suggestions directory, we need to ensure it is moved to the art directory
    const art = await this.tryMoveArtSuggestionToArt(card.toJson());

    // Save the card and return the response
    const saved = await this.saveCard(card, { art });
    return { success: true, card: saved };
  }

  async updateCard(previousCardId: string, cardData: SerializedCard): Promise<{ success: true, card: SerializedCard } | { success: false, error: string, statusCode: number }> {
    // Check if the card exists
    const existingCard = await this.getCardById(previousCardId);
    if (!existingCard) {
      return { success: false, error: `Card with ID ${previousCardId} not found`, statusCode: 404 };
    }

    // If the card changing resulted in a change in the card ID, then we need to update the file name
    let nextCardId = computeCardId(cardData);
    if (nextCardId !== previousCardId && await this.getCardById(nextCardId)) {
      console.warn(`Card with ID ${nextCardId} already exists, sticking to old ID for ${previousCardId}`);
      nextCardId = previousCardId; // Keep the old ID
    }
    cardData.id = nextCardId;

    // Update the card with new data
    let card;
    try {
      card = new Card(cardData);
    } catch (error) {
      return { success: false, error: 'Invalid card data', statusCode: 400 };
    }

    // If the new card ID is different from the old one, we need to delete the old file
    if (nextCardId !== previousCardId) {
      await fs.rm(`${this.cardsDir}/${previousCardId}.json`);
    }

    // Move the old art to the suggestions directory
    if (existingCard.art && existingCard.art !== card.art && !existingCard.art.startsWith('suggestions/')) {
      const oldArtPath = `${this.artDir}/${existingCard.art}`;
      const suggestionsDir = `${this.artDir}/suggestions`;
      try {
        await fs.mkdir(suggestionsDir, { recursive: true });
        const newArtPath = `${suggestionsDir}/${existingCard.art}`;
        await fs.rename(oldArtPath, newArtPath);
        console.log(`Moved old art from ${oldArtPath} to ${newArtPath}`);
      } catch (error) {
        console.error(`Error moving old art for card ${previousCardId}:`, error);
      }
    }

    // If the new art is in the suggestions directory, we need to ensure it is moved to the art directory
    const art = await this.tryMoveArtSuggestionToArt(card.toJson());

    // Save the updated card
    const saved = await this.saveCard(card, { art });
    return { success: true, card: saved };
  }

  private async tryMoveArtSuggestionToArt(serializedCard: SerializedCard): Promise<string | undefined> {
    if (serializedCard.art && serializedCard.art.startsWith('suggestions/')) {
      try {
        await fs.mkdir(this.artDir, { recursive: true });
        const from = `${this.artDir}/${serializedCard.art}`;
        const toFileName = serializedCard.art.replace('suggestions/', '');
        const to = `${this.artDir}/${toFileName}`;
        await fs.rename(from, to);
        console.log(`Moved new art from ${from} to ${to}`);
        return toFileName;
      } catch (error) {
        console.error(`Error moving new art for card ${serializedCard.id}:`, error);
      }
    }
    return serializedCard.art;
  }
}

export const cardService = new CardService();
