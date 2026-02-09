import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerGetCardsTool } from './tool/get-cards.js';
import { registerSearchCardsTool } from './tool/search-cards.js';
import { registerVerifyCardsTool } from './tool/verify-cards.js';
import { registerCreateCardsTool } from './tool/create-cards.js';
import { registerDeleteCardsTool } from './tool/delete-cards.js';
import { registerUpdateCardsTool } from './tool/update-cards.js';
import { registerRenderCardsTool } from './tool/render-cards.js';
import { registerGetNextCollectorNumberTool } from './tool/get-next-collector-number.js';
import { registerArtGenerationTool } from './tool/art-generation.js';
import { registerDesignDocumentTools } from './tool/design-documents.js';

const server = new McpServer({
  name: 'kindred-paths',
  version: '0.0.1',
  websiteUrl: 'https://github.com/simonkarman/kindred-paths',
  description: 'A tool for managing a collection of custom Magic the Gathering cards',
});

registerGetCardsTool(server);
registerSearchCardsTool(server);
registerVerifyCardsTool(server);
registerCreateCardsTool(server);
registerDeleteCardsTool(server);
registerUpdateCardsTool(server);
registerRenderCardsTool(server);
registerGetNextCollectorNumberTool(server);
registerArtGenerationTool(server);
registerDesignDocumentTools(server);

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
