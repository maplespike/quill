/**
 * docs/schemas/index.md must exist, list the real module inventory and stay in
 * sync with the generator. Deleting the index or the examples must fail.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { extractSchemas } from '../packages/pipeline-core/src/doc-generator/schema-extractor.js';
import { renderSchemaIndex, moduleOf } from './generate-schemas-index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'docs', 'schemas', 'index.md');
const PIPELINE_SRC = join(ROOT, 'packages', 'pipeline-core', 'src');

test('docs/schemas/index.md exists', () => {
  assert.ok(existsSync(INDEX), 'docs/schemas/index.md is missing — run pnpm generate:schemas-index');
});

test('schemas index lists the expected modules and tools', () => {
  const content = readFileSync(INDEX, 'utf8');

  for (const module of ['ingestion', 'verification', 'validation', 'audit', 'test-framework']) {
    assert.ok(content.includes(`\`${module}\``), `module ${module} missing from index`);
  }

  for (const tool of [
    'qa_schema',
    'resolve_entity',
    'linked_entities',
    'search_cross_reference',
    'get_citation',
    'verify_claim',
  ]) {
    assert.ok(content.includes(`\`${tool}\``), `tool ${tool} missing from index`);
  }

  for (const resource of ['quill://schemas', 'quill://schemas/{module}', 'quill://entity/{id}']) {
    assert.ok(content.includes(`\`${resource}\``), `resource ${resource} missing from index`);
  }

  assert.match(content, /schemas across \d+ modules/);
});

test('schemas index matches the generator output (drift check)', () => {
  const schemas = extractSchemas(PIPELINE_SRC);
  assert.ok(schemas.length > 0, 'extractor returned no schemas');
  assert.ok(
    schemas.some((schema) => moduleOf(schema) === 'ingestion'),
    'expected ingestion schemas',
  );

  const expected = renderSchemaIndex(schemas);
  const actual = readFileSync(INDEX, 'utf8');
  assert.equal(actual, expected, 'docs/schemas/index.md is stale — run pnpm generate:schemas-index');
});

test('extractor handles both root shapes and parses multi-field interfaces', () => {
  const root = mkdtempSync(join(tmpdir(), 'quill-schema-extract-'));
  try {
    const pkgRoot = join(root, 'pipeline-core');
    const src = join(pkgRoot, 'src', 'ingestion', 'demo');
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, 'types.ts'),
      [
        'export interface DemoRecord {',
        '  /** Primary key */',
        '  id: string;',
        '  count?: number;',
        '  nested: { a: string; b: number };',
        "  kind: 'a' | 'b';",
        '}',
        '',
      ].join('\n'),
    );

    // The `src`-prefixed scan dirs must resolve from packages/pipeline-core…
    const withPkgRoot = extractSchemas(pkgRoot);
    // …and from packages/pipeline-core/src (what quill-mcp passes).
    const withSrcRoot = extractSchemas(join(pkgRoot, 'src'));

    for (const schemas of [withPkgRoot, withSrcRoot]) {
      const demo = schemas.find((schema) => schema.name === 'DemoRecord');
      assert.ok(demo, 'DemoRecord not extracted');
      assert.equal(demo.fields.length, 4);
      assert.equal(demo.fields[0]?.name, 'id');
      assert.equal(demo.fields[0]?.description, 'Primary key');
      assert.equal(demo.fields[1]?.optional, true);
      assert.equal(demo.fields[2]?.type, '{ a: string; b: number }');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
