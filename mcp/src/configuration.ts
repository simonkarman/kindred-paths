import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { Card, SerializedCard, SerializedCardSchema } from 'kindred-paths';
import { CardService } from './service/card-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const collectionDirectory = resolve(__dirname, '../../collection');

export const CardInputSchema = z.union([
  z.string().describe('Card ID to look up for verification'),
  SerializedCardSchema.describe('Card json object to verify directly'),
]);

export const CardInputSchemaArray = z
  .array(CardInputSchema)
  .describe('Array of card IDs (strings) or card json objects to verify');

export const backendUrl = 'http://localhost:4101';

export async function inputToSerializedCards(
  cardService: CardService,
  _cards: z.infer<typeof CardInputSchemaArray>,
): Promise<(SerializedCard | { id: string; error: string })[]> {
  return await Promise.all(
    _cards.map(async (input) => {
      let card: SerializedCard;
      if (typeof input === 'string') {
        const sc = await cardService.one(input);
        if (!sc) {
          return { id: input, error: 'Card not found' };
        }
        card = sc;
      } else {
        card = input;
      }
      try {
        new Card(card);
      } catch (e) {
        return {
          id: card.id,
          error: `Invalid card data: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
      return card;
    }),
  );
}
