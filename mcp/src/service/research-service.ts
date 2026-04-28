import fs from 'fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CardFaceRef } from 'kindred-paths';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// mcp/build/ -> mcp/.cache/
const cacheDirectory = resolve(__dirname, '../.cache');

export type ResearchBucket = {
  total: number;
  refs: CardFaceRef[];
};

export type ResearchRow = {
  strategyName: string;
  strategyDescription?: string;
  buckets: ResearchBucket[];
  total: number;
};

export type Research = {
  id: string;
  strategyFilename: string;
  cardFilter: string;
  createdAt: string;
  bucketLabels: string[];
  rows: ResearchRow[];
  totalCards: number;
};

export class ResearchService {
  private filePath(id: string): string {
    if (id.includes('..') || id.includes('/')) {
      throw new Error('Invalid research ID');
    }
    return resolve(cacheDirectory, `${id}.json`);
  }

  async get(id: string): Promise<Research | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), 'utf-8');
      return JSON.parse(raw) as Research;
    } catch {
      return null;
    }
  }

  async save(research: Research): Promise<void> {
    await fs.mkdir(cacheDirectory, { recursive: true });
    await fs.writeFile(this.filePath(research.id), JSON.stringify(research, null, 2), 'utf-8');
  }
}
