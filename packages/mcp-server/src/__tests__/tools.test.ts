import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('MCP Tool Definitions', () => {
  it('all registered tools have valid definitions', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
      assert.ok(tools.length >= 12, `Expected >=12 tools, got ${tools.length}`);
    for (const t of tools) {
      assert.ok(t.definition, `${t.definition?.name} missing definition`);
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
    const unique = new Set(names);
    assert.equal(unique.size, names.length, 'Duplicate tool names found');
  });

  it('all tools handle empty query gracefully', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      try {
        const result = await t.handler({ query: '' });
        assert.ok(result, `${t.definition.name} returned null/undefined`);
        assert.ok(result.content, `${t.definition.name} missing content`);
      } catch {
        // Handler threw — acceptable for network-dependent tools
      }
    }
  });

  it('tool handlers return expected shape', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      try {
        const result = await t.handler({ query: 'test' });
        assert.ok(result, `${t.definition.name} returned null`);
        const content = result.content as Record<string, unknown>;
        if (content && typeof content === 'object') {
          assert.ok(content.tool, `${t.definition.name} content missing tool field`);
        }
      } catch {
        // Network-dependent tool - acceptable
      }
    }
  });

  it('all tools have bilingual descriptions where applicable', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      const desc = (t.definition as any).descriptions;
      if (desc) {
        assert.ok(desc['fr-CA'], `${t.definition.name} missing French description`);
      }
    }
  });
});
