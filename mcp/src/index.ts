import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerSearchCardsTool } from './tool/search-cards.js';
import { registerVerifyCardsTool } from './tool/verify-card.js';
import { registerCreateCardsTool } from './tool/create-cards.js';
import { registerDeleteCardsTool } from './tool/delete-cards.js';
import { registerUpdateCardsTool } from './tool/update-cards.js';

const server = new McpServer({
  name: 'kindred-paths',
  version: '0.0.1',
  websiteUrl: 'https://github.com/simonkarman/kindred-paths',
  description: 'A tool for managing a collection of custom Magic the Gathering cards',
});

registerSearchCardsTool(server);
registerVerifyCardsTool(server);
registerCreateCardsTool(server);
registerDeleteCardsTool(server);
registerUpdateCardsTool(server);

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
