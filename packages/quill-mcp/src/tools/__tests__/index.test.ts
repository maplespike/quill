/**
 * MCP Server Tool Registry Tests — MapleSpike MCP Server
 *
 * Tests the tool registry module: getAllTools(), getToolNames(),
 * and the ToolModule interface contract.
 *
 * NOTE: Full tool definition validation (name, description, schema)
 * and handler contract tests live in quill-mcp.test.ts.
 * This file tests the registry module's own logic and edge cases.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllTools, getToolNames } from '../index.js';
import { handler as verifyClaimHandler } from '../verify-claim.js';
import { handler as getCitationHandler, registerCitation } from '../get-citation.js';
import { citationStore } from '@maplespike/pipeline-core';
import type { ToolModule } from '../index.js';

describe('getAllTools', () => {
  it('returns an array', () => {
    const tools = getAllTools();
    assert.ok(Array.isArray(tools));
  });

  it('every element has definition and handler', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      assert.ok(mod, 'Module should be truthy');
      assert.ok('definition' in mod, `Module missing definition: ${JSON.stringify(Object.keys(mod))}`);
      assert.ok('handler' in mod, `Module missing handler`);
    }
  });

  it('every definition has a non-empty name', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      assert.ok(mod.definition.name, `Tool has empty name`);
      assert.ok(mod.definition.name.length > 0, `Tool has empty name string`);
    }
  });

  it('every definition has a non-empty description', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      assert.ok(mod.definition.description, `${mod.definition.name} has empty description`);
      assert.ok(mod.definition.description.length > 0, `${mod.definition.name} has empty description string`);
    }
  });

  it('every definition has valid inputSchema', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      const schema = mod.definition.inputSchema;
      assert.ok(schema, `${mod.definition.name} missing inputSchema`);
      assert.equal(schema.type, 'object', `${mod.definition.name} inputSchema type must be 'object'`);
    }
  });

  it('required fields in inputSchema exist in properties', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      const schema = mod.definition.inputSchema;
      if (schema.required && schema.required.length > 0) {
        assert.ok(schema.properties, `${mod.definition.name} has required fields but no properties`);
        for (const field of schema.required) {
          assert.ok(
            schema.properties?.[field],
            `${mod.definition.name}: required field '${field}' missing from properties`,
          );
        }
      }
    }
  });

  it('every handler is a function', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      assert.equal(typeof mod.handler, 'function', `${mod.definition.name} handler is not a function`);
    }
  });
});

describe('getToolNames', () => {
  it('returns an array of strings', () => {
    const names = getToolNames();
    assert.ok(Array.isArray(names));
    assert.ok(names.length > 0);
    for (const name of names) {
      assert.equal(typeof name, 'string');
    }
  });

  it('all tool names are unique', () => {
    const names = getToolNames();
    const unique = new Set(names);
    assert.equal(
      unique.size,
      names.length,
      `Found ${names.length - unique.size} duplicate tool name(s)`,
    );
  });

  it('matches getAllTools count', () => {
    const tools = getAllTools();
    const names = getToolNames();
    assert.equal(tools.length, names.length);
  });

  it('tool-index.json lists every live tool name and a 200-character description', () => {
    const indexPath = join(dirname(fileURLToPath(import.meta.url)), '../tool-index.json');
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as Array<{ n: string; d: string }>;
    const live = getAllTools().map((mod) => ({
      n: mod.definition.name,
      d: mod.definition.description.slice(0, 200),
    }));
    assert.equal(index.length, live.length);
    assert.deepEqual(index, live);
  });

  it('each name corresponds to a tool definition', () => {
    const tools = getAllTools();
    const names = getToolNames();
    const defNames = tools.map(t => t.definition.name);
    assert.deepEqual(names, defNames);
  });
});

describe('ToolModule interface shape', () => {
  it('all modules have definition.name matching expected pattern', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      const name = mod.definition.name;
      // Names should be snake_case or kebab-case alphanumeric
      assert.ok(
        /^[a-z][a-z0-9_-]*$/.test(name),
        `Tool name '${name}' does not match expected pattern`,
      );
    }
  });
});

describe('claim verification and citation tools', () => {
  it('labels hash checks as record-integrity checks, not source authentication', async () => {
    citationStore.clear();
    const hash = await registerCitation('test source', 'canonical value');
    try {
      const result = await verifyClaimHandler({ sha256: hash });
      const content = result.content as Record<string, unknown>;
      assert.equal(content.verified, true);
      assert.equal(content.retrievedAt, null);
      assert.match(String(content.message), /does not authenticate/i);
      assert.ok(content.provenanceEvidence);

      const citation = await getCitationHandler({ hash });
      const citationContent = citation.content as Record<string, unknown>;
      const detail = citationContent.citation as Record<string, unknown>;
      assert.equal(detail.source_retrieved_at, null);
      assert.ok(detail.claim_created_at);
      assert.ok(detail.provenance_evidence);
      assert.match(String(citationContent.message), /does not authenticate/i);
    } finally {
      citationStore.clear();
    }
  });
});

describe('ToolDefinition descriptions map consistency', () => {
  it('if descriptions has en, it should match description field', () => {
    const tools = getAllTools();
    for (const mod of tools) {
      const descs = mod.definition.descriptions;
      if (descs?.en) {
        assert.equal(
          descs.en,
          mod.definition.description,
          `${mod.definition.name}: descriptions.en does not match description field`,
        );
      }
    }
  });
});
