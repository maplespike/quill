// SPDX-License-Identifier: AGPL-3.0-only
// Must be imported FIRST — before any tool imports — to intercept fetch
import { mockUpstream } from './helpers/mock-upstream.js';

// Start mocking immediately at import time, before pipeline-core loads
const mock = mockUpstream();
mock.start();

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

describe('MCP Tool Definitions', () => {
  after(() => mock.stop());

  it('all registered tools have valid definitions', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    assert.ok(tools.length >= 100, `Expected >=100 tools, got ${tools.length}`);
    for (const t of tools) {
      assert.ok(t.definition.name, 'Tool missing name');
      assert.ok(t.definition.description, `Tool ${t.definition.name} missing description`);
      assert.ok(t.definition.inputSchema, `Tool ${t.definition.name} missing inputSchema`);
      assert.equal(t.definition.inputSchema.type, 'object');
      assert.equal(typeof t.handler, 'function');
    }
  });

  it('tool names are unique', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const names = getAllTools().map(t => t.definition.name);
    assert.equal(new Set(names).size, names.length, 'Duplicate tool names');
  });

  it('all tools return ToolResponse on empty query (never throw)', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    for (const t of tools) {
      const result = await t.handler({ query: '' });
      assert.ok(result, `${t.definition.name}: returned null/undefined`);
      assert.ok(result.content, `${t.definition.name}: missing content`);
    }
  });

  it('all tools return ToolResponse on real query (never throw)', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    for (const t of tools) {
      const result = await t.handler({ query: 'test' });
      assert.ok(result, `${t.definition.name}: returned null/undefined`);
      assert.ok(result.content, `${t.definition.name}: missing content`);
    }
  });

  it('bilingual descriptions present where applicable', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      if (t.definition.descriptions) {
        assert.ok(t.definition.descriptions['fr-CA'],
          `${t.definition.name} missing French description`);
      }
    }
  });
});
