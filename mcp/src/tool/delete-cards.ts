import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { z } from 'zod';

type DeleteResult = { cid: string } & ({ success: true } | { success: false, error: string });

export function registerDeleteCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'delete_cards',
    {
      description:
        'Deletes cards by their Card IDs (cids).',
      inputSchema: {
        cids: z.array(z.string()).describe('Array of card IDs to delete'),
      },
    },
    async ({ cids }) => {
      const results = await Promise.all(
        cids.map(async (cid): Promise<DeleteResult> => {
          const card = await cardService.one(cid);

          if (!card) {
            return { cid, success: false, error: 'Card not found' };
          }

          await cardService.save(cid, {
            ...card,
            tags: {
              ...card.tags,
              deleted: true,
            },
          }, 'update');

          return { cid, success: true };
        }),
      );

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      const lines: string[] = [];

      if (succeeded.length > 0) {
        lines.push(`Deleted ${succeeded.length} card(s):\n${
          succeeded
            .map((r) => `  ✓ ${r.cid}`)
            .join('\n')
        }`);
      }

      if (failed.length > 0) {
        lines.push(`Failed to delete ${failed.length} card(s):\n${
          failed
            .map((r) => `  ✗ ${r.cid}: ${r.error}`)
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
