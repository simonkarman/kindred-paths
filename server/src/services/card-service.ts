import fs from 'fs/promises';
import { Card, SerializedCard, SerializedCardFace, SerializedCardSchema } from 'kindred-paths';
import { computeCardId } from '../utils/card-utils';
import { configuration } from '../configuration';

export class CardService {

  public async getCardFileContent(id: string): Promise<unknown> {
    const text = await fs.readFile(`${configuration.cardsDir}/${id}.json`, 'utf-8');
    return { ...JSON.parse(text), id };
  }

  public async forEachCardFile<T>(callback: (id: string) => Promise<T>): Promise<T[]> {
    const files = await fs.readdir(configuration.cardsDir);
    return await Promise.all(files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .map((id) => callback(id)),
    );
  }

  async getAllCards(): Promise<SerializedCard[]> {
    try {
      return await this.forEachCardFile(async (id) => {
        const card = await this.getCardById(id);
        return card!.toJson();
      });
    } catch (error) {
      console.error('Error reading set directory:', error);
      return [];
    }
  }

  async getCardById(id: string): Promise<Card | undefined> {
    try {
      const content = await this.getCardFileContent(id);
      const result = SerializedCardSchema.safeParse(content);
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

  async saveCard(serializedCard: SerializedCard): Promise<SerializedCard> {
    const path = `${configuration.cardsDir}/${serializedCard.id}.json`;
    await fs.mkdir(configuration.cardsDir, { recursive: true });
    await fs.writeFile(path, JSON.stringify({ ...serializedCard, id: undefined }, null, 2), 'utf-8');
    return serializedCard;
  }

  async createCard(card: SerializedCard): Promise<
      { success: true, card: SerializedCard }
    | { success: false, error: string, statusCode: number }
  > {
    // Check if card with this ID already exists
    const id = computeCardId(card);
    const existingCard = await this.getCardById(id);
    if (existingCard) {
      return { success: false, error: `Card with ID ${id} already exists`, statusCode: 409 };
    }
    card.id = id;

    // Try to create a new Card instance
    try {
      new Card(card);
    } catch {
      return { success: false, error: 'Invalid card data', statusCode: 400 };
    }

    // If the new art is in the suggestions directory, we need to ensure it is moved to the art directory
    for (const face of card.faces) {
      face.art = await this.tryMoveArtSuggestionToArt(face, card.id);
    }

    // Save the card and return the response
    const saved = await this.saveCard(card);
    return { success: true, card: saved };
  }

  async updateCard(previousCardId: string, card: SerializedCard): Promise<
      { success: true, card: SerializedCard }
    | { success: false, error: string, statusCode: number }
  > {
    // Check if the card exists
    const existingCard = await this.getCardById(previousCardId);
    if (!existingCard) {
      return { success: false, error: `Card with ID ${previousCardId} not found`, statusCode: 404 };
    }

    // If the card changing resulted in a change in the card ID, then we need to update the file name
    let nextCardId = computeCardId(card);
    if (nextCardId !== previousCardId && await this.getCardById(nextCardId)) {
      console.warn(`Card with ID ${nextCardId} already exists, sticking to old ID for ${previousCardId}`);
      nextCardId = previousCardId; // Keep the old ID
    }
    card.id = nextCardId;

    // Update the card with new data
    try {
      new Card(card);
    } catch {
      return { success: false, error: 'Invalid card data', statusCode: 400 };
    }

    // If the new card ID is different from the old one, we need to delete the old file
    if (nextCardId !== previousCardId) {
      await fs.rm(`${configuration.cardsDir}/${previousCardId}.json`);
    }

    // Move the old art to the suggestions directory
    for (const faceIndex in existingCard.faces) {
      const existingFace = existingCard.faces[faceIndex];
      const newFace = card.faces[faceIndex];
      if (newFace && existingFace.art && existingFace.art !== newFace.art && !existingFace.art.startsWith('suggestions/')) {
        const oldArtPath = `${configuration.artDir}/${existingFace.art}`;
        const suggestionsDir = `${configuration.artDir}/suggestions`;
        try {
          await fs.mkdir(suggestionsDir, { recursive: true });
          const newArtPath = `${suggestionsDir}/${existingFace.art}`;
          await fs.rename(oldArtPath, newArtPath);
          console.log(`Moved old art from ${oldArtPath} to ${newArtPath}`);
        } catch (error) {
          console.error(`Error moving old art for card ${previousCardId}:`, error);
        }
      }
    }

    // If the new art is in the suggestions directory, we need to ensure it is moved to the art directory
    for (const face of card.faces) {
      face.art = await this.tryMoveArtSuggestionToArt(face, card.id);
    }

    // Save the updated card
    const saved = await this.saveCard(card);
    return { success: true, card: saved };
  }

  public async tryMoveArtSuggestionToArt(face: SerializedCardFace, cardId: string): Promise<string | undefined> {
    if (face.art && face.art.startsWith('suggestions/')) {
      try {
        await fs.mkdir(configuration.artDir, { recursive: true });
        const from = `${configuration.artDir}/${face.art}`;
        const toFileName = face.art.replace('suggestions/', '');
        const to = `${configuration.artDir}/${toFileName}`;
        await fs.rename(from, to);
        console.log(`Moved new art from ${from} to ${to}`);
        return toFileName;
      } catch (error) {
        console.error(`Error moving new art for card ${cardId}:`, error);
      }
    }
    return face.art;
  }
}

export const cardService = new CardService();
