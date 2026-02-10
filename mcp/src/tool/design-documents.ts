import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FileService } from '../service/file-service.js';

export function registerDesignDocumentTools(server: McpServer) {
  const fileService = new FileService('design', '.md');

  server.registerTool(
    'list_design_documents',
    {
      description: 'Get the file names of the markdown design documents for a given set.',
      inputSchema: {
        set: z.string().describe('The three letter set code to list design documents for (example: "DKI")'),
      },
    },
    async ({ set }) => {
      const documents = await fileService.list(set);
      const isEmpty = documents.length === 0;
      return {
        isError: isEmpty,
        content: [
          {
            type: 'text',
            text: isEmpty
              ? 'No design documents found for this set'
              : `Found ${documents.length} documents:\n` + documents.map(d => `- ${d}`).join('\n'),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_design_document',
    {
      description: 'Get the markdown content of a design document by name. ' +
        'The \'overview.md\' document is a special case that will be used as the main design document for the set.',
      inputSchema: {
        set: z.string().describe('The three letter set code to get the design document from (example: "DKI")'),
        name: z.string().describe('The name of the markdown design document to fetch (example: "overview.md")'),
      },
    },
    async ({ set, name }) => {
      const content = await fileService.get(set, name);
      return {
        isError: content === null,
        content: [
          {
            type: 'text',
            text: content ?? 'Design document not found',
          },
        ],
      };
    },
  );

  server.registerTool(
    'save_design_document',
    {
      description: 'Save a markdown design document. If a document with the same name already exists, it will be overwritten.',
      inputSchema: {
        set: z.string().describe('The three letter set code to save the design document to (example: "DKI")'),
        name: z.string().describe('The name of the design document to save (example: "overview.md")'),
        content: z.string().describe('The markdown content of the design document to save'),
      },
    },
    async ({ set, name, content }) => {
      const success = await fileService.save(set, name, content);
      return {
        isError: !success,
        content: [
          {
            type: 'text',
            text: success ? 'Design document saved successfully' : 'Failed to save design document',
          },
        ],
      };
    },
  );

  server.registerTool(
    'delete_design_document',
    {
      description: 'Delete a markdown design document by name.',
      inputSchema: {
        set: z.string().describe('The three letter set code to delete the design document from (example: "DKI")'),
        name: z.string().describe('The name of the design document to delete (example: "overview.md")'),
      },
    },
    async ({ set, name }) => {
      const success = await fileService.delete(set, name);
      return {
        isError: !success,
        content: [
          {
            type: 'text',
            text: success ? 'Design document deleted successfully' : 'Failed to delete design document',
          },
        ],
      };
    },
  );

  server.registerTool(
    'move_design_document',
    {
      description: 'Move or rename a markdown design document.',
      inputSchema: {
        set: z.string().describe('The three letter set code to move the design document within (example: "DKI")'),
        oldName: z.string().describe('The current name of the design document to move (example: "overview.md")'),
        newName: z.string().describe('The new name for the design document (example: "main.md")'),
      },
    },
    async ({ set, oldName, newName }) => {
      const success = await fileService.move(set, oldName, newName);
      return {
        isError: !success,
        content: [
          {
            type: 'text',
            text: success ? 'Design document moved successfully' : 'Failed to move design document',
          },
        ],
      };
    },
  );
}
