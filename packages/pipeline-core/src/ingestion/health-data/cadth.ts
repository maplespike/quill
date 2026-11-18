// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CADTH Ingestion — Canadian Agency for Drugs and Technologies in Health
 *
 * Ingests CADTH drug recommendation reports (CDR/pCODR) from the CADTH
 * public website and Government of Canada Open Data Portal (CKAN).
 *
 * Data sources:
 *   - CADTH public website: drug recommendation and review pages
 *   - CKAN: CADTH-related datasets on open.canada.ca
 *
 * CADTH recommendation types:
 *   - CDR (Common Drug Review): for drugs reviewed under the pan-Canadian
 *     Pharmaceutical Alliance process
 *   - pCODR (pan-Canadian Oncology Drug Review): oncology drugs
 *
 * Cross-reference: CADTH recommendations ↔ PHAC opioid surveillance
 *                  (opioid therapies), PMPRB pricing decisions (review →
 *                  price negotiation pipeline).
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  HEALTH_DATA_SOURCES,
  CADTH_RECOMMENDATIONS_DDL,
  DEFAULT_MAX_RECORDS,
  HTTP_TIMEOUT_MS,
  DEFAULT_CKAN_ROWS,
  HealthDataError,
} from './constants.js';
import type { CadthRecommendation } from './types.js';

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
  const base = 'https://open.canada.ca/data/api/3/action/';
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
/*  CADTH: Fetch Recommendations (HTML scrape + CKAN)                  */
/* ------------------------------------------------------------------ */

async function fetchCadthRecommendations(maxRecords: number): Promise<CadthRecommendation[]> {
  const records: CadthRecommendation[] = [];
  const now = new Date().toISOString();
  const baseUrl = HEALTH_DATA_SOURCES.CADTH.BASE;

  // Phase 1: Try to scrape CADTH's recommendation pages for dynamic data
  try {
    const cdrUrl = HEALTH_DATA_SOURCES.CADTH.CDR_RECOMMENDATIONS;
    const resp = await httpGet(cdrUrl, { timeoutMs: HTTP_TIMEOUT_MS });
    const html = resp.body;

    // Attempt simple HTML extraction for supplementary recommendations
    // CADTH uses structured HTML tables with recommendation data
    const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
    for (const row of rows.slice(0, Math.max(10, maxRecords / 2))) {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
      if (cells.length < 3) continue;

      const drugName = cells[0]?.replace(/<[^>]+>/g, '').trim() ?? '';
      const recommendation = cells[2]?.replace(/<[^>]+>/g, '').trim() ?? '';
      if (!drugName || !recommendation) continue;

      const indication = cells[1]?.replace(/<[^>]+>/g, '').trim() ?? null;
      const brandName = ''; // rarely on same page
      const manufacturer = ''; // rarely on same page

      const content = drugName + indication + recommendation;
      const id = await computeHash(content, 'sha256');

      // Extract date if available
      const dateMatch = html.match(/(20[0-9][0-9])-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/);
      const recDate = dateMatch ? dateMatch[0] : null;

      records.push({
        id,
        drug_name: drugName,
        brand_name: brandName || null,
        manufacturer: manufacturer || null,
        indication,
        recommendation,
        recommendation_type: null,
        review_type: null,
        submission_date: null,
        recommendation_date: recDate,
        reimbursement_condition: null,
        therapeutic_area: null,
        source_url: cdrUrl,
        ingested_at: now,
      });
    }
  } catch {
    // Fall through to CKAN
  }

  // Phase 2: Search CKAN for CADTH datasets
  try {
    const packages = await searchCkanPackages('cadth drug recommendations', DEFAULT_CKAN_ROWS);
    for (const pkg of packages.slice(0, 3)) {
      const resources = pkg.resources ?? [];
      for (const res of resources.slice(0, 3)) {
        if (!res.url) continue;
        try {
          const rows = await fetchCkanResourceJson(res.url);
          for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
            const r = row as Record<string, unknown>;
            const drugName = String(r.drug_name ?? r.drug ?? r.DrugName ?? r.drugName ?? r.brand_name ?? r.BrandName ?? '');
            if (!drugName) continue;

            const content = JSON.stringify(r);
            const id = await computeHash(content, 'sha256');

            // Deduplicate against scraped records
            if (records.some((rec) => rec.id === id || rec.drug_name === drugName)) continue;

            records.push({
              id,
              drug_name: drugName,
              brand_name: String(r.brand_name ?? r.brandName ?? r.BrandName ?? '') || null,
              manufacturer: String(r.manufacturer ?? r.Manufacturer ?? r.company ?? '') || null,
              indication: String(r.indication ?? r.Indication ?? r.therapeutic_area ?? '') || null,
              recommendation: String(r.recommendation ?? r.Recommendation ?? r.outcome ?? '') || null,
              recommendation_type: String(r.recommendation_type ?? r.recommendationType ?? r.type ?? '') || null,
              review_type: String(r.review_type ?? r.reviewType ?? r.program ?? '') || null,
              submission_date: String(r.submission_date ?? r.submissionDate ?? r.date_submitted ?? '') || null,
              recommendation_date: String(r.recommendation_date ?? r.recommendationDate ?? r.date ?? r.decision_date ?? '') || null,
              reimbursement_condition: String(r.reimbursement_condition ?? r.conditions ?? r.condition ?? '') || null,
              therapeutic_area: String(r.therapeutic_area ?? r.therapeuticArea ?? r.therapeutic_class ?? r.disease_area ?? '') || null,
              source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
              ingested_at: now,
            });
          }
        } catch {
          // skip resource that could not be fetched
        }
      }
    }

    // Try additional search terms for more CADTH data
    if (records.length < maxRecords / 2) {
      const altPackages = await searchCkanPackages('common drug review cdr recommendation', DEFAULT_CKAN_ROWS);
      for (const pkg of altPackages.slice(0, 2)) {
        const resources = pkg.resources ?? [];
        for (const res of resources.slice(0, 2)) {
          if (!res.url) continue;
          try {
            const rows = await fetchCkanResourceJson(res.url);
            for (const row of rows.slice(0, Math.floor(maxRecords / 4))) {
              const r = row as Record<string, unknown>;
              const drugName = String(r.drug_name ?? r.drug ?? r.DrugName ?? r.drugName ?? r.brand_name ?? '');
              if (!drugName) continue;

              const content = JSON.stringify(r);
              const id = await computeHash(content, 'sha256');

              if (records.some((rec) => rec.id === id || rec.drug_name === drugName)) continue;

              records.push({
                id,
                drug_name: drugName,
                brand_name: String(r.brand_name ?? r.brandName ?? '') || null,
                manufacturer: String(r.manufacturer ?? r.Manufacturer ?? r.company ?? '') || null,
                indication: String(r.indication ?? r.Indication ?? '') || null,
                recommendation: String(r.recommendation ?? r.Recommendation ?? r.outcome ?? r.decision ?? '') || null,
                recommendation_type: String(r.recommendation_type ?? r.type ?? '') || null,
                review_type: String(r.review_type ?? r.program ?? '') || null,
                submission_date: String(r.submission_date ?? r.submissionDate ?? '') || null,
                recommendation_date: String(r.recommendation_date ?? r.recommendationDate ?? r.date ?? '') || null,
                reimbursement_condition: String(r.reimbursement_condition ?? r.conditions ?? '') || null,
                therapeutic_area: String(r.therapeutic_area ?? r.therapeuticArea ?? r.therapeutic_class ?? '') || null,
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
  } catch {
    // Fall through — return whatever we got from scraping
  }

  if (records.length === 0) {
    throw new HealthDataError('CADTH recommendations: No data could be fetched from any source', 'cadth');
  }

  return records.slice(0, maxRecords);
}

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

export async function initializeCadthTables(db: D1Database): Promise<void> {
  await db.exec(CADTH_RECOMMENDATIONS_DDL);
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

export async function ingestCadthRecommendations(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchCadthRecommendations(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'drug_name', 'brand_name', 'manufacturer', 'indication',
        'recommendation', 'recommendation_type', 'review_type', 'submission_date',
        'recommendation_date', 'reimbursement_condition', 'therapeutic_area',
        'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_cadth_recommendations', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`CADTH recommendations: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestAllCadth(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  return ingestCadthRecommendations(db, maxRecords);
}
