import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'kindred-paths',
  version: '0.0.1',
  websiteUrl: 'https://github.com/simonkarman/kindred-paths',
  description: 'A tool for managing a collection of custom Magic the Gathering cards',
});

server.registerTool(
  'hello',
  {
    description: 'Say hello',
    inputSchema: {
      name: z
        .string()
        .min(5)
        .describe('Name of the user.'),
    },
  },
  async ({ name }) => {

    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${name}! Version 5!`,
        },
      ],
    };
  },
);

export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Kindred Paths MCP Server running on stdio');
}

// eslint-disable-next-line no-process-env
if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}
