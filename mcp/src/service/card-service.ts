import fs from 'fs/promises';
import { computeCardId, filterCardsBasedOnSearch, SerializedCard, SerializedCardSchema } from 'kindred-paths';
import { collectionDirectory } from '../configuration.js';
import { resolve } from 'node:path';

export class CardService {
  private readonly dir: string = resolve(collectionDirectory, 'cards');

  async all(filter?: string): Promise<SerializedCard[]> {
    const cards = (await Promise.all(
      (await fs.readdir(this.dir))
        .filter(file => file.endsWith('.json'))
        .map(async filename => {
          try {
            const id = filename.substring(0, filename.length - '.json'.length);
            const content = await fs.readFile(`${this.dir}/${filename}`, 'utf-8');
            return SerializedCardSchema.parse({ ...JSON.parse(content), id });
          } catch (e) {
            console.error(`Error reading or parsing card file ${filename}:`, e);
            return null;
          }
        }),
    )).filter((card): card is SerializedCard => card !== null && card?.tags?.deleted !== true);
    return filter ? filterCardsBasedOnSearch(cards, filter) : cards;
  }

  async one(id: string): Promise<SerializedCard | null> {
    try {
      const content = await fs.readFile(`${this.dir}/${id}.json`, 'utf-8');
      return SerializedCardSchema.parse({ ...JSON.parse(content), id });
    } catch (e) {
      console.error(`Error reading or parsing card file ${id}.json:`, e);
      return null;
    }
  }

  async save(card: SerializedCard, mode: 'create' | 'update' = 'create'): Promise<string> {
    const { id, ...data } = card;
    const computedId = computeCardId(card);

    // If updating...
    if (mode === 'update') {
      // and the id has changed, delete the old file
      if (id !== computedId) {
        await fs.unlink(`${this.dir}/${id}.json`).catch(() => { /* ignore errors if files does not exist */
        });
      }
    }

    // If creating...
    if (mode === 'create') {
      // and the file already exists, throw an error
      let fileExists = false;
      try {
        await fs.access(`${this.dir}/${computedId}.json`);
        fileExists = true;
      } catch { /* file does not exist */ }
      if (fileExists) {
        throw new Error(`Card with id ${computedId} already exists`);
      }
    }

    // Write to the file
    const content = JSON.stringify(data, null, 2) + '\n';
    await fs.writeFile(`${this.dir}/${computedId}.json`, content, 'utf-8');
    return computedId;
  }
}
