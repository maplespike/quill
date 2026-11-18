// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CIHI Ingestion — Canadian Institute for Health Information
 *
 * Ingests wait times for surgery and diagnostic tests, plus national health
 * expenditure trends from the Government of Canada Open Data Portal (CKAN)
 * and CIHI's public data pages.
 *
 * Data sources:
 *   - CKAN: CIHI datasets published on open.canada.ca (wait times, spending)
 *   - CIHI web pages (HTML reports): supplementary scraping
 *
 * Note: Some CIHI detailed data requires paid access; this module captures
 * the publicly available aggregate data from open.canada.ca.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  HEALTH_DATA_SOURCES,
  CIHI_WAIT_TIMES_DDL,
  CIHI_HEALTH_SPENDING_DDL,
  DEFAULT_MAX_RECORDS,
  HTTP_TIMEOUT_MS,
  DEFAULT_CKAN_ROWS,
  HealthDataError,
} from './constants.js';
import type {
  CihiWaitTime,
  CihiHealthSpending,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Minimal D1Database Interface                                       */
/* ------------------------------------------------------------------ */

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
/*  CKAN Helpers                                                       */
/* ------------------------------------------------------------------ */

interface CkanResource {
  id: string;
  name?: string;
  format?: string;
  url?: string;
  package_id?: string;
}

interface CkanPackage {
  id: string;
  title: string;
  notes?: string;
  resources?: CkanResource[];
}

interface CkanSearchResult {
  result?: {
    results?: CkanPackage[];
    count?: number;
  };
}

async function searchCkanPackages(
  query: string,
  rows: number = DEFAULT_CKAN_ROWS,
): Promise<CkanPackage[]> {
  const base = HEALTH_DATA_SOURCES.CIHI.BASE_OPEN_CANADA;
  const url = `${base}package_search?q=${encodeURIComponent(query)}&rows=${rows}`;
  const resp = await httpGet(url, { timeoutMs: HTTP_TIMEOUT_MS });
  const text = resp.body;
  const parsed: CkanSearchResult = JSON.parse(text);
  return parsed?.result?.results ?? [];
}

async function fetchCkanResourceJson(url: string): Promise<unknown[]> {
  const resp = await httpGet(url, { timeoutMs: HTTP_TIMEOUT_MS });
  const text = resp.body;
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.result?.results && Array.isArray(parsed.result.results)) return parsed.result.results;
  if (parsed?.results && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

/* ------------------------------------------------------------------ */
/*  CIHI: Wait Times (CKAN + HTML scraping)                           */
/* ------------------------------------------------------------------ */

/**
 * Extract wait-time data points from CIHI pages and CKAN datasets.
 */
async function fetchCihiWaitTimes(maxRecords: number): Promise<CihiWaitTime[]> {
  const records: CihiWaitTime[] = [];
  const now = new Date().toISOString();

  // Phase 1: Try CKAN for structured CIHI wait times data
  let ckanRecords = 0;
  const packages = await searchCkanPackages('cihi wait times surgery', DEFAULT_CKAN_ROWS);
  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const year = parseInt(String(r.year ?? r.Year ?? r.report_year ?? r.fiscal_year ?? '0'), 10);
          const province = String(r.province ?? r.Province ?? r.geo ?? '');
          const surgeryType = String(r.surgery_type ?? r.surgery ?? r.SurgeryType ?? r.procedure ?? r.category ?? '');
          if (!year || !province || !surgeryType) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            year,
            province,
            surgery_type: surgeryType.toLowerCase().replace(/\s+/g, '_'),
            procedure: surgeryType,
            wait_time_days: r.wait_time_days ? Number(r.wait_time_days) : (r.wait_time ? Number(r.wait_time) : null),
            wait_time_p90_days: r.wait_time_p90_days ? Number(r.wait_time_p90_days) : null,
            volume: r.volume ? Number(r.volume) : (r.count ? Number(r.count) : null),
            priority: String(r.priority ?? r.urgency ?? '') || null,
            metric: String(r.metric ?? r.measure ?? 'median_wait_days') || 'median_wait_days',
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
          ckanRecords++;
        }
      } catch {
        // skip resource that could not be fetched
      }
    }
  }

  // Phase 2: Try scraping CIHI's HTML page for supplementary data
  try {
    const surgeryUrl = HEALTH_DATA_SOURCES.CIHI.WAIT_TIMES_SURGERY;
    const resp = await httpGet(surgeryUrl, { timeoutMs: HTTP_TIMEOUT_MS });
    const html = resp.body;

    // Try extracting data tables from CIHI HTML
    const tableRows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
    for (const row of tableRows.slice(0, Math.max(10, Math.floor(maxRecords / 5)))) {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
      if (cells.length < 3) continue;

      const cellTexts = cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim());
      const year = parseInt(cellTexts[0], 10);
      const province = cellTexts[1];
      const waitDays = parseFloat(cellTexts[2]);

      if (!year || !province || isNaN(waitDays)) continue;
      if (!['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT', 'CA'].includes(province)) continue;

      const surgeryType = cellTexts.length > 3 ? cellTexts[3].toLowerCase().replace(/\s+/g, '_') : 'unknown';
      const content = `${year}:${province}:${surgeryType}:${waitDays}`;
      const id = await computeHash(content, 'sha256');

      // Deduplicate against CKAN records
      if (records.some((r) => r.id === id)) continue;

      records.push({
        id,
        year,
        province,
        surgery_type: surgeryType,
        procedure: cellTexts[3] || null,
        wait_time_days: waitDays,
        wait_time_p90_days: cellTexts.length > 4 ? parseFloat(cellTexts[4]) || null : null,
        volume: cellTexts.length > 6 ? parseInt(cellTexts[6], 10) || null : null,
        priority: null,
        metric: 'median_wait_days',
        source_url: surgeryUrl,
        ingested_at: now,
      });
    }
  } catch {
    // HTML scraping failed — rely on whatever CKAN gave us
  }

  if (records.length === 0 && ckanRecords === 0) {
    throw new HealthDataError('CIHI wait times: No data could be fetched from any source', 'cihi');
  }

  return records.slice(0, maxRecords);
}

/* ------------------------------------------------------------------ */
/*  CIHI: Health Spending (CKAN)                                       */
/* ------------------------------------------------------------------ */

/**
 * Extract health-spending trend data from CKAN datasets.
 */
async function fetchCihiHealthSpending(maxRecords: number): Promise<CihiHealthSpending[]> {
  const records: CihiHealthSpending[] = [];
  const now = new Date().toISOString();

  // Try CKAN for structured CIHI health spending data
  const packages = await searchCkanPackages('national health expenditure canada', DEFAULT_CKAN_ROWS);
  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const fiscalYear = String(r.fiscal_year ?? r.year ?? r.fiscalYear ?? r.FiscalYear ?? r.reference_period ?? '');
          const province = String(r.province ?? r.Province ?? r.geo ?? r.GEO ?? '');
          const category = String(r.spending_category ?? r.category ?? r.Category ?? r.sector ?? r.Sector ?? r.category_en ?? '');
          const amount = r.amount_cad ? Number(r.amount_cad) : (r.amount ? Number(r.amount) : (r.value ? Number(r.value) : null));
          if (!fiscalYear || !province || !category || amount === null) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            fiscal_year: fiscalYear,
            province,
            spending_category: category.toLowerCase().replace(/\s+/g, '_'),
            amount_cad: amount,
            per_capita: r.per_capita ? Number(r.per_capita) : null,
            growth_percent: r.growth_percent ? Number(r.growth_percent) : null,
            share_of_gdp: r.share_of_gdp ? Number(r.share_of_gdp) : null,
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
        }
      } catch {
        // skip resource that could not be fetched
      }
    }
  }

  // Also search for alternate datasets
  if (records.length < maxRecords / 2) {
    const altPackages = await searchCkanPackages('health spending provincial territorial', DEFAULT_CKAN_ROWS);
    for (const pkg of altPackages.slice(0, 3)) {
      const resources = pkg.resources ?? [];
      for (const res of resources.slice(0, 2)) {
        if (!res.url) continue;
        try {
          const rows = await fetchCkanResourceJson(res.url);
          for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
            const r = row as Record<string, unknown>;
            const fiscalYear = String(r.fiscal_year ?? r.year ?? r.FiscalYear ?? r.reference_period ?? '');
            const province = String(r.province ?? r.Province ?? r.geo ?? r.GEO ?? '');
            const category = String(r.spending_category ?? r.category ?? r.Category ?? r.sector ?? r.Sector ?? '');
            const amount = r.amount_cad ? Number(r.amount_cad) : (r.amount ? Number(r.amount) : (r.value ? Number(r.value) : null));
            if (!fiscalYear || !province || !category || amount === null) continue;

            const content = JSON.stringify(r);
            const id = await computeHash(content, 'sha256');

            if (records.some((rec) => rec.id === id)) continue;

            records.push({
              id,
              fiscal_year: fiscalYear,
              province,
              spending_category: category.toLowerCase().replace(/\s+/g, '_'),
              amount_cad: amount,
              per_capita: r.per_capita ? Number(r.per_capita) : null,
              growth_percent: r.growth_percent ? Number(r.growth_percent) : null,
              share_of_gdp: r.share_of_gdp ? Number(r.share_of_gdp) : null,
              source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
              ingested_at: now,
            });
          }
        } catch {
          // skip
        }
      }
    }
  }

  if (records.length === 0) {
    throw new HealthDataError('CIHI health spending: No data could be fetched from any source', 'cihi');
  }

  return records.slice(0, maxRecords);
}

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

export async function initializeCihiTables(db: D1Database): Promise<void> {
  await db.exec(CIHI_WAIT_TIMES_DDL);
  await db.exec(CIHI_HEALTH_SPENDING_DDL);
}

async function upsertGeneric<T extends { id: string }>(
  db: D1Database,
  table: string,
  columns: string[],
  record: T,
): Promise<boolean> {
  const placeholders = columns.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
  );
  const values = columns.map((c) => (record as Record<string, unknown>)[c] ?? null);
  const result = await stmt.bind(...values).run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/*  Public Ingestion Functions                                         */
/* ------------------------------------------------------------------ */

export async function ingestCihiWaitTimes(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchCihiWaitTimes(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'year', 'province', 'surgery_type', 'procedure',
        'wait_time_days', 'wait_time_p90_days', 'volume', 'priority', 'metric',
        'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_cihi_wait_times', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`CIHI wait times: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestCihiHealthSpending(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchCihiHealthSpending(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'fiscal_year', 'province', 'spending_category',
        'amount_cad', 'per_capita', 'growth_percent', 'share_of_gdp',
        'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_cihi_spending', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`CIHI health spending: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestAllCihi(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const results = await Promise.all([
    ingestCihiWaitTimes(db, maxRecords),
    ingestCihiHealthSpending(db, maxRecords),
  ]);

  return {
    found: results.reduce((s, r) => s + r.found, 0),
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    errors: results.flatMap((r) => r.errors),
  };
}
