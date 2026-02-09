import fs from 'fs/promises';
import { collectionDirectory } from '../configuration.js';
import path, { resolve } from 'node:path';

export class FileService {
  private readonly dir: string;

  constructor(
    baseDirectoryName: string,
    private readonly extension: string,
  ) {
    this.dir = resolve(collectionDirectory, baseDirectoryName);
    if (!this.extension.startsWith('.')) {
      this.extension = `.${this.extension}`;
    }
  }

  async list(directory: string, depth = 0): Promise<string[]> {
    if (depth > 3) {
      return [];
    }

    await fs.mkdir(path.join(this.dir, directory), { recursive: true });
    const dirPath = path.join(this.dir, directory);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && entry.name.endsWith(this.extension))
      .map(entry => entry.name);

    const directories = entries.filter(entry => entry.isDirectory());
    for (const subDirectory of directories) {
      const subFiles = await this.list(path.join(directory, subDirectory.name), depth + 1);
      files.push(...subFiles.map(subFile => path.join(subDirectory.name, subFile)));
    }

    return files;
  }

  async get(set: string, filename: string): Promise<string | null> {
    if (!filename.endsWith(this.extension)) {
      throw new Error(`Filename must end with ${this.extension}`);
    }
    try {
      await fs.mkdir(path.join(this.dir, set), { recursive: true });
      const filePath = path.join(this.dir, set, filename);
      return await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      console.error(`Error reading markdown file ${filename}.md:`, e);
      return null;
    }
  }

  async save(set: string, filename: string, body: string): Promise<boolean> {
    if (!filename.endsWith(this.extension)) {
      throw new Error(`Filename must end with ${this.extension}`);
    }
    try {
      await fs.mkdir(path.join(this.dir, set), { recursive: true });
      const filePath = path.join(this.dir, set, filename);
      await fs.writeFile(filePath, body, 'utf-8');
      return true;
    } catch (e) {
      console.error(`Error writing markdown file ${filename}.md:`, e);
      return false;
    }
  }
}
