#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'packages/pipeline-core/src/ingestion';

const modules = [
  ['qc-immigration','qc_immigration_records','qc_immigration','qc-mifi','https://www.donneesquebec.ca',[
    ['stream','TEXT'],['nominations_issued','INTEGER'],['year','INTEGER'],['quarter','INTEGER'],
    ['country_of_origin','TEXT'],['region','TEXT']
  ]],
  ['on-immigration','on_immigration_records','oinp','on-oinp','https://data.ontario.ca',[
    ['stream','TEXT'],['nominations_issued','INTEGER'],['year','INTEGER'],['quarter','INTEGER'],
    ['occupation','TEXT'],['industry','TEXT']
  ]],
  ['on-courts','on_court_records','on_court','on-courts','https://data.ontario.ca',[
    ['court_type','TEXT'],['case_number','TEXT'],['filing_date','TEXT'],
    ['case_type','TEXT'],['location','TEXT'],['status','TEXT']
  ]],
  ['on-education','on_education_records','on_education','on-education','https://data.ontario.ca',[
    ['category','TEXT'],['school_board','TEXT'],['school_name','TEXT'],['academic_year','TEXT'],
    ['grade','TEXT'],['subject','TEXT'],['result','TEXT'],['student_count','INTEGER'],['funding_amount','REAL']
  ]],
  ['bc-immigration','bc_immigration_records','bcpnp','bc-bcpnp','https://catalogue.data.gov.bc.ca',[
    ['stream','TEXT'],['nominations_issued','INTEGER'],['year','INTEGER'],['quarter','INTEGER'],
    ['occupation','TEXT'],['industry','TEXT']
  ]],
  ['bc-courts','bc_court_records','bc_court','bc-courts','https://catalogue.data.gov.bc.ca',[
    ['court_type','TEXT'],['file_number','TEXT'],['filing_date','TEXT'],
    ['case_type','TEXT'],['location','TEXT'],['status','TEXT']
  ]],
  ['bc-education','bc_education_records','bc_education','bc-education','https://catalogue.data.gov.bc.ca',[
    ['category','TEXT'],['school_district','TEXT'],['school_name','TEXT'],['academic_year','TEXT'],
    ['grade','TEXT'],['subject','TEXT'],['result','TEXT'],['student_count','INTEGER']
  ]],
  ['ab-immigration','ab_immigration_records','aaip','ab-aaip','https://open.alberta.ca',[
    ['stream','TEXT'],['nominations_issued','INTEGER'],['year','INTEGER'],['quarter','INTEGER'],
    ['occupation','TEXT'],['industry','TEXT']
  ]],
  ['ab-courts','ab_court_records','ab_court','ab-courts','https://open.alberta.ca',[
    ['court_type','TEXT'],['file_number','TEXT'],['filing_date','TEXT'],
    ['case_type','TEXT'],['location','TEXT'],['status','TEXT']
  ]],
  ['ab-education','ab_education_records','ab_education','ab-education','https://open.alberta.ca',[
    ['category','TEXT'],['school_authority','TEXT'],['school_name','TEXT'],['academic_year','TEXT'],
    ['grade','TEXT'],['subject','TEXT'],['result','TEXT'],['student_count','INTEGER'],['funding_amount','REAL']
  ]],
  ['qc-courts','qc_court_records','qc_court','qc-courts','https://www.donneesquebec.ca',[
    ['court_type','TEXT'],['file_number','TEXT'],['filing_date','TEXT'],
    ['case_type','TEXT'],['district','TEXT'],['status','TEXT']
  ]],
  ['qc-education','qc_education_records','qc_education','qc-education','https://www.donneesquebec.ca',[
    ['category','TEXT'],['school_board','TEXT'],['school_name','TEXT'],['academic_year','TEXT'],
    ['grade','TEXT'],['subject','TEXT'],['result','TEXT'],['student_count','INTEGER'],['funding_amount','REAL']
  ]],
];

function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function clsName(m) { return m.split('-').map(cap).join(''); }
function toCam(c) { return c.replace(/_([a-z])/g, (_,x) => x.toUpperCase()); }

for (const [mid, tbl, rtype, sys, ckan, fields] of modules) {
  const C = clsName(mid);
  const dir = path.join(BASE, mid);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sf = fields.filter(f => f[1] === 'TEXT');
  const numFields = sf.length;
  const searchCols = ['record_type', ...sf.map(f => f[0])];

  // types.ts
  let types = `// SPDX-License-Identifier: AGPL-3.0-only\n\n`;
  types += `export interface ${C}Record {\n  id: string;\n  recordType: string;\n`;
  for (const [col, typ] of fields) {
    const ts = typ === 'INTEGER' || typ === 'REAL' ? 'number | null' : 'string | null';
    types += `  ${toCam(col)}: ${ts};\n`;
  }
  types += `  sourceUrl: string;\n  sourceSystem: string;\n  ingestedAt: string;\n}\n\n`;
  types += `export interface Raw${C}Record {\n`;
  for (const [col, typ] of fields) {
    const ts = typ === 'INTEGER' || typ === 'REAL' ? 'number' : 'string';
    types += `  ${col}?: ${ts};\n`;
  }
  types += `  source_url?: string;\n  [key: string]: unknown;\n}\n\n`;
  types += `export interface ${C}IngestionOptions {\n  maxRecords?: number;\n  force?: boolean;\n  initializeTable?: boolean;\n  onProgress?: (msg: string) => void;\n}\n\n`;
  types += `export interface ${C}IngestionResult {\n  recordsFound: number;\n  recordsIngested: number;\n  newRecords: number;\n  errors: string[];\n  perType: Record<string, { recordsFound: number; recordsIngested: number }>;\n  durationMs: number;\n}\n`;

  // constants.ts
  let colDDL = '';
  for (const [col, typ] of fields) colDDL += `  ${col} ${typ},\n`;
  let idxLines = '';
  for (const [col] of fields) {
    idxLines += `CREATE INDEX IF NOT EXISTS idx_${tbl.replace('_records','')}_${col} ON ${tbl}(${col});\n`;
  }
  let constants = `// SPDX-License-Identifier: AGPL-3.0-only\n\n`;
  constants += `export const ${C.toUpperCase()}_DDL = \`\n`;
  constants += `CREATE TABLE IF NOT EXISTS ${tbl} (\n  id TEXT PRIMARY KEY,\n  record_type TEXT NOT NULL,\n${colDDL}  source_url TEXT NOT NULL,\n  source_system TEXT NOT NULL DEFAULT '${sys}',\n  ingested_at TEXT NOT NULL,\n  UNIQUE(record_type, source_url)\n);\n`;
  constants += `${idxLines}CREATE INDEX IF NOT EXISTS idx_${tbl.replace('_records','')}_ingested ON ${tbl}(ingested_at DESC);\n\`;\n\n`;
  constants += `export const DEFAULT_MAX_RECORDS = 400;\n`;
  constants += `export const DEFAULT_TIMEOUT_MS = 30_000;\n\n`;
  constants += `export class ${C}Error extends Error {\n  constructor(message: string, public readonly code: string = '${C.toUpperCase()}_ERROR', public readonly url?: string, public readonly statusCode?: number) {\n    super(message);\n    this.name = '${C}Error';\n  }\n}\n`;

  // fetcher.ts
  let fetcherFields = '';
  for (const [col] of fields) {
    fetcherFields += `          ${col}: String(r.${col} ?? r.${toCam(col)} ?? ''),\n`;
  }
  let fetcher = `// SPDX-License-Identifier: AGPL-3.0-only\n\n`;
  fetcher += `import { httpGet } from '../../utils/http.js';\n`;
  fetcher += `import { DEFAULT_TIMEOUT_MS, DEFAULT_HEADERS } from './constants.js';\n\n`;
  fetcher += `export async function fetch${C}Records(options: { limit?: number } = {}): Promise<{ records: any[]; errors: string[] }> {\n`;
  fetcher += `  const records: any[] = [];\n  const errors: string[] = [];\n`;
  fetcher += `  const limit = options.limit ?? 400;\n\n`;
  fetcher += `  try {\n`;
  fetcher += `    const url = '${ckan}/api/3/action/package_search?q=${sys}&rows=' + limit;\n`;
  fetcher += `    const resp = await httpGet(url, { headers: { ...DEFAULT_HEADERS }, timeoutMs: DEFAULT_TIMEOUT_MS });\n`;
  fetcher += `    if (resp.statusCode >= 400) {\n      errors.push('HTTP ' + resp.statusCode + ' fetching');\n      return { records, errors };\n    }\n`;
  fetcher += `    const data = JSON.parse(resp.body);\n`;
  fetcher += `    const results: any[] = data?.result?.results ?? [];\n\n`;
  fetcher += `    for (const item of results) {\n      const r = item as Record<string, unknown>;\n      records.push({\n${fetcherFields}        source_url: String(r.url ?? r.source_url ?? ''),\n      });\n    }\n`;
  fetcher += `  } catch (err) {\n    errors.push('Fetch failed: ' + (err as Error).message);\n  }\n\n`;
  fetcher += `  return { records, errors };\n}\n`;

  // parser.ts
  let parseFields = '';
  for (const [col] of fields) parseFields += `    ${col}: raw.${col},\n`;
  let retFields = '';
  for (const [col] of fields) retFields += `    ${toCam(col)}: raw.${col} ?? null,\n`;
  let parser = `// SPDX-License-Identifier: AGPL-3.0-only\n\n`;
  parser += `import { computeHash } from '../../verification/hashing.js';\n`;
  parser += `import type { ${C}Record, Raw${C}Record } from './types.js';\n\n`;
  parser += `export async function parse${C}Record(raw: Raw${C}Record, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<${C}Record | null> {\n`;
  parser += `  const sourceUrl = raw.source_url ?? '';\n  if (!sourceUrl) return null;\n\n`;
  parser += `  const sourceSystem = options.sourceSystem ?? '${sys}';\n`;
  parser += `  const now = options.ingestedAt ?? new Date().toISOString();\n\n`;
  parser += `  const contentForHash = JSON.stringify({\n${parseFields}    sourceUrl,\n    sourceSystem,\n  });\n\n`;
  parser += `  const id = await computeHash(contentForHash, 'sha256');\n\n`;
  parser += `  return {\n    id,\n    recordType: '${rtype}',\n${retFields}    sourceUrl,\n    sourceSystem,\n    ingestedAt: now,\n  };\n}\n\n`;
  parser += `export async function parse${C}Batch(rawRecords: Raw${C}Record[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<${C}Record[]> {\n`;
  parser += `  const results: ${C}Record[] = [];\n`;
  parser += `  for (const raw of rawRecords) {\n    const parsed = await parse${C}Record(raw, options);\n    if (parsed !== null) results.push(parsed);\n  }\n  return results;\n}\n`;

  // index.ts
  let upsertFieldsList = fields.map(f => `'${f[0]}'`).join(', ');
  let upsertValsList = fields.map(f => `record.${toCam(f[0])}`).join(', ');
  let searchIf = '';
  let searchParams = '';
  if (searchCols.length > 0) {
    searchIf = 'if (query) {\n    const likeCols = [' + searchCols.map(c => `'${c}'`).join(', ') + `];\n`;
    searchIf += `    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';\n`;
    searchIf += `    const q = '%' + query + '%';\n`;
    searchIf += `    for (let i = 0; i < ${searchCols.length}; i++) params.push(q);\n  }\n`;
  }

  let index = `// SPDX-License-Identifier: AGPL-3.0-only\n\n`;
  index += `import { fetch${C}Records } from './fetcher.js';\n`;
  index += `import { parse${C}Record, parse${C}Batch } from './parser.js';\n`;
  index += `import { ${C.toUpperCase()}_DDL, DEFAULT_MAX_RECORDS, ${C}Error } from './constants.js';\n`;
  index += `import type { ${C}Record, ${C}IngestionOptions, ${C}IngestionResult, Raw${C}Record } from './types.js';\n\n`;
  index += `export { fetch${C}Records } from './fetcher.js';\n`;
  index += `export { parse${C}Record, parse${C}Batch } from './parser.js';\n`;
  index += `export { ${C.toUpperCase()}_DDL, DEFAULT_MAX_RECORDS, ${C}Error } from './constants.js';\n`;
  index += `export type { ${C}Record, ${C}IngestionOptions, ${C}IngestionResult, Raw${C}Record } from './types.js';\n\n`;
  index += `export interface D1Database {\n  prepare(sql: string): D1PreparedStatement;\n  exec(sql: string): Promise<{ success: boolean; error?: string }>;\n  batch(stmts: D1PreparedStatement[]): Promise<{ results?: unknown[]; success: boolean }[]>;\n}\n\n`;
  index += `export interface D1PreparedStatement {\n  bind(...args: unknown[]): D1PreparedStatement;\n  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;\n  first<T = unknown>(): Promise<T | null>;\n  run(): Promise<{ success: boolean; meta?: { changes: number } }>;\n}\n\n`;
  index += `export async function initialize${C}Table(db: D1Database): Promise<void> {\n  await db.exec(${C.toUpperCase()}_DDL);\n}\n\n`;
  index += `async function upsert${C}Record(db: D1Database, record: ${C}Record): Promise<boolean> {\n`;
  index += `  const fields = ['id', 'record_type', ${upsertFieldsList}];\n`;
  index += `  const values = [record.id, record.recordType, ${upsertValsList}];\n`;
  index += `  const placeholders = fields.map(() => '?').join(', ');\n`;
  index += `  const stmt = db.prepare('INSERT OR IGNORE INTO ${tbl} (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);\n`;
  index += `  const result = await stmt.run();\n  return result.success;\n}\n\n`;
  index += `export async function search${C}Records(db: D1Database, query: string, options: { limit?: number } = {}): Promise<${C}Record[]> {\n`;
  index += `  let sql = 'SELECT * FROM ${tbl} WHERE 1=1';\n`;
  index += `  const params: unknown[] = [];\n\n`;
  index += searchIf;
  index += `\n  sql += ' ORDER BY ingested_at DESC LIMIT ?';\n  params.push(options.limit ?? 50);\n\n`;
  index += `  const stmt = db.prepare(sql).bind(...params);\n  const result = await stmt.all<${C}Record>();\n  return result.results ?? [];\n}\n\n`;
  index += `export async function ingest${C}Data(db: D1Database | null, options: ${C}IngestionOptions = {}): Promise<${C}IngestionResult> {\n`;
  index += `  const startTime = Date.now();\n`;
  index += `  const result: ${C}IngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };\n`;
  index += `  const log = options.onProgress ?? (() => {});\n`;
  index += `  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;\n`;
  index += `  result.perType['${rtype}'] = { recordsFound: 0, recordsIngested: 0 };\n\n`;
  index += `  try {\n    if (db && options.initializeTable) {\n      log('[${C}] Initializing table...');\n      await initialize${C}Table(db);\n    }\n\n`;
  index += `    log('[${C}] Fetching data...');\n`;
  index += `    const { records: rawRecords, errors: fetchErrors } = await fetch${C}Records({ limit: maxRecords });\n`;
  index += `    result.errors.push(...fetchErrors);\n`;
  index += `    log('[' + ${C} + '] Found ' + rawRecords.length + ' raw records');\n\n`;
  index += `    const parsed = await parse${C}Batch(rawRecords as Raw${C}Record[], { sourceSystem: '${sys}' });\n\n`;
  index += `    for (const record of parsed) {\n      result.recordsFound++;\n      result.perType['${rtype}'].recordsFound++;\n      if (db) {\n        const inserted = await upsert${C}Record(db, record);\n        if (inserted) result.newRecords++;\n        result.recordsIngested++;\n        result.perType['${rtype}'].recordsIngested++;\n      }\n    }\n  } catch (err) {\n    const msg = '${C} ingestion failed: ' + (err as Error).message;\n    result.errors.push(msg);\n    log('[${C}] ' + msg);\n  }\n\n`;
  index += `  result.durationMs = Date.now() - startTime;\n  log('[${C}] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');\n  return result;\n}\n`;

  const fmap = { 'types.ts': types, 'constants.ts': constants, 'fetcher.ts': fetcher, 'parser.ts': parser, 'index.ts': index };
  for (const [fn, content] of Object.entries(fmap)) {
    const fp = path.join(dir, fn);
    if (fs.existsSync(fp) && fs.statSync(fp).size > 50) {
      console.log('SKIP ' + mid + '/' + fn);
    } else {
      fs.writeFileSync(fp, content);
      console.log('CREATE ' + mid + '/' + fn + ' (' + content.split('\n').length + ' lines)');
    }
  }
}
