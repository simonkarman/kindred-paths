import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { z } from 'zod';

export function registerGetCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'get_cards',
    {
      description: 'Get cards by their IDs. Returns the full card JSON for each ID.',
      inputSchema: {
        ids: z.array(z.string()).describe('Array of card IDs to fetch'),
      },
    },
    async ({ ids }) => {
      const results = await Promise.all(
        ids.map(async (id) => {
          const card = await cardService.one(id);
          return { id, card };
        }),
      );

      const found = results.filter((r) => r.card !== null);
      const notFound = results.filter((r) => r.card === null);

      return {
        isError: found.length === 0 && notFound.length > 0,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                cards: found.map((r) => r.card),
                notFound: notFound.map((r) => r.id),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
