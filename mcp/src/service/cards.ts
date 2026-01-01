import fs from 'fs/promises';
import { filterCardsBasedOnSearch, SerializedCard, SerializedCardSchema } from 'kindred-paths';
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
}
