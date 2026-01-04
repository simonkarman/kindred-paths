import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { SerializedCardSchema } from 'kindred-paths';

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
