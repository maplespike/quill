// SPDX-License-Identifier: AGPL-3.0-only
/**
 * generate-schemas-index.mts — emit docs/schemas/index.md
 *
 * The MCP server derives its `quill://schemas` index from the same extractor
 * (packages/pipeline-core/src/doc-generator/schema-extractor.ts). This script
 * runs that extractor over the pipeline-core source and writes a browsable
 * inventory so external MCP authors can read the schemas without an MCP client.
 *
 * Usage: pnpm exec tsx scripts/generate-schemas-index.mts [--check]
 *   --check  exit 1 if docs/schemas/index.md is out of date (no write)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractSchemas,
  type ExtractedSchema,
} from '../packages/pipeline-core/src/doc-generator/schema-extractor.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PIPELINE_SRC = join(ROOT, 'packages', 'pipeline-core', 'src');
const OUTPUT = join(ROOT, 'docs', 'schemas', 'index.md');

/** MCP tools backed by the schema index and the composition hub. */
const RELATED_TOOLS: Array<{ tool: string; description: string }> = [
  { tool: 'qa_schema', description: 'Field-level schema for one module, served from the same extractor as this index.' },
  { tool: 'resolve_entity', description: 'Resolve a name to a canonical `quill://entity/{id}` URI.' },
  { tool: 'linked_entities', description: 'Per-registry evidence and connections for one entity (premium).' },
  { tool: 'search_cross_reference', description: 'Graph-backed cross-reference: resolve plus per-registry buckets in one call.' },
  { tool: 'get_citation', description: 'Fetch a claim bundle, including its SHA-256 data hash.' },
  { tool: 'verify_claim', description: 'Recompute and compare a claim hash against the bundle.' },
];

/** MCP resources that expose schemas and the composition hub. */
const RESOURCES: Array<{ uri: string; description: string }> = [
  { uri: 'quill://schemas', description: 'Module schema index: name, file, field count, required fields.' },
  { uri: 'quill://schemas/{module}', description: 'Versioned field-level schema for one module.' },
  { uri: 'quill://entity/{id}', description: 'Entity subgraph fragment for a canonical entity id.' },
  { uri: 'quill://crossref/{entityId}', description: 'Resolvable entity subgraph for federation between MCP servers.' },
  { uri: 'quill://citations/{hash}', description: 'Claim bundle for a SHA-256 hash.' },
];

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Top-level pipeline-core source directory a schema lives under. */
export function moduleOf(schema: ExtractedSchema): string {
  const [first] = schema.file.split('/');
  return first || 'root';
}

function requiredFields(schema: ExtractedSchema): string[] {
  return schema.fields.filter((field) => !field.optional).map((field) => field.name);
}

export function renderSchemaIndex(schemas: ExtractedSchema[]): string {
  const sorted = [...schemas].sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
  const modules = new Map<string, ExtractedSchema[]>();
  for (const schema of sorted) {
    const module = moduleOf(schema);
    const bucket = modules.get(module) ?? [];
    bucket.push(schema);
    modules.set(module, bucket);
  }
  const moduleNames = [...modules.keys()].sort();

  const lines: string[] = [];
  lines.push('---');
  lines.push('last-reviewed: 2026-11-09');
  lines.push('status: generated');
  lines.push('---');
  lines.push('');
  lines.push('# Module schema index');
  lines.push('');
  lines.push('> Generated from `packages/pipeline-core/src` by');
  lines.push('> `scripts/generate-schemas-index.mts`. Do not edit by hand — run the');
  lines.push('> generator instead. `pnpm test:schemas-index` fails when this file drifts.');
  lines.push('');
  lines.push('Quill versions module schemas so external MCP servers, SDK clients and');
  lines.push('local agents can validate payloads before they call a tool. The same');
  lines.push('inventory is served by the MCP server as JSON at `quill://schemas`;');
  lines.push('per-module field-level schemas are at `quill://schemas/{module}`.');
  lines.push('');
  lines.push(`**${sorted.length} schemas across ${moduleNames.length} modules.**`);
  lines.push('');
  lines.push('## Modules');
  lines.push('');
  lines.push('| Module | Schemas | Fields | Required fields | Resource |');
  lines.push('|--------|---------|--------|-----------------|----------|');
  for (const module of moduleNames) {
    const bucket = modules.get(module) ?? [];
    const fieldCount = bucket.reduce((total, schema) => total + schema.fields.length, 0);
    const requiredCount = bucket.reduce((total, schema) => total + requiredFields(schema).length, 0);
    lines.push(
      `| \`${escapeCell(module)}\` | ${bucket.length} | ${fieldCount} | ${requiredCount} | \`quill://schemas/${escapeCell(module)}\` |`,
    );
  }
  lines.push('');
  lines.push('## Schemas by module');
  for (const module of moduleNames) {
    lines.push('');
    lines.push(`### \`${module}\``);
    lines.push('');
    lines.push('| Schema | File | Fields | Required fields |');
    lines.push('|--------|------|--------|-----------------|');
    for (const schema of modules.get(module) ?? []) {
      const required = requiredFields(schema);
      lines.push(
        `| \`${escapeCell(schema.name)}\` | \`${escapeCell(schema.file)}\` | ${schema.fields.length} | ${
          required.length > 0 ? required.map((field) => `\`${escapeCell(field)}\``).join(', ') : '—'
        } |`,
      );
    }
  }
  lines.push('');
  lines.push('## Related MCP tools');
  lines.push('');
  lines.push('| Tool | Description |');
  lines.push('|------|-------------|');
  for (const { tool, description } of RELATED_TOOLS) {
    lines.push(`| \`${tool}\` | ${escapeCell(description)} |`);
  }
  lines.push('');
  lines.push('## Related MCP resources');
  lines.push('');
  lines.push('| Resource | Returns |');
  lines.push('|----------|---------|');
  for (const { uri, description } of RESOURCES) {
    lines.push(`| \`${uri}\` | ${escapeCell(description)} |`);
  }
  lines.push('');
  lines.push('## Verifying a schema payload');
  lines.push('');
  lines.push('Every claim bundle carries a SHA-256 hash of its canonical JSON. The');
  lines.push('public verification route needs no API key:');
  lines.push('');
  lines.push('```bash');
  lines.push("curl -s -X POST https://api.maplespike.ca/v1/claims/verify \\");
  lines.push("  -H 'content-type: application/json' \\");
  lines.push("  -d '{\"data\":{\"b\":2,\"a\":1},\"sha256\":\"<hash>\"}'");
  lines.push('```');
  lines.push('');
  lines.push('See `packages/sdk/examples/verify-claim.ts` for a runnable TypeScript');
  lines.push('version, and `packages/sdk/examples/crossref-agent.ts` for the federated');
  lines.push('cross-reference flow (`linked_entities` / `search_cross_reference`).');
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const schemas = extractSchemas(PIPELINE_SRC);
  const rendered = renderSchemaIndex(schemas);
  const check = process.argv.includes('--check');

  if (check) {
    let current = '';
    try {
      current = readFileSync(OUTPUT, 'utf8');
    } catch {
      current = '';
    }
    if (current !== rendered) {
      console.error('docs/schemas/index.md is out of date — run pnpm generate:schemas-index');
      process.exit(1);
    }
    console.log('docs/schemas/index.md is up to date');
    return;
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, rendered);
  console.log(`wrote ${OUTPUT} (${schemas.length} schemas)`);
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('/generate-schemas-index.mts');

if (invokedDirectly) main();
