import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/cards.js';
import { z } from 'zod';
import { Card } from 'kindred-paths';

export function registerExplainCardTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'explain_card',
    {
      description: 'Get a human readable explanation of a specific card by its id.',
      inputSchema: {
        id: z.string().describe('The unique identifier of the card to explain'),
      },
    },
    async ({ id }) => {
      const cards = await cardService.all();
      return {
        content: [
          {
            type: 'text',
            text: cards
              .filter(c => c.id === id)
              .map(c => new Card(c).faces.map(f => f.explain()).join('\n\n'))
              .join(''),
          },
        ],
      };
    },
  );
}
