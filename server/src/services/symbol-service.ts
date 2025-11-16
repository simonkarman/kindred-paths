import { z } from 'zod';
import { Card } from 'kindred-paths';
import { configuration } from '../configuration';
import fsSync from 'fs';

const SetMetadataOnDiskSchema = z.object({
  author: z.string(),
  collectorNumberOffset: z.number(),
  theme: z.string(),
}).partial();

type SetMetadataOnDisk = z.infer<typeof SetMetadataOnDiskSchema>;

export type SetMetadata = {
  author: string;
  shortName: string;
  symbol?: string;
  collectorNumberOffset?: number;
  theme: string;
};

const UnknownSet = (): SetMetadata => ({
  shortName: 'SET',
  author: 'Simon Karman',
  theme: 'simple',
});

class SymbolService {
  public getSetMetadataForCard(card: Card): SetMetadata {
    // If the set tag is a 3-letter string, use that as the set for the card (enforce lowercase)
    const shortName = typeof card.tags.set === 'string' && card.tags.set.length === 3
      ? card.tags.set.toLowerCase()
      : undefined;

    // If the card does not belong to a set, return as unknown.
    const unknownSet = UnknownSet();
    if (!shortName) {
      return unknownSet;
    }

    // Find set disk metadata in content/symbols/<set>.json
    const setMetadataFileName = `${configuration.symbolDir}/${shortName}-metadata.json`;
    let setMetadataOnDisk: SetMetadataOnDisk | undefined = undefined;
    if (fsSync.existsSync(setMetadataFileName)) {
      const fileContents = fsSync.readFileSync(setMetadataFileName, 'utf-8');
      const parsed = SetMetadataOnDiskSchema.safeParse(JSON.parse(fileContents));
      if (parsed.success) {
        setMetadataOnDisk = parsed.data;
      } else {
        console.warn(`Invalid set metadata for set ${shortName}: ${parsed.error}`);
      }
    }

    // Find set icon based on rarity
    const customSymbolPath = `${configuration.symbolDir}/${shortName}-${card.rarity[0]}.svg`;
    const hasCustomSymbol = fsSync.existsSync(customSymbolPath);
    if (setMetadataOnDisk && !hasCustomSymbol) {
      console.warn(`Missing ${card.rarity[0]} set symbol for custom set ${shortName}. Expected at ${customSymbolPath}`);
    }

    // Find overriding card author
    let author = setMetadataOnDisk?.author ?? unknownSet.author;
    const authorTag = card.tags.author;
    if (authorTag && typeof authorTag === 'string' && authorTag.trim().length > 0) {
      author = authorTag;
    }

    return {
      author,
      shortName: shortName.toUpperCase(),
      symbol: hasCustomSymbol ? `custom/${shortName}` : shortName,
      collectorNumberOffset: setMetadataOnDisk?.collectorNumberOffset,
      theme: setMetadataOnDisk?.theme ?? unknownSet.theme,
    };
  }
}

export const symbolService = new SymbolService();
