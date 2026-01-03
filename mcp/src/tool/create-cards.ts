import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { z } from 'zod';
import { Card, SerializedCardSchema } from 'kindred-paths';

export function registerCreateCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'create_cards',
    {
      description:
        'Create new cards in the collection. Accepts an array of card JSON objects. A placeholder card ID is must be provided. ' +
        'The card ID will be computed automatically on save.',
      inputSchema: {
        cards: z
          .array(SerializedCardSchema)
          .describe('Array of card JSON objects to create'),
      },
    },
    async ({ cards }) => {
      const results = await Promise.all(
        cards.map(async (_input) => {
          const input = { ..._input, tags: { ...Card.defaultTags(), ..._input.tags } };
          const name = input.faces[0].name;

          try {
            new Card(input);
          } catch (e) {
            return {
              name,
              success: false,
              error: `Invalid card data: ${e instanceof Error ? e.message : String(e)}`,
            };
          }

          const id = await cardService.save(input);
          return { id, name, success: true };
        }),
      );

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      const lines: string[] = [];

      if (succeeded.length > 0) {
        lines.push(
          `Created ${succeeded.length} card(s):\n${succeeded.map((r) => `  ✓ ${r.name} (${r.id})`).join('\n')}`,
        );
      }

      if (failed.length > 0) {
        lines.push(
          `Failed to create ${failed.length} card(s):\n${failed.map((r) => `  ✗ ${r.name}: ${r.error}`).join('\n')}`,
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
