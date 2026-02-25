import fs from 'fs/promises';
import {
  Card,
  SerializedCard,
  SerializedCardFace,
  SerializedCardSchema,
  getCidFromFilename,
  computeFilename,
  computeCardSlug,
} from 'kindred-paths';
import { configuration } from '../configuration';

export class CardService {

  public findCardFilename = async (cid: string): Promise<string | undefined> => {
    const files = await fs.readdir(configuration.cardsDir);
    return files.find(file => getCidFromFilename(file) === cid);
  };

  public async getCardFileContent(cid: string): Promise<unknown> {
    const file = await this.findCardFilename(cid);
    if (!file) {
      throw new Error(`Card file with ID ${cid} not found`);
    }
    const text = await fs.readFile(`${configuration.cardsDir}/${file}`, 'utf-8');
    return { ...JSON.parse(text), cid };
  }

  public async forEachCardFile<T>(callback: (cid: string) => Promise<T>): Promise<T[]> {
    const filenames = await fs.readdir(configuration.cardsDir);
    return await Promise.all(filenames
      .map(filename => getCidFromFilename(filename))
      .filter(cid => cid !== null)
      .map((cid) => callback(cid)),
    );
  }

  async getAllCards(): Promise<SerializedCard[]> {
    try {
      return await this.forEachCardFile(async (cid) => {
        const card = await this.getCardByCid(cid);
        return card!.toJson();
      });
    } catch (error) {
      console.error('Error reading set directory:', error);
      return [];
    }
  }

  async getCardByCid(cid: string): Promise<Card | undefined> {
    try {
      const content = await this.getCardFileContent(cid);
      const result = SerializedCardSchema.safeParse(content);
      if (result.success) {
        return new Card(result.data);
      } else {
        console.error(`Invalid card data for ${cid}:`, result.error);
        return undefined;
      }
    } catch (error) {
      console.error(`Error reading card ${cid}:`, error);
      return undefined;
    }
  }

  async saveCard(serializedCard: SerializedCard): Promise<SerializedCard> {
    const cardFilename = await this.findCardFilename(serializedCard.cid);
    const expectedFilename = computeFilename(computeCardSlug(serializedCard), serializedCard.cid);
    const expectedExists = await fs.access(`${configuration.cardsDir}/${expectedFilename}`).then(() => true).catch(() => false);

    if (cardFilename && cardFilename !== expectedFilename) {
      if (expectedExists) {
        throw new Error(`Cannot save card, as it would rename ${cardFilename} to ${expectedFilename} while that file already exists`);
      }
      await fs.rename(`${configuration.cardsDir}/${cardFilename}`, `${configuration.cardsDir}/${expectedFilename}`);
    }

    const path = `${configuration.cardsDir}/${expectedFilename}`;
    await fs.mkdir(configuration.cardsDir, { recursive: true });
    await fs.writeFile(path, JSON.stringify({ ...serializedCard, cid: undefined }, null, 2) + '\n', 'utf-8');
    return serializedCard;
  }

  async createCard(card: SerializedCard): Promise<
      { success: true, card: SerializedCard }
    | { success: false, error: string, statusCode: number }
  > {
    // Check if card with this ID already exists
    const existingCard = await this.getCardByCid(card.cid);
    if (existingCard) {
      return { success: false, error: `Card with ID ${card.cid} already exists`, statusCode: 409 };
    }

    // Try to create a new Card instance
    try {
      new Card(card);
    } catch {
      return { success: false, error: 'Invalid card data', statusCode: 400 };
    }

    // If the new art is in the suggestions directory, we need to ensure it is moved to the art directory
    for (const face of card.faces) {
      face.art = await this.tryMoveArtSuggestionToArt(face, card.cid);
    }

    // Save the card and return the response
    const saved = await this.saveCard(card);
    return { success: true, card: saved };
  }

  async updateCard(cid: string, card: SerializedCard): Promise<
      { success: true, card: SerializedCard }
    | { success: false, error: string, statusCode: number }
  > {
    // Check if the card exists
    const existingCard = await this.getCardByCid(cid);
    if (!existingCard) {
      return { success: false, error: `Card with ID ${cid} not found`, statusCode: 404 };
    }

    // Update the card with new data
    try {
      new Card(card);
    } catch {
      return { success: false, error: 'Invalid card data', statusCode: 400 };
    }

    // Move the old art to the suggestions directory
    for (const faceIndex in existingCard.faces) {
      const existingFace = existingCard.faces[faceIndex];
      const newFace: SerializedCardFace | undefined = card.faces[faceIndex];
      if (existingFace.art && (existingFace.art !== newFace?.art) && !existingFace.art.startsWith('suggestions/')) {
        const oldArtPath = `${configuration.artDir}/${existingFace.art}`;
        const suggestionsDir = `${configuration.artDir}/suggestions`;
        try {
          await fs.mkdir(suggestionsDir, { recursive: true });
          const newArtPath = `${suggestionsDir}/${existingFace.art}`;
          await fs.rename(oldArtPath, newArtPath);
          console.log(`Moved old art from ${oldArtPath} to ${newArtPath}`);
        } catch (error) {
          console.error(`Error moving old art for card ${cid}:`, error);
        }
      }
    }

    // If the new art is in the suggestions directory, we need to ensure it is moved to the art directory
    for (const face of card.faces) {
      face.art = await this.tryMoveArtSuggestionToArt(face, card.cid);
    }

    // Save the updated card
    const saved = await this.saveCard(card);
    return { success: true, card: saved };
  }

  public async tryMoveArtSuggestionToArt(face: SerializedCardFace, cid: string): Promise<string | undefined> {
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
        console.error(`Error moving new art for card ${cid}:`, error);
      }
    }
    return face.art;
  }
}

export const cardService = new CardService();
