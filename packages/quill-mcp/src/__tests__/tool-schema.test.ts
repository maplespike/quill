// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllTools } from '../tools/index.js';

describe('MCP Tool Schema Validation', () => {
  const tools = getAllTools();

  it('registers at least 100 tools', () => {
    assert.ok(tools.length >= 100, `Expected >=100 tools, got ${tools.length}`);
  });

  it('every tool has a non-empty name matching /^[a-z0-9_-]+$/', () => {
    for (const t of tools) {
      const name = t.definition.name;
      assert.ok(name, 'Tool name is missing');
      assert.match(name, /^[a-z0-9_-]+$/, `Tool name "${name}" contains invalid characters`);
      assert.ok(name.length <= 64, `Tool name "${name}" is too long (>64 chars)`);
    }
  });

  it('every tool has a non-empty description', () => {
    for (const t of tools) {
      assert.ok(t.definition.description, `Tool ${t.definition.name} missing description`);
      assert.ok(t.definition.description.length > 10, `Tool ${t.definition.name} description too short`);
    }
  });

  it('every tool has a valid inputSchema with type "object"', () => {
    for (const t of tools) {
      const schema = t.definition.inputSchema;
      assert.ok(schema, `Tool ${t.definition.name} missing inputSchema`);
      assert.equal(schema.type, 'object', `Tool ${t.definition.name} inputSchema.type must be "object"`);
    }
  });

  it('inputSchema properties are valid when present', () => {
    for (const t of tools) {
      const props = t.definition.inputSchema.properties;
      if (!props) continue;
      assert.ok(typeof props === 'object', `Tool ${t.definition.name} properties must be an object`);
      for (const [key, value] of Object.entries(props)) {
        assert.ok(value && typeof value === 'object', `Tool ${t.definition.name} property "${key}" is invalid`);
        const prop = value as Record<string, unknown>;
        if (prop.type) {
          assert.ok(
            ['string', 'number', 'integer', 'boolean', 'array', 'object'].includes(prop.type as string),
            `Tool ${t.definition.name} property "${key}" has invalid type "${prop.type}"`,
          );
        }
      }
    }
  });

  it('required fields are declared in properties', () => {
    for (const t of tools) {
      const required = t.definition.inputSchema.required;
      const props = t.definition.inputSchema.properties ?? {};
      if (!required) continue;
      for (const field of required) {
        assert.ok(props[field], `Tool ${t.definition.name} requires undeclared field "${field}"`);
      }
    }
  });

  it('tool names are unique', () => {
    const names = tools.map(t => t.definition.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length, `Duplicate tool names found`);
  });

  it('every tool handler is an async function', () => {
    for (const t of tools) {
      assert.equal(typeof t.handler, 'function', `Tool ${t.definition.name} handler is not a function`);
      const isAsync = t.handler.constructor.name === 'AsyncFunction';
      assert.ok(isAsync, `Tool ${t.definition.name} handler must be async`);
    }
  });

  it('all tool handlers are exported as async functions', () => {
    for (const t of tools) {
      assert.equal(typeof t.handler, 'function', `Tool ${t.definition.name} handler is not a function`);
      const isAsync = t.handler.constructor.name === 'AsyncFunction';
      assert.ok(isAsync, `Tool ${t.definition.name} handler must be async`);
    }
  });
});
