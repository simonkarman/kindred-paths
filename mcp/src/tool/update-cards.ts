import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { z } from 'zod';
import { Card, SerializedCardSchema, SerializedCardFaceSchema } from 'kindred-paths';

const PartialSerializedCardUpdateSchema = z.object({
  id: z.string().describe('ID of the card to update'),
  changes: z.object({
    tags: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']).optional(),
    collectorNumber: z.number().optional(),
    layout: z.enum(['normal', 'modal', 'adventure', 'transform']).optional(),
    isToken: z.literal(true).optional(),
    primaryFace: SerializedCardFaceSchema.partial().optional(),
    secondaryFace: SerializedCardFaceSchema.partial().optional(),
  }).describe('Partial changes to apply. Use primaryFace/secondaryFace to update individual face properties.'),
});

const cardUpdateSchema = z.union([
  SerializedCardSchema.describe('Full card replacement'),
  PartialSerializedCardUpdateSchema.describe('Partial update with id + changes'),
]);

export function registerUpdateCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'update_cards',
    {
      description:
        'Update existing cards in the collection. Accepts an array of either: ' +
        '(1) full card JSON objects for complete replacement, or ' +
        '(2) { id, changes } objects for partial updates. Partial updates support tags, rarity, collectorNumber, layout, isToken, primaryFace, and ' +
             'secondaryFace. Face changes are shallow merged - each field provided replaces the existing value entirely.',
      inputSchema: {
        cards: z.array(cardUpdateSchema).describe('Array of card updates'),
      },
    },
    async ({ cards }) => {
      const results = await Promise.all(
        cards.map(async (input) => {
          const isPartialUpdate = 'changes' in input;
          const id = input.id;

          const existing = await cardService.one(id);
          if (!existing) {
            return { id, success: false, error: 'Card not found' };
          }

          let updatedCard: typeof existing;

          if (isPartialUpdate) {
            const { changes } = input;

            // Start with existing card
            updatedCard = { ...existing };

            // Apply simple field changes
            if (changes.rarity) updatedCard.rarity = changes.rarity;
            if (changes.collectorNumber) updatedCard.collectorNumber = changes.collectorNumber;
            if (changes.layout) updatedCard.layout = changes.layout;
            if (changes.isToken) updatedCard.isToken = changes.isToken;

            // Merge tags
            if (changes.tags) {
              updatedCard.tags = { ...existing.tags };
              for (const [key, value] of Object.entries(changes.tags)) {
                if (value === null) {
                  delete updatedCard.tags[key];
                } else {
                  updatedCard.tags[key] = value;
                }
              }
            }

            // Apply primary face changes
            if (changes.primaryFace) {
              updatedCard.faces = [
                { ...existing.faces[0], ...changes.primaryFace },
                ...existing.faces.slice(1),
              ];
            }

            // Apply secondary face changes
            if (changes.secondaryFace) {
              if (!existing.faces[1]) {
                return {
                  id,
                  success: false,
                  error: 'Card has no secondary face to update. To add a secondary face, provide a full card JSON with the desired layout.',
                };
              }
              updatedCard.faces = [
                updatedCard.faces[0],
                { ...existing.faces[1], ...changes.secondaryFace },
              ];
            }
          } else {
            updatedCard = input;
          }

          const name = updatedCard.faces[0].name;

          try {
            new Card(updatedCard);
          } catch (e) {
            return {
              id,
              success: false,
              error: `Invalid card data: ${e instanceof Error ? e.message : String(e)}`,
            };
          }

          const newId = await cardService.save(updatedCard, 'update');
          return { id, newId, name, success: true };
        }),
      );

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      const lines: string[] = [];

      if (succeeded.length > 0) {
        lines.push(
          `Updated ${succeeded.length} card(s):\n${succeeded
            .map((r) => {
              if (r.id !== r.newId) {
                return `  ✓ ${r.name} (${r.id} → ${r.newId})`;
              }
              return `  ✓ ${r.name} (${r.id})`;
            })
            .join('\n')}`,
        );
      }

      if (failed.length > 0) {
        lines.push(
          `Failed to update ${failed.length} card(s):\n${failed.map((r) => `  ✗ ${r.id}: ${r.error}`).join('\n')}`,
        );
      }

      return {
        isError: failed.length > 0 && succeeded.length === 0,
        content: [
          {
            type: 'text',
            text: lines.join('\n\n'),
          },
        ],
      };
    },
  );
}
