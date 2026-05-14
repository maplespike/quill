/**
 * GoC-Spending Fetcher — MapleSpike Pipeline
 *
 * Downloads CSV data from the GoC-Spending project:
 *   1. Combined dataset CSVs (ZIP archives from download page)
 *   2. Analysis aggregate CSVs from GitHub
 *   3. Raw JSON archives from goc-spending-data repo
 *
 * All data is under Open Government Licence – Canada / CC0.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  GOC_SPENDING_DATA_REPO,
  GOC_ANALYSIS_BASE,
  DEFAULT_MAX_RECORDS,
  FETCH_TIMEOUT_MS,
} from './constants.js';
import type { GoCContract, GoCDeptSpending, GoCVendorSpending, GoCIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function fetchText(url: string): Promise<string> {
  const resp = await httpGet(url, { timeoutMs: FETCH_TIMEOUT_MS });
  return resp.body;
}

async function fetchJson(url: string): Promise<any> {
  const text = await fetchText(url);
  return JSON.parse(text);
}

/** Parse a CSV line into columns, handling quoted values */
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

/** Parse CSV text into array of row objects */
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

/* ------------------------------------------------------------------ */
/*  Data Fetching                                                      */
/* ------------------------------------------------------------------ */

/** List available CSV files from the GoC-Spending data repo */
export async function listDataFiles(): Promise<string[]> {
  const data: any[] = await fetchJson(
    'https://api.github.com/repos/GoC-Spending/goc-spending-data/contents',
  );
  if (!Array.isArray(data)) return [];
  return data.filter(f => f.name?.endsWith('.csv')).map(f => f.download_url).filter(Boolean);
}

/** Download and parse a single CSV file */
async function fetchContractCsv(url: string): Promise<GoCContract[]> {
  const text = await fetchText(url);
  const rows = parseCsvToObjects(text);
  const now = new Date().toISOString();
  const out: GoCContract[] = [];

  for (const row of rows) {
    const vendor = row.vendor_name || row.vendor || row.contractor || null;
    const dept = row.department || row.owner_org || row.organization || null;
    if (!vendor && !dept && !row.description) continue;

    const value = parseFloat((row.value || row.contract_value || row.amount || '0').replace(/[$,]/g, ''));
    const sy = parseInt(row.start_year || row.effective_start_year || row.year || '0', 10);
    const ey = parseInt(row.end_year || row.effective_end_year || '0', 10);
    const content = JSON.stringify(row);
    const id = await computeHash(content, 'sha256');

    out.push({
      id,
      vendor,
      vendorNormalized: row.vendor_normalized || row.cleaned_vendor_name || null,
      department: dept,
      description: row.description || row.commodity_description || null,
      value: isNaN(value) ? null : value,
      startYear: isNaN(sy) ? null : sy,
      endYear: isNaN(ey) ? null : ey,
      source: 'GoC-Spending',
      referenceNumber: row.reference_number || row.ref_number || row.contract_id || null,
      contractDate: row.contract_date || row.date || null,
      procurementMethod: row.procurement_method || null,
      tradeAgreementExemption: row.trade_agreement_exemption || null,
      isDuplicate: (row.duplicate_flag || '').toLowerCase() === 'true',
      isError: (row.error_flag || '').toLowerCase() === 'true',
      dataHash: id,
      ingestedAt: now,
    });
  }
  return out;
}

/** Fetch department aggregate spending */
async function fetchDepartmentAggregates(): Promise<GoCDeptSpending[]> {
  const url = `${GOC_ANALYSIS_BASE}/general/entries-by-department-by-fiscal.csv`;
  const rows = parseCsvToObjects(await fetchText(url));
  const now = new Date().toISOString();
  const out: GoCDeptSpending[] = [];

  for (const row of rows) {
    const dept = row.department || '';
    const fiscal = row.fiscal_year || '';
    if (!dept || !fiscal) continue;
    const count = parseInt(row.entries || '0', 10);
    const value = parseFloat((row.value || '0').replace(/[$,]/g, ''));
    const hash = await computeHash(`goc-dept:${dept}:${fiscal}`, 'sha256');
    out.push({
      department: dept, fiscalYear: fiscal,
      contractCount: isNaN(count) ? 0 : count,
      totalValue: isNaN(value) ? 0 : value,
      avgValue: count > 0 ? value / count : 0,
      dataHash: hash, ingestedAt: now,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Entry Points                                             */
/* ------------------------------------------------------------------ */

/** Fetch combined contract data from the GoC-Spending project */
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

/** Master ingestion: contracts + department aggregates */
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
