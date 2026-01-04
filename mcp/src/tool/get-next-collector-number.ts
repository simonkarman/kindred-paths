import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { z } from 'zod';

export function registerGetNextCollectorNumberTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'get_next_collector_number',
    {
      description:
        'Find available collector numbers for a set. Returns the first N unused collector numbers, starting from 1.',
      inputSchema: {
        setCode: z
          .string()
          .optional()
          .describe('Set code to filter by (case insensitive). If not provided, checks all cards.'),
        count: z
          .number()
          .min(1)
          .optional()
          .describe('Number of available collector numbers to return. Defaults to 1.'),
      },
    },
    async ({ setCode, count = 1 }) => {
      const allCards = await cardService.all();

      const cards = setCode
        ? allCards.filter(
          (c) => c.tags?.set?.toString().toLowerCase() === setCode.toLowerCase(),
        )
        : allCards;

      const usedNumbers = new Set(cards.map((c) => c.collectorNumber));

      const availableNumbers: number[] = [];
      let candidate = 1;

      while (availableNumbers.length < count) {
        if (!usedNumbers.has(candidate)) {
          availableNumbers.push(candidate);
        }
        candidate++;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                setCode: setCode ?? null,
                availableNumbers,
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
