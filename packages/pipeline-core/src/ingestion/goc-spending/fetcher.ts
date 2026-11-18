// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GoC-Spending Fetcher — Quill
 *
 * Downloads CSV data from the GoC-Spending project:
 *   1. Combined dataset CSVs (ZIP archives from download page)
 *   2. Analysis aggregate CSVs from GitHub
 *   3. Raw JSON archives from goc-spending-data repo
 *
 * Publisher terms are dataset-specific. Do not infer terms from this mirror;
 * retain the original publisher's declaration when available.
 */

import { httpGet } from '../../utils/http.js';
import { parseGoCContracts, parseGoCDeptSpending, parseGoCVendorSpending } from './parser.js';
import {
  GOC_SPENDING_DATA_REPO,
  GOC_ANALYSIS_BASE,
  DEFAULT_MAX_RECORDS,
  FETCH_TIMEOUT_MS,
} from './constants.js';
import type { GoCContract, GoCDeptSpending, GoCVendorSpending, GoCIngestionResult } from './types.js';
import { parseCsvLine } from '../../utils/csv.js';

async function fetchText(url: string): Promise<string> {
  const resp = await httpGet(url, { timeoutMs: FETCH_TIMEOUT_MS });
  return resp.body;
}

async function fetchJson(url: string): Promise<any> {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function parseCsvToObjects(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const hdrs = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[\s"'\-]/g, '_'));
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < hdrs.length && j < cols.length; j++) row[hdrs[j]] = cols[j];
    out.push(row);
  }
  return out;
}

export async function listDataFiles(): Promise<string[]> {
  const data: any[] = await fetchJson(
    'https://api.github.com/repos/GoC-Spending/goc-spending-data/contents',
  );
  if (!Array.isArray(data)) return [];
  return data.filter(f => f.name?.endsWith('.csv')).map(f => f.download_url).filter(Boolean);
}

export async function fetchContractCsv(url: string): Promise<GoCContract[]> {
  const text = await fetchText(url);
  const rows = parseCsvToObjects(text);
  return parseGoCContracts(rows, DEFAULT_MAX_RECORDS);
}

export async function fetchDepartmentAggregates(): Promise<GoCDeptSpending[]> {
  const url = `${GOC_ANALYSIS_BASE}/general/entries-by-department-by-fiscal.csv`;
  const rows = parseCsvToObjects(await fetchText(url));
  return parseGoCDeptSpending(rows);
}

export async function fetchContracts(
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<GoCContract[]> {
  const files = await listDataFiles();
  const all: GoCContract[] = [];
  for (const url of files.slice(0, 3)) {
    all.push(...(await fetchContractCsv(url)));
    if (all.length >= maxRecords) break;
  }
  return all.slice(0, maxRecords);
}

export async function ingestAllGoCSpending(): Promise<GoCIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  let records: GoCContract[] = [];

  try {
    records = await fetchContracts();
  } catch (e) {
    errors.push(`Contracts: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    source: 'goc-spending',
    recordsFound: records.length,
    recordsIngested: records.length,
    errors,
    durationMs: Date.now() - start,
  };
}
