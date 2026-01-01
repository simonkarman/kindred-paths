import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerGetCardsTool } from './tool/get-cards.js';
import { registerExplainCardTool } from './tool/explain-card.js';

const server = new McpServer({
  name: 'kindred-paths',
  version: '0.0.1',
  websiteUrl: 'https://github.com/simonkarman/kindred-paths',
  description: 'A tool for managing a collection of custom Magic the Gathering cards',
});

registerGetCardsTool(server);
registerExplainCardTool(server);

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
