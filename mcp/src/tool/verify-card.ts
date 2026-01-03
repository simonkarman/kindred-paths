import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { Card } from 'kindred-paths';
import { CardInputSchemaArray } from '../configuration.js';

export function registerVerifyCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'verify_cards',
    {
      description:
        'Verify that cards are valid and get human readable explanations showing how they will be interpreted. ' +
        'Accepts an array of card ids (strings) or card json objects, which can be mixed.',
      inputSchema: {
        cards: CardInputSchemaArray,
      },
    },
    async ({ cards }) => {
      const allCards = await cardService.all();

      const results = await Promise.all(
        cards.map(async (input) => {
          if (typeof input === 'string') {
            // It's an ID, look it up
            const card = allCards.find((c) => c.id === input);
            if (!card) {
              return {
                input,
                success: false,
                error: `Card not found with id: ${input}`,
              };
            }
            try {
              const explanation = new Card(card).faces
                .map((f) => f.explain())
                .join('\n\n');
              return { input, success: true, explanation };
            } catch (e) {
              return {
                input,
                success: false,
                error: `Failed to parse card: ${e instanceof Error ? e.message : String(e)}`,
              };
            }
          } else {
            // It's a card JSON, verify it directly
            try {
              const explanation = new Card(input).faces
                .map((f) => f.explain())
                .join('\n\n');
              return {
                input: input.id ?? input.faces?.[0]?.name ?? 'unnamed card',
                success: true,
                explanation,
              };
            } catch (e) {
              return {
                input: input.id ?? input.faces?.[0]?.name ?? 'unnamed card',
                success: false,
                error: `Invalid card JSON: ${e instanceof Error ? e.message : String(e)}`,
              };
            }
          }
        }),
      );

      const output = results
        .map((r) => {
          if (r.success) {
            return `✓ ${r.input}\n${r.explanation}`;
          } else {
            return `✗ ${r.input}\n${r.error}`;
          }
        })
        .join('\n\n---\n\n');

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    },
  );
}
