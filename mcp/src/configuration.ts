import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { Card, computeCardSlug, generateCardId, SerializedCard, SerializedCardSchema } from 'kindred-paths';
import { CardService } from './service/card-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const collectionDirectory = resolve(__dirname, '../../collection');

export const CardInputSchema = z.union([
  z.string().describe('Card ID (cid) to look up for verification'),
  SerializedCardSchema.omit({ cid: true }).describe('Card json object to verify directly'),
]);

export const CardInputSchemaArray = z
  .array(CardInputSchema)
  .describe('Array of card IDs (cid strings) or card json objects to verify');

export const backendUrl = 'http://localhost:4101';

export async function inputToSerializedCards(
  cardService: CardService,
  _cards: z.infer<typeof CardInputSchemaArray>,
): Promise<(SerializedCard | { cid?: string, slug?: string; error: string })[]> {
  return await Promise.all(
    _cards.map(async (input) => {
      let card: SerializedCard;
      if (typeof input === 'string') {
        const sc = await cardService.one(input);
        if (!sc) {
          return { cid: input, error: 'Card not found' };
        }
        card = sc;
      } else {
        card = { cid: generateCardId(), ...input };
      }
      try {
        new Card(card);
      } catch (e) {
        return {
          cid: typeof input === 'string' ? card.cid : undefined,
          slug: computeCardSlug(card),
          error: `Invalid card data: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
      return card as SerializedCard;
    }),
  );
}
