#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike Module Generator
 *
 * Scaffolds a new ingestion module with all 5 standard files:
 *   constants.ts, types.ts, fetcher.ts, parser.ts, index.ts
 *
 * Usage:
 *   node scripts/generate-module.mjs <module-name>
 *
 * Example:
 *   node scripts/generate-module.mjs my-new-module
 *   node scripts/generate-module.mjs --parent nrcan renewable
 *
 * After generation, the script prints the registry.ts entry and ingest.ts
 * pipeline mapping for manual insertion.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INGESTION_DIR = join(__dirname, '..', 'src', 'ingestion');

// ── Helpers ────────────────────────────────────────────────────────

function updateRegistry(moduleName, info) {
  const registryPath = join(INGESTION_DIR, 'registry.ts');
  if (!existsSync(registryPath)) {
    console.error(`  ⚠ Registry not found at ${registryPath}`);
    return;
  }

  const content = readFileSync(registryPath, 'utf-8');
  const entry = `  {
    name: '${info.name}',
    description: '${info.description}',
    category: '${info.category}',
    modulePath: '${info.modulePath}',
    ingestFunctions: ${JSON.stringify(info.ingestFunctions)},
    sources: ${JSON.stringify(info.sources)},
    updateFrequency: '${info.updateFrequency}',
    testCallPattern: 'runModule',
    healthCheckUrl: '${info.healthCheckUrl}',
  },`;

  const lastBracketIndex = content.lastIndexOf('];');
  if (lastBracketIndex === -1) {
    console.error('  ⚠ Could not find end of MODULE_REGISTRY array in registry.ts');
    return;
  }

  const updatedContent = content.slice(0, lastBracketIndex) + entry + '\n' + content.slice(lastBracketIndex);
  writeFileSync(registryPath, updatedContent, 'utf-8');
  console.log(`  ✓ Added ${moduleName} to registry.ts`);
}

function toPascal(kebab) {
  return kebab.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function toCamel(kebab) {
  const pascal = toPascal(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnake(kebab) {
  return kebab.replace(/-/g, '_');
}

function toUpperSnake(kebab) {
  return kebab.replace(/-/g, '_').toUpperCase();
}

function toTableName(name) {
  return `${name.replace(/-/g, '_')}_records`;
}

const CATEGORIES = [
  'government', 'corporate', 'influence', 'legal', 'oversight',
  'elections', 'provincial', 'science', 'social', 'health',
  'defence', 'education', 'environment', 'infrastructure',
  'culture', 'media', 'labour', 'indigenous', 'financial', 'rss',
];

// ── Argument parsing ───────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
MapleSpike Module Generator

Scaffolds a new ingestion module with constants.ts, types.ts, fetcher.ts, parser.ts, index.ts.

Usage:
  node scripts/generate-module.mjs <module-name> [options]

Options:
  --category <cat>       Module category (${CATEGORIES.join(', ')})
  --description <desc>   Module description (in quotes)
  --source-name <name>   Data source display name
  --source-url <url>     Data source URL
  --source-format <fmt>  Data format (CSV, JSON, RSS, HTML, XML, CKAN, REST API)
  --frequency <freq>     Update frequency (daily, weekly, monthly, quarterly, annual, continuous)
  --parent <dir>         Parent directory (for hierarchical modules like nrcan/renewable)
  --table <name>         Database table name (default: <module>_records)
  --record <name>        Record type name (default: PascalCase)
  --status               Also output registry.ts and ingest.ts snippets (default: true)
  --no-status            Skip status output
  --auto-register        Automatically add module to registry.ts
  --help                 Show this help

Interactive mode (no flags):
  Prompts for all required fields interactively.

Examples:
  node scripts/generate-module.mjs my-module --category government --description "My data module" --source-url "https://example.com"
  node scripts/generate-module.mjs --parent nrcan renewable --category environment --description "Renewable energy data"
`);
  process.exit(0);
}

const moduleName = args[0];
if (!moduleName || moduleName.startsWith('--')) {
  console.error('Error: module name required. Use --help for usage.');
  process.exit(1);
}

// ── Parse flags ────────────────────────────────────────────────────

const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--category') flags.category = args[++i];
  if (args[i] === '--description') flags.description = args[++i];
  if (args[i] === '--source-name') flags.sourceName = args[++i];
  if (args[i] === '--source-url') flags.sourceUrl = args[++i];
  if (args[i] === '--source-format') flags.sourceFormat = args[++i];
  if (args[i] === '--frequency') flags.frequency = args[++i];
  if (args[i] === '--parent') flags.parent = args[++i];
  if (args[i] === '--table') flags.table = args[++i];
  if (args[i] === '--record') flags.record = args[++i];
  if (args[i] === '--auto-register') flags.autoRegister = true;
}

// ── Derived names ──────────────────────────────────────────────────

const pascal = toPascal(moduleName);
const camel = toCamel(moduleName);
const snake = toSnake(moduleName);
const upperSnake = toUpperSnake(moduleName);
const tableName = flags.table || toTableName(snake);
const recordType = flags.record || `${pascal}Record`;
const rawRecordType = `Raw${pascal}Record`;
const optionsType = `${pascal}IngestionOptions`;
const resultType = `${pascal}IngestionResult`;
const moduleDir = flags.parent
  ? join(INGESTION_DIR, flags.parent, moduleName)
  : join(INGESTION_DIR, moduleName);

// ── Interactive prompts (if missing flags) ─────────────────────────

// We use synchronous stdin reading since this is a CLI tool
function ask(prompt, defaultVal = '') {
  const rl = awaitPrompt ? null : null; // nop, handled inline
  // Simple readline
  const buf = [];
  const s = process.stdin;
  s.resume();
  return new Promise((resolve) => {
    s.once('data', (data) => {
      const val = data.toString().trim() || defaultVal;
      resolve(val);
    });
  });
}

let awaitPrompt = false;

async function promptIfMissing(key, question, defaultVal = '') {
  if (flags[key] !== undefined) return;

  awaitPrompt = true;
  process.stdout.write(`${question}${defaultVal ? ` [${defaultVal}]` : ''}: `);
  const answer = await ask(question, defaultVal);
  flags[key] = answer || defaultVal;
}

if (flags.description === undefined) {
  awaitPrompt = true;
  process.stdout.write(`Description for "${moduleName}": `);
  const answer = await ask('');
  flags.description = answer || `${pascal} module`;
}
if (flags.category === undefined) {
  awaitPrompt = true;
  process.stdout.write(`Category (${CATEGORIES.join(', ')}): `);
  const answer = await ask('');
  if (CATEGORIES.includes(answer)) {
    flags.category = answer;
  } else {
    flags.category = 'government';
    console.log(`  Using default: government`);
  }
}
if (flags.sourceName === undefined) {
  awaitPrompt = true;
  process.stdout.write(`Source name: `);
  flags.sourceName = await ask('') || moduleName;
}
if (flags.sourceUrl === undefined) {
  awaitPrompt = true;
  process.stdout.write(`Source URL: `);
  flags.sourceUrl = await ask('') || 'https://example.com';
}
if (flags.sourceFormat === undefined) {
  awaitPrompt = true;
  process.stdout.write(`Source format (CSV, JSON, RSS, HTML, XML, CKAN, REST API): `);
  flags.sourceFormat = await ask('') || 'JSON';
}
if (flags.frequency === undefined) {
  awaitPrompt = true;
  process.stdout.write(`Update frequency (daily, weekly, monthly, quarterly, annual): `);
  flags.frequency = await ask('') || 'monthly';
}

// ── Templates ──────────────────────────────────────────────────────

const TEMPLATES = {};

TEMPLATES.constants = `/**
 * ${pascal} Constants — Quill
 *
 * Source URLs, DDL, and defaults for ingesting ${flags.description}.
 *
 * Primary source:
 *   ${flags.sourceUrl}
 */

// Types defined in types.js — no separate decision/type enums needed

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const ${upperSnake}_SOURCES = {
  HOME: '${flags.sourceUrl}',
  BASE: '${flags.sourceUrl}',
} as const;

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const ${upperSnake}_DDL = \`
-- ${flags.description}
CREATE TABLE IF NOT EXISTS ${tableName} (
  id TEXT PRIMARY KEY,

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT '${snake}-api',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(name, source_url)
);

CREATE INDEX IF NOT EXISTS idx_${snake}_name ON ${tableName}(name);
CREATE INDEX IF NOT EXISTS idx_${snake}_ingested ON ${tableName}(ingested_at DESC);
\`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class ${pascal}Error extends Error {
  constructor(
    message: string,
    public readonly code: string = '${upperSnake}_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = '${pascal}Error';
  }
}
`;

TEMPLATES.types = `/**
 * ${pascal} Types — Quill
 *
 * Strongly-typed interfaces for ${flags.description}.
 *
 * Primary source:
 *   ${flags.sourceUrl}
 */

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single ${moduleName} record.
 */
export interface ${recordType} {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Record name */
  name: string;

  /** Description */
  description: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;

  /** Catch-all for dynamic fields */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Raw ${moduleName} record from the source API. */
export interface ${rawRecordType} {
  name?: string;
  description?: string;
  sourceUrl?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface ${optionsType} {
  /** Max records to process */
  maxRecords?: number;
  /** Force re-ingest of already-ingested records */
  force?: boolean;
  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface ${resultType} {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  durationMs: number;
}
`;

TEMPLATES.fetcher = `/**
 * ${pascal} Fetcher — Quill
 *
 * Fetches ${flags.description} from the source API.
 *
 * Primary source:
 *   ${flags.sourceUrl}
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  ${upperSnake}_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { ${rawRecordType} } from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class ${pascal}FetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = '${pascal}FetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL.
 */
async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new ${pascal}FetchError(
      \`HTTP \${resp.statusCode} fetching \${url}\`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL.
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new ${pascal}FetchError(
      \`HTTP \${resp.statusCode} fetching \${url}\`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  Main Fetch Function                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch ${moduleName} records from the source API.
 *
 * @returns Raw records extracted from the source
 */
export async function fetch${pascal}Records(
  options: {
    limit?: number;
  } = {},
): Promise<{
  records: ${rawRecordType}[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  const records: ${rawRecordType}[] = [];

  try {
    const data = await fetchJson<{ results?: Array<Record<string, unknown>> }>(
      \`\${${upperSnake}_SOURCES.BASE}/api/records?limit=\${options.limit ?? 50}\`,
    );

    if (data.results) {
      for (const item of data.results) {
        records.push({
          name: String(item.name ?? ''),
          description: item.description != null ? String(item.description) : undefined,
          sourceUrl: \`\${${upperSnake}_SOURCES.BASE}/api/records\`,
          sourceSystem: '${snake}-api',
          ...item,
        });
      }
    }
  } catch (err) {
    errors.push(\`\${${upperSnake}_SOURCES.BASE} fetch failed: \${(err as Error).message}\`);
  }

  return {
    records,
    source: records.length > 0 ? '${snake}-api' : 'none',
    errors,
  };
}
`;

TEMPLATES.parser = `/**
 * ${pascal} Parser — Quill
 *
 * Normalizes raw ${moduleName} records from the source API
 * into the unified ${recordType} schema.
 */

import { computeHash } from '../../verification/hashing.js';
import type {
  ${recordType},
  ${rawRecordType},
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Raw Record → ${recordType}                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw ${moduleName} record into a normalized ${recordType}.
 *
 * @param raw - Raw record from any source
 * @param options - Parsing options
 * @returns Normalized ${recordType} or null if invalid
 */
export async function parse${pascal}Record(
  raw: ${rawRecordType},
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<${recordType} | null> {
  const name = raw.name ?? '';
  if (!name) return null;

  const description = raw.description ?? null;
  const sourceUrl = raw.sourceUrl ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'unknown';
  const now = options.ingestedAt ?? new Date().toISOString();

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    name,
    description,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    name,
    description,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw ${moduleName} records.
 *
 * @param rawRecords - Array of raw records from any source
 * @param options - Parsing options
 * @returns Array of parsed ${recordType}s (invalid records filtered out)
 */
export async function parse${pascal}Batch(
  rawRecords: ${rawRecordType}[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<${recordType}[]> {
  const results: ${recordType}[] = [];

  for (const raw of rawRecords) {
    const parsed = await parse${pascal}Record(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}
`;

TEMPLATES.index = `/**
 * ${pascal} Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for ${flags.description}.
 *
 * Pipeline:
 *   1. Fetch records from the source API
 *   2. Parse and normalize records into unified ${recordType} schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Sources:
 *   - ${flags.sourceName}: ${flags.sourceUrl}
 */

import {
  fetch${pascal}Records,
} from './fetcher.js';
import {
  parse${pascal}Record,
  parse${pascal}Batch,
} from './parser.js';
import {
  ${upperSnake}_DDL,
  ${upperSnake}_SOURCES,
  DEFAULT_MAX_RECORDS,
  ${pascal}Error,
} from './constants.js';
import type {
  ${recordType},
  ${optionsType},
  ${resultType},
  ${rawRecordType},
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetch${pascal}Records,
} from './fetcher.js';

export {
  parse${pascal}Record,
  parse${pascal}Batch,
} from './parser.js';

export {
  ${upperSnake}_DDL,
  ${upperSnake}_SOURCES,
  DEFAULT_MAX_RECORDS,
  ${pascal}Error,
} from './constants.js';

export type {
  ${recordType},
  ${optionsType},
  ${resultType},
  ${rawRecordType},
} from './types.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                               */
/* ------------------------------------------------------------------ */

/** Minimal D1Database interface matching Cloudflare D1 API. */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<{ success: boolean; error?: string }>;
  batch(stmts: D1PreparedStatement[]): Promise<{ results?: unknown[]; success: boolean }[]>;
}

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number } }>;
}

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the ${tableName} table.
 */
export async function initialize${pascal}Table(db: D1Database): Promise<void> {
  await db.exec(${upperSnake}_DDL);
}

/**
 * Insert (or ignore) a ${moduleName} record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsert${pascal}Record(
  db: D1Database,
  record: ${recordType},
): Promise<boolean> {
  const stmt = db.prepare(\`
    INSERT OR IGNORE INTO ${tableName}
      (id, name, description, source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?)
  \`).bind(
    record.id,
    record.name,
    record.description,
    record.sourceUrl,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists.
 */
export async function ${camel}RecordExists(
  db: D1Database,
  record: ${recordType},
): Promise<boolean> {
  const row = await db.prepare(
    \`SELECT 1 FROM ${tableName}
     WHERE name = ? AND source_url = ?
     LIMIT 1\`,
  ).bind(
    record.name,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Check if the ${tableName} table exists.
 */
export async function ${camel}TableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      \`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'\`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the ${tableName} table.
 */
export async function getLatest${pascal}IngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM ${tableName} ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search ${moduleName} records by keyword.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param options - Search options (limit)
 * @returns Matching ${recordType} array
 */
export async function search${pascal}Records(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
  } = {},
): Promise<${recordType}[]> {
  let sql = \`SELECT * FROM ${tableName} WHERE 1=1\`;
  const params: unknown[] = [];

  if (query) {
    sql += \` AND (
      name LIKE ? OR
      description LIKE ?
    )\`;
    const q = \`%\${query}%\`;
    params.push(q, q);
  }

  sql += ' ORDER BY name ASC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<${recordType}>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest ${moduleName} records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch records from source API
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingest${pascal}Records(
  db: D1Database | null,
  options: ${optionsType} = {},
): Promise<${resultType}> {
  const startTime = Date.now();
  const result: ${resultType} = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[${upperSnake}] Initializing ${tableName} table...');
      await initialize${pascal}Table(db);
    }

    // Phase 1: Fetch from source
    log('[${upperSnake}] Fetching records from source...');
    try {
      const { records: rawRecords, errors: fetchErrors } = await fetch${pascal}Records({
        limit: maxRecords,
      });

      result.errors.push(...fetchErrors);
      log(\`[${upperSnake}] Found \${rawRecords.length} raw records\`);

      // Phase 2-4: Parse and persist
      const records = await parse${pascal}Batch(rawRecords, {
        sourceSystem: '${snake}-api',
      });

      for (const record of records) {
        result.recordsFound++;

        // Persist to database
        if (db) {
          const inserted = await upsert${pascal}Record(db, record);
          if (inserted) {
            result.newRecords++;
          }
          result.recordsIngested++;
        }
      }
    } catch (err) {
      const msg = \`${pascal} fetch/parse failed: \${(err as Error).message}\`;
      result.errors.push(msg);
      log(\`[${upperSnake}] \${msg}\`);
    }
  } catch (err) {
    const msg = \`${pascal} ingestion failed: \${(err as Error).message}\`;
    result.errors.push(msg);
    log(\`[${upperSnake}] \${msg}\`);
  }

  result.durationMs = Date.now() - startTime;
  log(\`[${upperSnake}] Done: \${result.recordsFound} found, \${result.recordsIngested} ingested, \${result.newRecords} new in \${result.durationMs}ms\`);

  return result;
}
`;

// ── Write files ────────────────────────────────────────────────────

console.log(`\nGenerating module: ${moduleName}`);
console.log(`  Directory: ${moduleDir}`);
console.log(`  Pascal:    ${pascal}`);
console.log(`  Table:     ${tableName}`);
console.log(`  Category:  ${flags.category}\n`);

if (!existsSync(moduleDir)) {
  mkdirSync(moduleDir, { recursive: true });
}

const files = {
  'constants.ts': TEMPLATES.constants,
  'types.ts': TEMPLATES.types,
  'fetcher.ts': TEMPLATES.fetcher,
  'parser.ts': TEMPLATES.parser,
  'index.ts': TEMPLATES.index,
};

for (const [filename, content] of Object.entries(files)) {
  const filePath = join(moduleDir, filename);
  if (existsSync(filePath)) {
    console.log(`  ⚠ Skipping ${filename} — already exists`);
    continue;
  }
  const withHeader = content.startsWith('// SPDX-License-Identifier:')
    ? content
    : `// SPDX-License-Identifier: AGPL-3.0-only\n${content}`;
  writeFileSync(filePath, withHeader, 'utf-8');
  console.log(`  ✓ Created ${filename}`);
}

if (flags.autoRegister) {
  const registryPath = flags.parent
    ? `./${flags.parent}/${moduleName}/index.js`
    : `./${moduleName}/index.js`;

  updateRegistry(moduleName, {
    name: moduleName,
    description: flags.description,
    category: flags.category,
    modulePath: registryPath,
    ingestFunctions: [`ingest${pascal}Records`],
    sources: [{ name: flags.sourceName, format: flags.sourceFormat }],
    updateFrequency: flags.frequency,
    healthCheckUrl: flags.sourceUrl,
  });
}

// ── Registry snippet ────────────────────────────────────────────────

if (!flags['no-status']) {
  const registryPath = flags.parent
    ? `./${flags.parent}/${moduleName}/index.js`
    : `./${moduleName}/index.js`;

  console.log(`\n── Registry entry (add to src/ingestion/registry.ts) ──`);
  console.log(`  {
    name: '${moduleName}',
    description: '${flags.description}',
    category: '${flags.category}',
    modulePath: '${registryPath}',
    ingestFunctions: ['ingest${pascal}Records'],
    sources: [{ name: '${flags.sourceName}', format: '${flags.sourceFormat}' }],
    updateFrequency: '${flags.frequency}',
    testCallPattern: 'runModule',
    healthCheckUrl: '${flags.sourceUrl}',
  },`);

  console.log(`\n── Pipeline mapping (add to src/cli/ingest.ts PIPELINE_CONFIG) ──`);
  const pipelineKey = moduleName.replace(/_/g, '-');
  console.log(`  '${pipelineKey}': '${moduleName}',`);

  console.log(`\n── MCP tool reference (add to packages/quill-mcp/src/tools/) ──`);
  console.log(`  import { search${pascal}Records } from '@maplespike/pipeline-core';`);
  console.log(`  Tool name: search_${snake}`);
  console.log(`  Function:  search${pascal}Records(db, query, options)`);

  console.log(`\n── Test file (add to ${moduleDir}/__tests__/) ──`);
  console.log(`  Create ${moduleDir}/__tests__/${moduleName}.test.ts`);

  console.log(`\nDone. Generated ${Object.keys(files).length} files in ${moduleDir}`);
}
