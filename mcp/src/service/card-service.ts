import fs from 'fs/promises';
import { computeCardSlug, computeFilename, filterCardsBasedOnSearch, getCidFromFilename, SerializedCard, SerializedCardSchema } from 'kindred-paths';
import { collectionDirectory } from '../configuration.js';
import { resolve } from 'node:path';

export class CardService {
  private readonly dir: string = resolve(collectionDirectory, 'cards');

  public findCardFilename = async (cid: string): Promise<string | undefined> => {
    const files = await fs.readdir(this.dir);
    return files.find(file => getCidFromFilename(file) === cid);
  };

  async all(filter?: string): Promise<SerializedCard[]> {
    const cards = (await Promise.all(
      (await fs.readdir(this.dir))
        .map(async filename => {
          try {
            const cid = getCidFromFilename(filename);
            if (cid === null) {
              return null;
            }
            const content = await fs.readFile(`${this.dir}/${filename}`, 'utf-8');
            return SerializedCardSchema.parse({ ...JSON.parse(content), cid });
          } catch (e) {
            console.error(`Error reading or parsing card file ${filename}:`, e);
            return null;
          }
        }),
    )).filter((card): card is SerializedCard => card !== null && card?.tags?.deleted !== true);
    return filter ? filterCardsBasedOnSearch(cards, filter) : cards;
  }

  async one(cid: string): Promise<SerializedCard | null> {
    const filename = await this.findCardFilename(cid);
    if (!filename) {
      return null;
    }
    try {
      const content = await fs.readFile(`${this.dir}/${filename}`, 'utf-8');
      return SerializedCardSchema.parse({ ...JSON.parse(content), cid });
    } catch (e) {
      console.error(`Error reading or parsing card file ${filename}:`, e);
      return null;
    }
  }

  async save(cid: string, card: Omit<SerializedCard, 'cid'>, mode: 'create' | 'update' = 'create'): Promise<void> {
    const existingFilename = await this.findCardFilename(cid);
    const expectedFilename = computeFilename(computeCardSlug({ ...card, cid }), cid);

    // If updating...
    if (mode === 'update') {
      // and the filename has changed, delete the old file
      if (existingFilename !== expectedFilename) {
        await fs.unlink(`${this.dir}/${existingFilename}`).catch(() => { /* ignore errors if files does not exist */ });
      }
    }

    // If creating...
    if (mode === 'create') {
      // and the file already exists, throw an error
      const fileExists = existingFilename !== undefined;
      if (fileExists) {
        throw new Error(`Card with ID ${existingFilename} already exists`);
      }
    }

    // Write to the file
    const content = JSON.stringify({ ...card, cid: undefined }, null, 2) + '\n';
    await fs.writeFile(`${this.dir}/${expectedFilename}`, content, 'utf-8');
  }
}
