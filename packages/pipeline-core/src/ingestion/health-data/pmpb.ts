// SPDX-License-Identifier: AGPL-3.0-only
/**
 * PMPRB Ingestion — Patented Medicine Prices Review Board
 *
 * Ingests PMPRB drug pricing decisions, annual reports, and price review
 * data from the Government of Canada Open Data Portal (CKAN) and the
 * PMPRB public website.
 *
 * PMPRB is an independent quasi-judicial body that regulates the prices
 * of patented medicines sold in Canada. Its pricing decisions establish
 * maximum allowable prices for new patented drugs.
 *
 * Data sources:
 *   - CKAN: PMPRB datasets on open.canada.ca
 *   - PMPRB website: annual reports, price review summaries
 *
 * Cross-reference: PMPRB pricing ↔ CADTH recommendations (drug review →
 *                  price negotiation → final pricing decision pipeline)
 *                  ↔ Health Canada DPD (approved drugs requiring price review)
 *                  ↔ Corporate (pharmaceutical company lobbying on pricing)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  HEALTH_DATA_SOURCES,
  PMPRB_PRICING_DDL,
  DEFAULT_MAX_RECORDS,
  HTTP_TIMEOUT_MS,
  DEFAULT_CKAN_ROWS,
  HealthDataError,
} from './constants.js';
import type { PmprbPricing } from './types.js';

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
  const base = HEALTH_DATA_SOURCES.PMPRB.BASE;
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
/*  PMPRB: Fetch Pricing Decisions (CKAN only)                         */
/* ------------------------------------------------------------------ */

async function fetchPmprbPricing(maxRecords: number): Promise<PmprbPricing[]> {
  const records: PmprbPricing[] = [];
  const now = new Date().toISOString();

  // Phase 1: Search CKAN for PMPRB datasets
  const packages = await searchCkanPackages('patented medicine prices review board', DEFAULT_CKAN_ROWS);
  for (const pkg of packages.slice(0, 5)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 5))) {
          const r = row as Record<string, unknown>;
          const drug = String(r.drug_name ?? r.drug ?? r.medicine ?? r.MedicineName ?? r.product_name ?? r.medicine_name ?? '');
          if (!drug) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            drug_name: drug,
            manufacturer: String(r.manufacturer ?? r.company ?? r.Manufacturer ?? r.manufacturer_name ?? '') || null,
            decision_type: String(r.decision_type ?? r.DecisionType ?? r.type ?? r.decisionType ?? '') || null,
            decision_date: String(r.decision_date ?? r.date ?? r.DecisionDate ?? r.decisionDate ?? r.year ?? '') || null,
            status: String(r.status ?? r.Status ?? r.compliance_status ?? r.complianceStatus ?? '') || null,
            therapeutic_category: String(r.therapeutic_category ?? r.therapeutic_class ?? r.category ?? r.therapeuticCategory ?? r.atc_class ?? r.ATC ?? '') || null,
            proposed_price_cad: r.proposed_price_cad ? Number(r.proposed_price_cad) : (r.proposedPriceCad ? Number(r.proposedPriceCad) : (r.proposed_price ? Number(r.proposed_price) : null)),
            approved_price_cad: r.approved_price_cad ? Number(r.approved_price_cad) : (r.approvedPriceCad ? Number(r.approvedPriceCad) : (r.approved_price ? Number(r.approved_price) : null)),
            foreign_price_comparison: String(r.foreign_price_comparison ?? r.foreignPriceComparison ?? '') || null,
            comparison_countries: String(r.comparison_countries ?? r.comparisonCountries ?? r.countries ?? '') || null,
            atc_class: String(r.atc_class ?? r.ATCCode ?? r.atcClass ?? r.atc_code ?? '') || null,
            din: String(r.din ?? r.DIN ?? r.drug_identification_number ?? r.drugIdentificationNumber ?? '') || null,
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
        }
      } catch {
        // skip resource that could not be fetched
      }
    }
  }

  // Phase 2: Try additional search terms for more data
  if (records.length < maxRecords / 2) {
    const altPackages = await searchCkanPackages('pmprb pricing decision', DEFAULT_CKAN_ROWS);
    for (const pkg of altPackages.slice(0, 3)) {
      const resources = pkg.resources ?? [];
      for (const res of resources.slice(0, 3)) {
        if (!res.url) continue;
        try {
          const rows = await fetchCkanResourceJson(res.url);
          for (const row of rows.slice(0, Math.floor(maxRecords / 5))) {
            const r = row as Record<string, unknown>;
            const drug = String(r.drug_name ?? r.drug ?? r.medicine ?? r.MedicineName ?? r.product_name ?? '');
            if (!drug) continue;

            const content = JSON.stringify(r);
            const id = await computeHash(content, 'sha256');

            if (records.some((rec) => rec.id === id)) continue;

            records.push({
              id,
              drug_name: drug,
              manufacturer: String(r.manufacturer ?? r.company ?? r.Manufacturer ?? '') || null,
              decision_type: String(r.decision_type ?? r.type ?? r.decisionType ?? '') || null,
              decision_date: String(r.decision_date ?? r.date ?? r.decisionDate ?? r.year ?? '') || null,
              status: String(r.status ?? r.compliance_status ?? '') || null,
              therapeutic_category: String(r.therapeutic_category ?? r.therapeutic_class ?? r.category ?? r.atc_class ?? '') || null,
              proposed_price_cad: r.proposed_price_cad ? Number(r.proposed_price_cad) : (r.proposed_price ? Number(r.proposed_price) : null),
              approved_price_cad: r.approved_price_cad ? Number(r.approved_price_cad) : (r.approved_price ? Number(r.approved_price) : null),
              foreign_price_comparison: String(r.foreign_price_comparison ?? '') || null,
              comparison_countries: String(r.comparison_countries ?? r.countries ?? '') || null,
              atc_class: String(r.atc_class ?? r.ATCCode ?? r.atc_code ?? '') || null,
              din: String(r.din ?? r.DIN ?? r.drug_identification_number ?? '') || null,
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

  // Phase 3: Try PMPRB's own published data
  if (records.length === 0) {
    try {
      const reportUrl = HEALTH_DATA_SOURCES.PMPRB.ANNUAL_REPORT;
      const resp = await httpGet(reportUrl, { timeoutMs: HTTP_TIMEOUT_MS });
      const html = resp.body;

      // Try to extract pricing decision information from HTML tables
      const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
      for (const row of rows.slice(0, Math.max(5, Math.floor(maxRecords / 5)))) {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
        if (cells.length < 3) continue;

        const cellTexts = cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim());
        const drugName = cellTexts[0];
        if (!drugName || drugName.includes('drug') || drugName.includes('Medicine')) continue;

        const content = JSON.stringify(cellTexts);
        const id = await computeHash(content, 'sha256');

        records.push({
          id,
          drug_name: drugName,
          manufacturer: cellTexts.length > 1 ? cellTexts[1] || null : null,
          decision_type: cellTexts.length > 2 ? cellTexts[2] || null : null,
          decision_date: cellTexts.length > 3 ? cellTexts[3] || null : null,
          status: cellTexts.length > 4 ? cellTexts[4] || null : null,
          therapeutic_category: null,
          proposed_price_cad: cellTexts.length > 5 ? parseFloat(cellTexts[5]) || null : null,
          approved_price_cad: cellTexts.length > 6 ? parseFloat(cellTexts[6]) || null : null,
          foreign_price_comparison: null,
          comparison_countries: null,
          atc_class: cellTexts.length > 7 ? cellTexts[7] || null : null,
          din: null,
          source_url: reportUrl,
          ingested_at: now,
        });
      }
    } catch {
      // PMPRB website scraping failed
    }
  }

  if (records.length === 0) {
    throw new HealthDataError('PMPRB pricing: No data could be fetched from any source', 'pmpb');
  }

  return records.slice(0, maxRecords);
}

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

export async function initializePmprbTables(db: D1Database): Promise<void> {
  await db.exec(PMPRB_PRICING_DDL);
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

export async function ingestPmprbPricing(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchPmprbPricing(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'drug_name', 'manufacturer', 'decision_type',
        'decision_date', 'status', 'therapeutic_category', 'proposed_price_cad',
        'approved_price_cad', 'foreign_price_comparison', 'comparison_countries',
        'atc_class', 'din', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_pmprb_pricing', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`PMPRB pricing: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestAllPmprb(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  return ingestPmprbPricing(db, maxRecords);
}
