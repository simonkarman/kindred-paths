import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { filterDefinitions } from 'kindred-paths';
import { CardService } from '../service/card-service.js';

// Build the filter schema dynamically from centralized filter definitions
const buildFilterSchema = () => {
  const schemaFields: Record<string, z.ZodTypeAny> = {
    name: z.string().describe('card name must include'),
  };

  filterDefinitions.forEach(def => {
    const primaryKey = def.keys[0];
    const description = def.description || '';

    if (!def.validation) {
      // No validation - just a string
      schemaFields[primaryKey] = z.string().describe(description);
    } else if (Array.isArray(def.validation)) {
      // Array validation - use enum
      const values = def.validation as string[];
      if (values.length > 0) {
        schemaFields[primaryKey] = z.enum([values[0], ...values.slice(1)] as [string, ...string[]]).describe(description);
      } else {
        schemaFields[primaryKey] = z.string().describe(description);
      }
    } else if (def.validation instanceof RegExp) {
      // Regex validation
      schemaFields[primaryKey] = z.string().regex(def.validation).describe(description);
    }
  });

  return z.object(schemaFields).partial().optional();
};

const filterSchema = buildFilterSchema();

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
