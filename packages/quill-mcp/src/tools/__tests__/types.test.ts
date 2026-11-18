// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MCP Server Tool Types Tests — MapleSpike MCP Server
 *
 * Tests the shared type definitions and interfaces used across all MCP tools.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Types are pure interfaces — we test shape conformance
import type { ToolDefinition, ToolResponse, ToolHandler } from '../types.js';

describe('ToolDefinition', () => {
  it('accepts minimal valid definition', () => {
    const def: ToolDefinition = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
    };
    assert.equal(def.name, 'test_tool');
    assert.equal(def.description, 'A test tool');
    assert.deepEqual(def.inputSchema, { type: 'object' });
  });

  it('accepts definition with optional descriptions map', () => {
    const def: ToolDefinition = {
      name: 'search_data',
      description: 'Search across Canadian government data sources',
      descriptions: {
        en: 'Search across Canadian government data sources',
        fr: 'Recherche dans les sources de données du gouvernement canadien',
      },
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', default: 10 },
        },
        required: ['query'],
      },
    };
    assert.ok(def.descriptions);
    assert.ok(def.descriptions.fr);
    assert.equal(def.inputSchema.required?.length, 1);
    assert.equal(def.inputSchema.required![0], 'query');
  });

  it('allows description to be set without descriptions map', () => {
    const def: ToolDefinition = {
      name: 'simple',
      description: 'Simple tool',
      inputSchema: { type: 'object' },
    };
    assert.equal(def.descriptions, undefined);
  });

  it('rejects empty inputSchema properties as undefined gracefully', () => {
    const def: ToolDefinition = {
      name: 'minimal',
      description: 'Minimal tool',
      inputSchema: { type: 'object' },
    };
    assert.equal(def.inputSchema.properties, undefined);
    assert.equal(def.inputSchema.required, undefined);
  });
});

describe('ToolResponse', () => {
  it('accepts string content (no error)', () => {
    const resp: ToolResponse = { content: 'Success result' };
    assert.equal(resp.content, 'Success result');
    assert.equal(resp.isError, undefined);
  });

  it('accepts object content', () => {
    const resp: ToolResponse = {
      content: { key: 'value', count: 42 },
    };
    assert.equal(typeof resp.content, 'object');
    assert.equal((resp.content as Record<string, unknown>).count, 42);
  });

  it('accepts array of records content', () => {
    const resp: ToolResponse = {
      content: [{ id: 1 }, { id: 2 }],
    };
    assert.ok(Array.isArray(resp.content));
    assert.equal((resp.content as Record<string, unknown>[]).length, 2);
  });

  it('accepts error response with isError flag', () => {
    const resp: ToolResponse = {
      content: { error: 'Not found', code: '404' },
      isError: true,
    };
    assert.equal(resp.isError, true);
  });

  it('accepts error response with string content', () => {
    const resp: ToolResponse = {
      content: 'An error occurred',
      isError: true,
    };
    assert.equal(resp.isError, true);
    assert.equal(typeof resp.content, 'string');
  });
});

describe('ToolHandler', () => {
  it('accepts synchronous handler', () => {
    const handler: ToolHandler = (args: Record<string, unknown>) => {
      return { content: `Handled: ${args.foo ?? 'none'}` };
    };
    const result = handler({ foo: 'bar' }) as ToolResponse;
    assert.equal(result.content, 'Handled: bar');
  });

  it('accepts async handler', async () => {
    const handler: ToolHandler = async (args: Record<string, unknown>) => {
      return { content: { input: args, ts: Date.now() } };
    };
    const result = await handler({ query: 'test' }) as ToolResponse;
    const content = result.content as Record<string, unknown>;
    assert.ok(content.input);
    assert.equal((content.input as Record<string, unknown>).query, 'test');
  });

  it('handler can return error flag', () => {
    const handler: ToolHandler = () => {
      return { content: 'Error occurred', isError: true };
    };
    const result = handler({}) as ToolResponse;
    assert.equal(result.isError, true);
  });

  it('handler receives empty args when none provided', () => {
    const handler: ToolHandler = (args) => {
      assert.equal(typeof args, 'object');
      return { content: 'ok' };
    };
    handler({});
  });
});
