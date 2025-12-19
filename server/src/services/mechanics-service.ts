import fs from 'fs/promises';
import { configuration } from '../configuration';
import { parse } from 'yaml';
import { SerializableMechanics, SerializableMechanicsSchema } from 'kindred-paths';

export class MechanicsService {

  public async getMechanicsFileContent(fileName: string): Promise<Partial<SerializableMechanics>> {
    const text = await fs.readFile(`${configuration.mechanicsDir}/${fileName}`, 'utf-8');
    return SerializableMechanicsSchema.partial().parse(parse(text));
  }

  async getAllMechanics(): Promise<SerializableMechanics> {
    const mechanics: SerializableMechanics = { keywords: [] };
    const files = await fs.readdir(configuration.mechanicsDir);
    const partials = await Promise.all(files
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => this.getMechanicsFileContent(f)));

    partials.forEach(partial => {
      if (partial.keywords) {
        mechanics.keywords.push(...partial.keywords);
      }
    });
    return mechanics;
  }

}

export const mechanicsService = new MechanicsService();
