import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CardService } from '../service/card-service.js';
import { backendUrl, CardInputSchemaArray, inputToSerializedCards } from '../configuration.js';

export function registerArtGenerationTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'art_generation',
    {
      description:
        'Generate the artwork for all faces of each provided card (provided as id or json object). ' +
        'The art image is generated based on card mechanics and the \'setting\' tag which describes the prompt for the art setting. ' +
        'Prepend the setting with ! to make the card less depended on the mechanics of the card, and more on the setting tag.' +
        'The images are returned with metadata indicating the card they belong to, the face index of that card, and the filename that can be used ' +
        'as the art property for the card.',
      inputSchema: {
        cards: CardInputSchemaArray,
      },
    },
    async ({ cards: _cards }) => {
      const cards = await inputToSerializedCards(cardService, _cards);

      const renderResults = await Promise.all(
        cards.map(async (card) => {
          if ('error' in card) {
            return [
              {
                type: 'text' as const,
                text: `Error for card ID ${card.id}: ${card.error}`,
              },
            ];
          }

          return await Promise.all(
            card.faces.flatMap(async (_, faceIndex) => {
              try {
                const res = await fetch(`${backendUrl}/suggest/art/${faceIndex}?numImages=2`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(card),
                });
                if (!res.ok) {
                  return [{
                    type: 'text' as const,
                    text: `Failed to generate art for ${card.id} face ${faceIndex}: HTTP ${res.status}: ${res.statusText}`,
                  }];
                }
                const data: { fileName: string, base64Image: string }[] = await res.json();
                return data.map((d, index) => ({
                  type: 'text' as const,
                  text: `For face ${faceIndex} of the '${card.id}'-card, suggestion ${index} is: ${d.fileName}`,
                }));
              } catch (e) {
                return [{
                  type: 'text' as const,
                  text: `Failed to parse render of ${card.id} face ${faceIndex}: ${e instanceof Error ? e.message : String(e)}`,
                }];
              }
            }),
          );
        }),
      );

      return {
        content: renderResults.flat().flat(),
      };
    },
  );
}
