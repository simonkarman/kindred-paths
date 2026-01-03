import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { z } from 'zod';

type DeleteResult = { id: string } & ({ success: true, computedId: string } | { success: false, error: string });

export function registerDeleteCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'delete_cards',
    {
      description:
        'Deletes cards by their ids.',
      inputSchema: {
        ids: z.array(z.string()).describe('Array of card ids to delete'),
      },
    },
    async ({ ids }) => {
      const results = await Promise.all(
        ids.map(async (id): Promise<DeleteResult> => {
          const card = await cardService.one(id);

          if (!card) {
            return { id, success: false, error: 'Card not found' };
          }

          const computedId = await cardService.save({
            ...card,
            tags: {
              ...card.tags,
              deleted: true,
            },
          }, 'update');

          return { id, success: true, computedId };
        }),
      );

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      const lines: string[] = [];

      if (succeeded.length > 0) {
        lines.push(`Deleted ${succeeded.length} card(s):\n${
          succeeded
            .map((r) => `  ✓ ${r.computedId}${r.id === r.computedId ? '' : ` (was ${r.id})`}`)
            .join('\n')
        }`);
      }

      if (failed.length > 0) {
        lines.push(`Failed to delete ${failed.length} card(s):\n${
          failed
            .map((r) => `  ✗ ${r.id}: ${r.error}`)
            .join('\n')
        }`);
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
