import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { backendUrl, CardInputSchemaArray, inputToSerializedCards } from '../configuration.js';

export function registerRenderCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'render_cards',
    {
      description:
        'Render cards (provided as id or json object) to images to see how they will appear when printed.',
      inputSchema: {
        cards: CardInputSchemaArray,
      },
    },
    async ({ cards: _cards }) => {
      const cards = await inputToSerializedCards(cardService, _cards);

      const renderResults = await Promise.all(
        cards.map(async (card, index) => {
          if ('error' in card) {
            return [
              {
                type: 'text' as const,
                text: `Error for card ID ${card.id}: ${card.error}`,
              },
            ];
          }

          const isPreview = typeof _cards[index] !== 'string';
          const baseRenderUrl = isPreview
            ? `${backendUrl}/preview`
            : `${backendUrl}/render/${card.id}`;

          return await Promise.all(
            card.faces.map(async (_, faceIndex) => {
              try {
                const res = await fetch(`${baseRenderUrl}/${faceIndex}?scale=0.15`, isPreview ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(card),
                } : {});
                if (!res.ok) {
                  return {
                    type: 'text' as const,
                    text: `Failed to render ${card.id} face ${faceIndex}: HTTP ${res.status}: ${res.statusText}`,
                  };
                }
                const arrayBuffer = await res.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                return {
                  type: 'image' as const,
                  data: base64,
                  mimeType: 'image/png',
                };
              } catch (e) {
                return {
                  type: 'text' as const,
                  text: `Failed to parse render of ${card.id} face ${faceIndex}: ${e instanceof Error ? e.message : String(e)}`,
                };
              }
            }),
          );
        }),
      );

      return {
        content: renderResults.flat(),
      };
    },
  );
}
