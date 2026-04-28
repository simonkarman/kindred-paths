import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SerializableStrategiesConfigSchema } from 'kindred-paths';
import { StrategyService } from '../service/strategy-service.js';

export function registerStrategyTools(server: McpServer) {
  const strategyService = new StrategyService();

  server.registerTool(
    'list_strategy_files',
    {
      description: 'List all strategy files in the collection. Returns each file\'s filename (used as ID in other tools), display name, and optional description.',
      inputSchema: {},
    },
    async () => {
      const files = await strategyService.list();
      if (files.length === 0) {
        return {
          content: [{ type: 'text', text: 'No strategy files found.' }],
        };
      }
      const lines = files.map(f =>
        `- ${f.filename}${f.name !== f.filename ? ` (${f.name})` : ''}${f.description ? `: ${f.description}` : ''}`,
      );
      return {
        content: [{ type: 'text', text: `Found ${files.length} strategy file(s):\n${lines.join('\n')}` }],
      };
    },
  );

  server.registerTool(
    'get_strategy_file',
    {
      description: 'Get the full contents of a strategy file, including all strategies and their filters.',
      inputSchema: {
        filename: z.string().describe('The strategy filename without extension (e.g. "shx")'),
      },
    },
    async ({ filename }) => {
      const config = await strategyService.get(filename);
      if (!config) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Strategy file "${filename}" not found or could not be parsed.` }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
      };
    },
  );

  server.registerTool(
    'save_strategy_file',
    {
      description: 'Create or fully replace a strategy file. The config must include a name and at least one strategy with at least one filter.',
      inputSchema: {
        filename: z.string().describe('The strategy filename without extension (e.g. "shx")'),
        config: SerializableStrategiesConfigSchema.describe('The full strategy config to save'),
      },
    },
    async ({ filename, config }) => {
      try {
        const saved = await strategyService.save(filename, config);
        return {
          content: [{ type: 'text', text: `Strategy file "${filename}" saved successfully with ${saved.strategies.length} strategies.` }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: 'text', text: e instanceof Error ? e.message : 'Failed to save strategy file.' }],
        };
      }
    },
  );

  server.registerTool(
    'delete_strategy_file',
    {
      description: 'Delete a strategy file from the collection.',
      inputSchema: {
        filename: z.string().describe('The strategy filename without extension (e.g. "shx")'),
      },
    },
    async ({ filename }) => {
      const success = await strategyService.delete(filename);
      return {
        isError: !success,
        content: [{ type: 'text', text: success ? `Strategy file "${filename}" deleted.` : `Strategy file "${filename}" not found.` }],
      };
    },
  );
}
