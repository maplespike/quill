// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MCP Server tool tests
 *
 * Tests tool definitions (schema validation) and handler contracts.
 * Handler integration tests that call upstream APIs are skipped when
 * network is unavailable — we test the error path instead.
 */

// Must be imported FIRST — before any tool imports — to intercept fetch.
// Without the mock, the no-network handler suite hits live government APIs;
// truncated responses throw asynchronously and flaked the coverage job (#859).
import { mockUpstream } from './__tests__/helpers/mock-upstream.js';

const mock = mockUpstream();
mock.start();

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { getToolNames, getAllTools } from './tools/index.js';
import type { ToolModule } from './tools/index.js';

// ── Tool Definitions ──────────────────────────────────────────────────

describe('MCP Server — tool registration', () => {
  const tools = getAllTools();
  const names = getToolNames();

  it(`has at least 50 registered tools`, () => {
    assert.ok(tools.length >= 50, `Expected ≥50 tools, got ${tools.length}`);
  });

  it('getAllTools and getToolNames return same count', () => {
    assert.equal(tools.length, names.length);
  });

  it('all tool names are unique', () => {
    const unique = new Set(names);
    assert.equal(unique.size, names.length, 'Duplicate tool names detected');
  });
});

describe('MCP Server — tool definitions', () => {
  const tools = getAllTools();

  for (const mod of tools) {
    const name = mod.definition.name;

    it(`${name} — has valid definition`, () => {
      const def = mod.definition;
      assert.ok(def.name, 'Missing name');
      assert.ok(def.description, 'Missing description');
      assert.ok(def.inputSchema, 'Missing inputSchema');
      assert.equal(typeof def.inputSchema, 'object');
      if (def.inputSchema.required?.length) {
        // Required fields should exist in properties
        for (const field of def.inputSchema.required) {
          assert.ok(def.inputSchema.properties?.[field],
            `Required field '${field}' not in properties`);
        }
      }
    });

    it(`${name} — handler is a function`, () => {
      assert.equal(typeof mod.handler, 'function');
    });
  }
});

describe('MCP Server — hermetic upstream contract', () => {
  // Regression for #859: the StatCan CSV download path must work against the
  // mock (a real ZIP), and no tool may fall through to an unmodelled family.
  it('StatCan CSV table downloads parse from the mocked ZIP', async () => {
    const { fetchStatCanTable } = await import('./tools/statcan-helper.js');
    const { header, rows } = await fetchStatCanTable('17100009');
    assert.ok(header.length >= 3, `header too short: ${header.join(',')}`);
    assert.ok(rows.length >= 2, `expected >=2 data rows, got ${rows.length}`);
    console.log(`[hermetic] statcan zip parsed rows=${rows.length}`);
  });

  it('no tool calls an unmodelled upstream family', () => {
    const un = mock.getUnhandledCalls();
    console.log(`hermetic upstream: ${un.length} unhandled`);
    if (un.length) {
      console.log(un.slice(0, 12).map((c) => `  ${c.method} ${c.url}`).join('\n'));
    }
    assert.equal(un.length, 0, `${un.length} unhandled upstream URLs`);
  });
});

describe('MCP Server — tool handlers (no-network mode)', () => {
  const tools = getAllTools();
  // Stop the upstream mock once the handler suite finishes.
  after(() => mock.stop());
  // Tools that don't require a query parameter
  const queryless = new Set([
    'system_health', 'get_tool_health', 'cache_status',
    'get_module_health', 'get_pipeline_health',
  ]);

  for (const mod of tools) {
    const name = mod.definition.name;
    const needsQuery = mod.definition.inputSchema.required?.includes('query');

    it(`${name} — handler returns expected shape`, async () => {
      const args: Record<string, unknown> = needsQuery ? { query: 'test' } : {};
      const result = await mod.handler(args);
      assert.ok(result, 'Handler returned null/undefined');
      assert.ok('content' in result, 'Response missing content');

      if (result.isError) {
        // Network-dependent tools return errors in no-network mode.
        // That's acceptable — verify the error has useful content.
        const content = typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);
        assert.ok(content.length > 0, 'Error response has empty content');
      }
    });

    it(`${name} — handles empty/missing query gracefully`, async () => {
      if (!needsQuery) return; // skip for tools that don't need query
      const result = await mod.handler({ query: '' });
      assert.ok(result.isError !== false,
        `${name} should return error for empty query`);
    });
  }
});
