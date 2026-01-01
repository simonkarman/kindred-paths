import { describe, expect, it } from 'vitest';
import { main } from '../src';

describe('MCP Server', () => {
  it('should export a main function', async () => {
    expect(main).toBeDefined();
  });
});
