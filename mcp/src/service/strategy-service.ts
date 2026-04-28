import fs from 'fs/promises';
import { resolve } from 'node:path';
import { SerializableStrategiesConfig, SerializableStrategiesConfigSchema } from 'kindred-paths';
import { collectionDirectory } from '../configuration.js';

export type StrategyFileMeta = {
  filename: string;
  name: string;
  description?: string;
};

export class StrategyService {
  private readonly dir: string = resolve(collectionDirectory, 'strategies');

  private filePath(filename: string): string {
    if (filename.includes('..')) {
      throw new Error('Invalid filename: directory traversal is not allowed');
    }
    return resolve(this.dir, `${filename}.json`);
  }

  async list(): Promise<StrategyFileMeta[]> {
    try {
      const files = await fs.readdir(this.dir);
      const metas = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const filename = f.slice(0, -5);
            try {
              const raw = await fs.readFile(resolve(this.dir, f), 'utf-8');
              const parsed = JSON.parse(raw);
              return {
                filename,
                name: typeof parsed.name === 'string' && parsed.name ? parsed.name : filename,
                ...(typeof parsed.description === 'string' && parsed.description
                  ? { description: parsed.description }
                  : {}),
              };
            } catch {
              return { filename, name: filename };
            }
          }),
      );
      return metas;
    } catch {
      return [];
    }
  }

  async get(filename: string): Promise<SerializableStrategiesConfig | null> {
    try {
      const raw = await fs.readFile(this.filePath(filename), 'utf-8');
      const result = SerializableStrategiesConfigSchema.safeParse(JSON.parse(raw));
      if (!result.success) {
        return null;
      }
      return result.data;
    } catch {
      return null;
    }
  }

  async save(filename: string, config: SerializableStrategiesConfig): Promise<SerializableStrategiesConfig> {
    const result = SerializableStrategiesConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid strategy config: ${result.error.message}`);
    }
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.filePath(filename), JSON.stringify(result.data, null, 2), 'utf-8');
    return result.data;
  }

  async delete(filename: string): Promise<boolean> {
    try {
      await fs.unlink(this.filePath(filename));
      return true;
    } catch {
      return false;
    }
  }
}
