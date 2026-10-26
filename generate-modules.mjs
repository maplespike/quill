#!/usr/bin/env node
// Generator script for remaining provincial modules
// Usage: node generate-modules.mjs

import fs from 'fs';
import path from 'path';
import { cwd } from 'process';

const ROOT = cwd();
const BASE = path.join(ROOT, 'packages/pipeline-core/src/ingestion');
const worktree = path.resolve(process.argv[2] || ROOT);

const modules = {
  'on-immigration': {
    table: 'on_immigration_records',
    recordType: 'oinp',
    sourceLabel: 'Ontario Immigrant Nominee Program',
    sourceUrl: 'https://data.ontario.ca/dataset/oinp-applications',
    ckanUrl: 'https://data.ontario.ca',
    sourceSystem: 'on-oinp',
    fields: [
      { col: 'stream', type: 'TEXT', desc: 'OINP stream (e.g. Employer Job Offer, PhD Graduate)' },
      { col: 'nominations_issued', type: 'INTEGER', desc: 'Number of nominations issued' },
      { col: 'year', type: 'INTEGER', desc: 'Year' },
      { col: 'quarter', type: 'INTEGER', desc: 'Quarter (1-4)' },
      { col: 'occupation', type: 'TEXT', desc: 'Occupation category' },
      { col: 'industry', type: 'TEXT', desc: 'Industry sector' },
    ],
  },
  'on-courts': {
    table: 'on_court_records',
    recordType: 'on_court',
    sourceLabel: 'Ontario Court of Justice',
    sourceUrl: 'https://data.ontario.ca/dataset/ontario-court-data',
    ckanUrl: 'https://data.ontario.ca',
    sourceSystem: 'on-courts',
    fields: [
      { col: 'court_type', type: 'TEXT', desc: 'Type of court' },
      { col: 'case_number', type: 'TEXT', desc: 'Case file number' },
      { col: 'filing_date', type: 'TEXT', desc: 'Date of filing (ISO-8601)' },
      { col: 'case_type', type: 'TEXT', desc: 'Case type (criminal, civil, family, small_claims)' },
      { col: 'location', type: 'TEXT', desc: 'City or judicial region' },
      { col: 'status', type: 'TEXT', desc: 'Case status' },
    ],
  },
  'on-education': {
    table: 'on_education_records',
    recordType: 'on_education',
    sourceLabel: 'Ontario Education (EQAO, Ministry)',
    sourceUrl: 'https://data.ontario.ca/dataset/education-data',
    ckanUrl: 'https://data.ontario.ca',
    sourceSystem: 'on-education',
    fields: [
      { col: 'category', type: 'TEXT', desc: 'Category (eqao, funding, enrollment)' },
      { col: 'school_board', type: 'TEXT', desc: 'School board name' },
      { col: 'school_name', type: 'TEXT', desc: 'School name' },
      { col: 'academic_year', type: 'TEXT', desc: 'Academic year (e.g. 2023-2024)' },
      { col: 'grade', type: 'TEXT', desc: 'Grade level' },
      { col: 'subject', type: 'TEXT', desc: 'Subject' },
      { col: 'result', type: 'TEXT', desc: 'Score or percentage result' },
      { col: 'student_count', type: 'INTEGER', desc: 'Number of students' },
      { col: 'funding_amount', type: 'REAL', desc: 'Funding amount' },
    ],
  },
  'bc-immigration': {
    table: 'bc_immigration_records',
    recordType: 'bcpnp',
    sourceLabel: 'BC Provincial Nominee Program',
    sourceUrl: 'https://catalogue.data.gov.bc.ca/dataset/bcpnp-statistics',
    ckanUrl: 'https://catalogue.data.gov.bc.ca',
    sourceSystem: 'bc-bcpnp',
    fields: [
      { col: 'stream', type: 'TEXT', desc: 'BCPNP stream (Skills Immigration, Express Entry BC)' },
      { col: 'nominations_issued', type: 'INTEGER', desc: 'Number of nominations' },
      { col: 'year', type: 'INTEGER', desc: 'Year' },
      { col: 'quarter', type: 'INTEGER', desc: 'Quarter' },
      { col: 'occupation', type: 'TEXT', desc: 'Occupation' },
      { col: 'industry', type: 'TEXT', desc: 'Industry' },
    ],
  },
  'bc-courts': {
    table: 'bc_court_records',
    recordType: 'bc_court',
    sourceLabel: 'BC Provincial Court',
    sourceUrl: 'https://catalogue.data.gov.bc.ca/dataset/bc-court-records',
    ckanUrl: 'https://catalogue.data.gov.bc.ca',
    sourceSystem: 'bc-courts',
    fields: [
      { col: 'court_type', type: 'TEXT', desc: 'Type of court' },
      { col: 'file_number', type: 'TEXT', desc: 'File number' },
      { col: 'filing_date', type: 'TEXT', desc: 'Filing date' },
      { col: 'case_type', type: 'TEXT', desc: 'Case type (criminal, civil, family, traffic)' },
      { col: 'location', type: 'TEXT', desc: 'Location/courthouse' },
      { col: 'status', type: 'TEXT', desc: 'Case status' },
    ],
  },
  'bc-education': {
    table: 'bc_education_records',
    recordType: 'bc_education',
    sourceLabel: 'BC Ministry of Education',
    sourceUrl: 'https://catalogue.data.gov.bc.ca/dataset/education-data',
    ckanUrl: 'https://catalogue.data.gov.bc.ca',
    sourceSystem: 'bc-education',
    fields: [
      { col: 'category', type: 'TEXT', desc: 'Category (fsa, graduation, funding, enrollment)' },
      { col: 'school_district', type: 'TEXT', desc: 'School district' },
      { col: 'school_name', type: 'TEXT', desc: 'School name' },
      { col: 'academic_year', type: 'TEXT', desc: 'Academic year' },
      { col: 'grade', type: 'TEXT', desc: 'Grade level' },
      { col: 'subject', type: 'TEXT', desc: 'Subject' },
      { col: 'result', type: 'TEXT', desc: 'Result score' },
      { col: 'student_count', type: 'INTEGER', desc: 'Student count' },
    ],
  },
  'ab-immigration': {
    table: 'ab_immigration_records',
    recordType: 'aaip',
    sourceLabel: 'Alberta Advantage Immigration Program',
    sourceUrl: 'https://open.alberta.ca/dataset/aaip-statistics',
    ckanUrl: 'https://open.alberta.ca',
    sourceSystem: 'ab-aaip',
    fields: [
      { col: 'stream', type: 'TEXT', desc: 'AAIP stream' },
      { col: 'nominations_issued', type: 'INTEGER', desc: 'Nominations' },
      { col: 'year', type: 'INTEGER', desc: 'Year' },
      { col: 'quarter', type: 'INTEGER', desc: 'Quarter' },
      { col: 'occupation', type: 'TEXT', desc: 'Occupation' },
      { col: 'industry', type: 'TEXT', desc: 'Industry' },
    ],
  },
  'ab-courts': {
    table: 'ab_court_records',
    recordType: 'ab_court',
    sourceLabel: 'Alberta Court of Justice',
    sourceUrl: 'https://open.alberta.ca/dataset/alberta-court-data',
    ckanUrl: 'https://open.alberta.ca',
    sourceSystem: 'ab-courts',
    fields: [
      { col: 'court_type', type: 'TEXT', desc: 'Court type' },
      { col: 'file_number', type: 'TEXT', desc: 'File number' },
      { col: 'filing_date', type: 'TEXT', desc: 'Filing date' },
      { col: 'case_type', type: 'TEXT', desc: 'Case type' },
      { col: 'location', type: 'TEXT', desc: 'Judicial centre' },
      { col: 'status', type: 'TEXT', desc: 'Status' },
    ],
  },
  'ab-education': {
    table: 'ab_education_records',
    recordType: 'ab_education',
    sourceLabel: 'Alberta Education',
    sourceUrl: 'https://open.alberta.ca/dataset/education-data',
    ckanUrl: 'https://open.alberta.ca',
    sourceSystem: 'ab-education',
    fields: [
      { col: 'category', type: 'TEXT', desc: 'Category (pat, diploma, funding, enrollment)' },
      { col: 'school_authority', type: 'TEXT', desc: 'School authority' },
      { col: 'school_name', type: 'TEXT', desc: 'School name' },
      { col: 'academic_year', type: 'TEXT', desc: 'Academic year' },
      { col: 'grade', type: 'TEXT', desc: 'Grade level' },
      { col: 'subject', type: 'TEXT', desc: 'Subject' },
      { col: 'result', type: 'TEXT', desc: 'Result' },
      { col: 'student_count', type: 'INTEGER', desc: 'Student count' },
      { col: 'funding_amount', type: 'REAL', desc: 'Funding amount' },
    ],
  },
  'qc-courts': {
    table: 'qc_court_records',
    recordType: 'qc_court',
    sourceLabel: 'Cour du Québec',
    sourceUrl: 'https://www.donneesquebec.ca/recherche/dataset/cour-quebec',
    ckanUrl: 'https://www.donneesquebec.ca',
    sourceSystem: 'qc-courts',
    fields: [
      { col: 'court_type', type: 'TEXT', desc: 'Court type (cour_du_quebec, cour_superieure, cour_municipale)' },
      { col: 'file_number', type: 'TEXT', desc: 'File number' },
      { col: 'filing_date', type: 'TEXT', desc: 'Filing date' },
      { col: 'case_type', type: 'TEXT', desc: 'Case type (criminel, civil, famille, jeunesse)' },
      { col: 'district', type: 'TEXT', desc: 'Judicial district' },
      { col: 'status', type: 'TEXT', desc: 'Status' },
    ],
  },
  'qc-education': {
    table: 'qc_education_records',
    recordType: 'qc_education',
    sourceLabel: 'Ministère de l\'Éducation du Québec',
    sourceUrl: 'https://www.donneesquebec.ca/recherche/dataset/education-quebec',
    ckanUrl: 'https://www.donneesquebec.ca',
    sourceSystem: 'qc-education',
    fields: [
      { col: 'category', type: 'TEXT', desc: 'Category (evaluation, financement, inscription)' },
      { col: 'school_board', type: 'TEXT', desc: 'School board or service centre' },
      { col: 'school_name', type: 'TEXT', desc: 'School name' },
      { col: 'academic_year', type: 'TEXT', desc: 'Academic year' },
      { col: 'grade', type: 'TEXT', desc: 'Grade level' },
      { col: 'subject', type: 'TEXT', desc: 'Subject' },
      { col: 'result', type: 'TEXT', desc: 'Result' },
      { col: 'student_count', type: 'INTEGER', desc: 'Student count' },
      { col: 'funding_amount', type: 'REAL', desc: 'Funding amount' },
    ],
  },
};

function capitalize(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/ /g, '');
}

function moduleNameToClass(name) {
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function generateTypes(moduleId, cfg) {
  const cls = moduleNameToClass(moduleId);
  return `// SPDX-License-Identifier: AGPL-3.0-only

export interface ${cls}Record {
  id: string;
  recordType: string;
${cfg.fields.map(f => `  /** ${f.desc} */\n  ${colToCamel(f.col)}: ${f.type === 'INTEGER' ? 'number | null' : f.type === 'REAL' ? 'number | null' : 'string | null'};`).join('\n')}
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface Raw${cls}Record {
${cfg.fields.map(f => `  ${f.col}?: ${f.type === 'INTEGER' || f.type === 'REAL' ? 'number' : 'string'};`).join('\n')}
  source_url?: string;
  [key: string]: unknown;
}

export interface ${cls}IngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface ${cls}IngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
`;
}

function colToCamel(col) {
  return col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function generateConstants(moduleId, cfg) {
  const cls = moduleNameToClass(moduleId);
  return `// SPDX-License-Identifier: AGPL-3.0-only

export const ${cls.toUpperCase()}_DDL = \`
-- ${cfg.sourceLabel} records
CREATE TABLE IF NOT EXISTS ${cfg.table} (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
${cfg.fields.map(f => `  ${f.col} ${f.type},`).join('\n')}
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT '${cfg.sourceSystem}',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
${cfg.fields.filter(f => f.col !== 'id').map(f => `CREATE INDEX IF NOT EXISTS idx_${cfg.table.replace('_records', '')}_${f.col} ON ${cfg.table}(${f.col});`).join('\n')}
CREATE INDEX IF NOT EXISTS idx_${cfg.table.replace('_records', '')}_ingested ON ${cfg.table}(ingested_at DESC);
\`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class ${cls}Error extends Error {
  constructor(
    message: string,
    public readonly code: string = '${cls.toUpperCase()}_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = '${cls}Error';
  }
}
`;
}

function generateFetcher(moduleId, cfg) {
  const cls = moduleNameToClass(moduleId);
  return `// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { Raw${cls}Record } from './types.js';

export async function fetch${cls}Records(
  options: { limit?: number } = {},
): Promise<{ records: Raw${cls}Record[]; errors: string[] }> {
  const records: Raw${cls}Record[] = [];
  const errors: string[] = [];
  const limit = options.limit ?? 400;

  try {
    const url = '${cfg.ckanUrl}/api/3/action/package_search?q=${cfg.sourceSystem}&rows=' + limit;
    const resp = await httpGet(url, {
      headers: { ...DEFAULT_HEADERS },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      errors.push(\`HTTP \${resp.statusCode} fetching \${url}\`);
      return { records, errors };
    }

    const data = JSON.parse(resp.body);
    const results: unknown[] = data?.result?.results ?? [];

    for (const item of results) {
      const r = item as Record<string, unknown>;
      records.push({
${cfg.fields.map(f => `        ${f.col}: String(r.${f.col} ?? r.${colToCamel(f.col)} ?? ''),`).join('\n')}
        source_url: String(r.url ?? r.source_url ?? '${cfg.sourceUrl}'),
      });
    }
  } catch (err) {
    errors.push(\`Failed to fetch ${cfg.sourceSystem}: \${(err as Error).message}\`);
  }

  return { records, errors };
}
`;
}

function generateParser(moduleId, cfg) {
  const cls = moduleNameToClass(moduleId);
  return `// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { ${cls}Record, Raw${cls}Record } from './types.js';

export async function parse${cls}Record(
  raw: Raw${cls}Record,
  options: { sourceSystem?: string; ingestedAt?: string } = {},
): Promise<${cls}Record | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? '${cfg.sourceSystem}';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
${cfg.fields.map(f => `    ${colToCamel(f.col)}: raw.${f.col},`).join('\n')}
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: '${cfg.recordType}',
${cfg.fields.map(f => `    ${colToCamel(f.col)}: raw.${f.col} ?? null,`).join('\n')}
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parse${cls}Batch(
  rawRecords: Raw${cls}Record[],
  options: { sourceSystem?: string; ingestedAt?: string } = {},
): Promise<${cls}Record[]> {
  const results: ${cls}Record[] = [];
  for (const raw of rawRecords) {
    const parsed = await parse${cls}Record(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
`;
}

function generateIndex(moduleId, cfg) {
  const cls = moduleNameToClass(moduleId);
  return `// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetch${cls}Records,
} from './fetcher.js';
import {
  parse${cls}Record,
  parse${cls}Batch,
} from './parser.js';
import {
  ${cls.toUpperCase()}_DDL,
  DEFAULT_MAX_RECORDS,
  ${cls}Error,
} from './constants.js';
import type {
  ${cls}Record,
  ${cls}IngestionOptions,
  ${cls}IngestionResult,
  Raw${cls}Record,
} from './types.js';

export {
  fetch${cls}Records,
} from './fetcher.js';

export {
  parse${cls}Record,
  parse${cls}Batch,
} from './parser.js';

export {
  ${cls.toUpperCase()}_DDL,
  DEFAULT_MAX_RECORDS,
  ${cls}Error,
} from './constants.js';

export type {
  ${cls}Record,
  ${cls}IngestionOptions,
  ${cls}IngestionResult,
  Raw${cls}Record,
} from './types.js';

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

export async function initialize${cls}Table(db: D1Database): Promise<void> {
  await db.exec(${cls.toUpperCase()}_DDL);
}

async function upsert${cls}Record(
  db: D1Database,
  record: ${cls}Record,
): Promise<boolean> {
  const fields = ['id', 'record_type'${cfg.fields.map(f => `, '${f.col}'`).join('')}];
  const placeholders = fields.map(() => '?').join(', ');
  const values = [record.id, record.recordType${cfg.fields.map(f => `, record.${colToCamel(f.col)}`).join('')}];

  const stmt = db.prepare(\`
    INSERT OR IGNORE INTO ${cfg.table}
      (\${fields.join(', ')})
    VALUES (\${placeholders})
  \`).bind(...values);

  const result = await stmt.run();
  return result.success;
}

export async function search${cls}Records(
  db: D1Database,
  query: string,
  options: { limit?: number } = {},
): Promise<${cls}Record[]> {
  let sql = \`SELECT * FROM ${cfg.table} WHERE 1=1\`;
  const params: unknown[] = [];

  if (query) {
    sql += \` AND (\${['record_type'${cfg.fields.filter(f => ['TEXT'].includes(f.type)).map(f => `, '${f.col}'`).join('')}].map(f => f + ' LIKE ?').join(' OR ')})\`;
    const q = \`%\${query}%\`;
    for (let i = 0; i < ${1 + cfg.fields.filter(f => f.type === 'TEXT').length}; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<${cls}Record>();
  return result.results ?? [];
}

export async function ingest${cls}Data(
  db: D1Database | null,
  options: ${cls}IngestionOptions = {},
): Promise<${cls}IngestionResult> {
  const startTime = Date.now();
  const result: ${cls}IngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['${cfg.recordType}'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[${cls}] Initializing table...');
      await initialize${cls}Table(db);
    }

    log('[${cls}] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetch${cls}Records({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log(\`[${cls}] Found \${rawRecords.length} raw records\`);

    const parsed = await parse${cls}Batch(rawRecords, { sourceSystem: '${cfg.sourceSystem}' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['${cfg.recordType}'].recordsFound++;
      if (db) {
        const inserted = await upsert${cls}Record(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['${cfg.recordType}'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = \`${cls} ingestion failed: \${(err as Error).message}\`;
    result.errors.push(msg);
    log(\`[${cls}] \${msg}\`);
  }

  result.durationMs = Date.now() - startTime;
  log(\`[${cls}] Done: \${result.recordsFound} found, \${result.recordsIngested} ingested, \${result.newRecords} new in \${result.durationMs}ms\`);
  return result;
}
`;
}

const fs_ops = [];

for (const [moduleId, cfg] of Object.entries(modules)) {
  const dir = path.join(BASE, moduleId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const files = {
    'types.ts': generateTypes(moduleId, cfg),
    'constants.ts': generateConstants(moduleId, cfg),
    'fetcher.ts': generateFetcher(moduleId, cfg),
    'parser.ts': generateParser(moduleId, cfg),
    'index.ts': generateIndex(moduleId, cfg),
  };

  for (const [fname, content] of Object.entries(files)) {
    const fpath = path.join(dir, fname);
    const existing = fs.existsSync(fpath);
    if (existing && fs.statSync(fpath).size > 50) {
      console.log(`SKIP ${moduleId}/${fname} (already exists)`);
    } else {
      fs.writeFileSync(fpath, content);
      console.log(`CREATE ${moduleId}/${fname} (${content.split('\n').length} lines)`);
    }
  }
}

// Also generate bc-health/index.ts and ab-health/index.ts
const healthIndexFiles = {
  'bc-health': bcHealthIndex,
  'ab-health': abHealthIndex,
};

for (const [moduleId, content] of Object.entries(healthIndexFiles)) {
  const fpath = path.join(BASE, moduleId, 'index.ts');
  if (!fs.existsSync(fpath) || fs.statSync(fpath).size < 50) {
    fs.writeFileSync(fpath, content);
    console.log(`CREATE ${moduleId}/index.ts (${content.split('\n').length} lines)`);
  } else {
    console.log(`SKIP ${moduleId}/index.ts (already exists)`);
  }
}
