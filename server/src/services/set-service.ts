import { SerializableSetSchema, Set } from 'kindred-paths';
import fs from 'fs/promises';
import _fs from 'fs';

class SetService {
  private setDirectory = './sets';

  constructor() {
    _fs.mkdirSync(this.setDirectory, { recursive: true });
  }

  async getAll(): Promise<Set[]> {
    try {
      const files = await fs.readdir(this.setDirectory);
      return await Promise.all(files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
        .map(async (name) => {
          const data = await fs.readFile(`${this.setDirectory}/${name}.json`, 'utf-8');
          const parsed = SerializableSetSchema.parse(JSON.parse(data));
          return new Set(parsed);
        })
      );
    } catch (error) {
      console.error('Error reading set directory:', error);
      return [];
    }
  }

  async getSetByName(name: string): Promise<Set | undefined> {
    const path = `${this.setDirectory}/${name.toLowerCase()}.json`;
    try {
      const data = await fs.readFile(path);
      const parsed = SerializableSetSchema.parse(JSON.parse(data.toString()));
      return new Set(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      console.error(`Error reading set ${name}:`, error);
      return undefined;
    }
  }

  async createSet(name: string): Promise<{ success: true } | { success: false, error: unknown }> {
    const path = `${this.setDirectory}/${name.toLowerCase()}.json`;
    try {
      if (_fs.existsSync(path)) {
        return { success: false, error: `Set ${name} already exists` };
      }
    } catch (error) {
      return { success: false, error };
    }
    const set = Set.new(name);
    try {
      await fs.writeFile(path, JSON.stringify(set.toJson(), null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async updateSet(name: string, set: Set): Promise<{ success: true } | { success: false, error: unknown }> {
    const path = `${this.setDirectory}/${name.toLowerCase()}.json`;
    try {
      const existingSet = await this.getSetByName(name);
      if (existingSet) {
        if (existingSet.getId() === set.getId()) {
          // if the id matches the provided set.id, all good, save it!
          await fs.writeFile(path, JSON.stringify(set.toJson(), null, 2), 'utf-8');
          return { success: true };
        } else {
          // if the id doesn't match, abort the save, as this might overwrite a different save
          return {
            success: false,
            error: `Cannot save set as there is a name mismatch. You're probably trying to rename a set to an already existing name`,
          };
        }
      } else {
        // As the set could not be found by name, find the set by id
        const sets = await this.getAll();
        const foundSetWithSameId = sets.filter(s => s.getId() === set.getId()).pop();
        if (foundSetWithSameId) {
          // If the id can be found, save the set with a new name and then delete the file with old name (save first to avoid data loss)
          await fs.writeFile(path, JSON.stringify(set.toJson(), null, 2), 'utf-8');
          const oldPath = `${this.setDirectory}/${foundSetWithSameId.getName()}.json`;
          await fs.unlink(oldPath);
          return { success: true };
        } else {
          // If the set id could not be found in any set, abort the save
          return { success: false, error: 'Set cannot be saved as the set id does not belong to any set' };
        }
      }
    } catch (error) {
      return { success: false, error };
    }
  }
}

export const setService = new SetService();
