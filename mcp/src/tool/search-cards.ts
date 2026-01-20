import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cardColors, cardLayouts, cardRarities } from 'kindred-paths';
import { CardService } from '../service/card-service.js';

const filterSchema = z
  .object({
    name: z.string().describe('card name must include'),
    layout: z.enum(cardLayouts).describe(('card layout must exactly match')),
    type: z.string().describe('card type line must include (eq. "creature", "token", "legendary", "human", etc.)'),
    rarity: z.enum(cardRarities).describe('card rarity must exactly match'),
    color: z.enum(['colorless', 'multicolor', ...cardColors])
      .describe('card must have the provide color description ("colorless", "multicolor") ' +
        'or includes the provided color (eq. "red", "blue", etc.)'),
    'color-identity': z.enum(['colorless', 'multicolor', ...cardColors])
      .describe('card must have the provide color identity description ("colorless", "multicolor") ' +
        'or includes the provided color in its identity (eq. "red", "blue", etc.)'),
    'producible-color': z.enum(['colorless', 'multicolor', ...cardColors])
      .describe('card must be able to produce the provide color description ("none", "multicolor") ' +
        'or includes the provided color in its identity (eq. "red", "blue", etc.)'),
    manavalue: z.string().regex(/\n+[+-]?/).describe('Matches if the card mana value meets this requirement (eq. "3", "2+", "12-", etc.)'),
    pt: z.string().describe('Matches if the card power/toughness meets this requirement '
        + '(eq. "yes", "no", "1/1", "2/4", "1+/5-", "/3", "5/", "n/n", "n+/n", "n/n-", "n+1/n", etc.)'),
    rules: z.string().describe('card rules text must include'),
    reminder: z.string().describe('card reminder text must include'),
    flavor: z.string().describe('card flavor text must include'),
    deck: z.string().describe('card must be included in the deck with this name'),
    set: z.string().describe('card set code must exactly match'),
    tag: z.string()
      .describe('card must have this tag (eq. "set", etc.) or have this tag whose value contains something (eq. "set=BLT", "deck/main=2", etc.)'),
  }).partial().optional();

type Filter = z.infer<typeof filterSchema>;

const filterToString = (filter: Filter | undefined): string => {
  if (!filter) return '';
  const parts: string[] = [];
  Object.keys(filter).forEach((_key: string) => {
    const key = _key as keyof Filter;
    if (filter[key] === undefined) return;

    if (key === 'name') {
      parts.push(filter.name ?? '');
    } else {
      parts.push(`${key}=${filter[key]}`);
    }
  });
  return parts.join(' ');
};

export function registerSearchCardsTool(server: McpServer) {
  const cardService = new CardService();

  server.registerTool(
    'search_cards',
    {
      description: 'Get cards from the collection. All filters are optional and combined with AND logic. No spaces can be used in any of the values.',
      inputSchema: {
        filter: filterSchema,
      },
    },
    async ({ filter }) => {
      const cards = await cardService.all(filterToString(filter));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(cards),
          },
        ],
      };
    },
  );
}
