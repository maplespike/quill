// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CFIA Ingestion — Canadian Food Inspection Agency
 *
 * Ingests food recalls, import refusals, and food establishment inspection
 * data from the Government of Canada Open Data Portal (CKAN) and the
 * Healthy Canadians recall RSS feed.
 *
 * Data sources:
 *   - CKAN: food recalls, import refusals, inspections
 *   - Healthy Canadians RSS: real-time recall alerts
 *
 * Cross-reference: CFIA recalls ↔ Health Canada recalls (recalls.canada.ca)
 *                  via product name, manufacturer, UPC.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  HEALTH_DATA_SOURCES,
  CFIA_RECALLS_DDL,
  CFIA_IMPORT_REFUSALS_DDL,
  CFIA_INSPECTIONS_DDL,
  DEFAULT_MAX_RECORDS,
  HTTP_TIMEOUT_MS,
  DEFAULT_CKAN_ROWS,
  HealthDataError,
} from './constants.js';
import type {
  CfiaRecall,
  CfiaImportRefusal,
  CfiaInspection,
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
  const base = HEALTH_DATA_SOURCES.CFIA.BASE;
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
/*  CFIA: Food Recalls                                                 */
/* ------------------------------------------------------------------ */

async function fetchCfiaRecalls(maxRecords: number): Promise<CfiaRecall[]> {
  const records: CfiaRecall[] = [];
  const now = new Date().toISOString();

  // Try the Healthy Canadians RSS feed first (real-time)
  try {
    const rssUrl = HEALTH_DATA_SOURCES.CFIA.RECALL_RSS;
    const resp = await httpGet(rssUrl, { timeoutMs: HTTP_TIMEOUT_MS });
    const text = resp.body;

    // Very basic RSS XML parsing — extract <item> elements
    const items = text.split('<item>').slice(1);
    for (const item of items.slice(0, maxRecords)) {
      const title = item.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
      const link = item.match(/<link>([^<]+)<\/link>/)?.[1] ?? '';
      const description = item.match(/<description>([^<]+)<\/description>/)?.[1] ?? '';
      const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? '';

      if (!title) continue;

      const content = title + link + description + pubDate;
      const id = await computeHash(content, 'sha256');

      // Extract brand, product name from title (format: "Brand: product - reason")
      const titleParts = title.split(' - ');
      const brandProduct = titleParts[0] ?? title;
      const reason = titleParts.slice(1).join(' - ') || null;
      const brandParts = brandProduct.split(':');
      const brand = brandParts.length > 1 ? brandParts[0].trim() : null;
      const product = brandParts.length > 1 ? brandParts.slice(1).join(':').trim() : brandProduct;

      records.push({
        id,
        recall_id: null,
        title,
        brand,
        product_type: null,
        product_name: product,
        lot_number: null,
        upc: null,
        reason,
        hazard_classification: null,
        recall_status: 'active',
        classification: null,
        company: brand,
        province_distribution: null,
        distribution: null,
        recall_date: pubDate || null,
        source_url: link || rssUrl,
        ingested_at: now,
      });
    }
  } catch {
    // Fall back to CKAN if RSS fails
  }

  // Supplement with CKAN data
  const packages = await searchCkanPackages('canadian food inspection agency recalls', DEFAULT_CKAN_ROWS);
  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const title = String(r.title ?? r.recall_title ?? r.RecallTitle ?? '');
          const product = String(r.product_name ?? r.product ?? r.ProductName ?? '');
          if (!title && !product) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          // Deduplicate by checking if we already have this id
          if (records.some((rec) => rec.id === id)) continue;

          records.push({
            id,
            recall_id: String(r.recall_id ?? r.RecallID ?? '') || null,
            title: title || product,
            brand: String(r.brand ?? r.Brand ?? r.manufacturer ?? '') || null,
            product_type: String(r.product_type ?? r.category ?? '') || null,
            product_name: product || title,
            lot_number: String(r.lot_number ?? r.lot ?? '') || null,
            upc: String(r.upc ?? r.UPC ?? '') || null,
            reason: String(r.reason ?? r.ReasonForRecall ?? '') || null,
            hazard_classification: String(r.hazard_classification ?? r.HazardClassification ?? '') || null,
            recall_status: String(r.recall_status ?? r.status ?? '') || null,
            classification: String(r.classification ?? r.Classification ?? '') || null,
            company: String(r.company ?? r.company_name ?? r.Company ?? '') || null,
            province_distribution: String(r.province_distribution ?? '') || null,
            distribution: String(r.distribution ?? '') || null,
            recall_date: String(r.recall_date ?? r.date ?? r.DateOfRecall ?? '') || null,
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
        }
      } catch {
        // skip
      }
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  CFIA: Import Refusals                                              */
/* ------------------------------------------------------------------ */

async function fetchCfiaImportRefusals(maxRecords: number): Promise<CfiaImportRefusal[]> {
  const packages = await searchCkanPackages('cfia import refusals', DEFAULT_CKAN_ROWS);
  const records: CfiaImportRefusal[] = [];
  const now = new Date().toISOString();

  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const product = String(r.product_name ?? r.product ?? r.ProductName ?? r.ProductDescription ?? '');
          if (!product) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            refusal_date: String(r.refusal_date ?? r.refusalDate ?? r.Date ?? '') || null,
            country_of_origin: String(r.country_of_origin ?? r.CountryOfOrigin ?? r.country ?? '') || null,
            manufacturer: String(r.manufacturer ?? r.Manufacturer ?? r.company ?? '') || null,
            product_type: String(r.product_type ?? r.ProductType ?? r.category ?? '') || null,
            product_sub_type: String(r.product_sub_type ?? r.sub_category ?? '') || null,
            product_name: product,
            reason: String(r.reason ?? r.ReasonForRefusal ?? r.refusal_reason ?? '') || null,
            import_city: String(r.import_city ?? r.city ?? r.City ?? '') || null,
            import_province: String(r.import_province ?? r.province ?? r.Province ?? '') || null,
            cfia_office: String(r.cfia_office ?? r.office ?? r.CFIAOffice ?? '') || null,
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
        }
      } catch {
        // skip
      }
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  CFIA: Food Establishment Inspections                               */
/* ------------------------------------------------------------------ */

async function fetchCfiaInspections(maxRecords: number): Promise<CfiaInspection[]> {
  const packages = await searchCkanPackages('cfia food establishment inspection', DEFAULT_CKAN_ROWS);
  const records: CfiaInspection[] = [];
  const now = new Date().toISOString();

  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const name = String(r.establishment_name ?? r.name ?? r.EstablishmentName ?? r.establishment ?? '');
          if (!name) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            establishment_name: name,
            establishment_address: String(r.establishment_address ?? r.address ?? '') || null,
            establishment_city: String(r.establishment_city ?? r.city ?? r.City ?? '') || null,
            establishment_province: String(r.establishment_province ?? r.province ?? r.Province ?? '') || null,
            establishment_type: String(r.establishment_type ?? r.type ?? r.EstablishmentType ?? '') || null,
            inspection_date: String(r.inspection_date ?? r.date ?? r.InspectionDate ?? '') || null,
            inspection_type: String(r.inspection_type ?? r.InspectionType ?? r.type_of_inspection ?? '') || null,
            outcome: String(r.outcome ?? r.Outcome ?? r.result ?? '') || null,
            non_compliant: r.non_compliant ? parseInt(String(r.non_compliant), 10) : null,
            critical_violations: r.critical_violations ? parseInt(String(r.critical_violations), 10) : null,
            non_critical_violations: r.non_critical_violations ? parseInt(String(r.non_critical_violations), 10) : null,
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
        }
      } catch {
        // skip
      }
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

export async function initializeCfiaTables(db: D1Database): Promise<void> {
  await db.exec(CFIA_RECALLS_DDL);
  await db.exec(CFIA_IMPORT_REFUSALS_DDL);
  await db.exec(CFIA_INSPECTIONS_DDL);
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

export async function ingestCfiaRecalls(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchCfiaRecalls(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'recall_id', 'title', 'brand', 'product_type', 'product_name',
        'lot_number', 'upc', 'reason', 'hazard_classification', 'recall_status',
        'classification', 'company', 'province_distribution', 'distribution',
        'recall_date', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_cfia_recalls', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`CFIA recalls: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestCfiaImportRefusals(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchCfiaImportRefusals(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'refusal_date', 'country_of_origin', 'manufacturer',
        'product_type', 'product_sub_type', 'product_name', 'reason',
        'import_city', 'import_province', 'cfia_office', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_cfia_import_refusals', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`CFIA import refusals: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestCfiaInspections(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchCfiaInspections(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'establishment_name', 'establishment_address',
        'establishment_city', 'establishment_province', 'establishment_type',
        'inspection_date', 'inspection_type', 'outcome', 'non_compliant',
        'critical_violations', 'non_critical_violations', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_cfia_inspections', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`CFIA inspections: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestAllCfia(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const results = await Promise.all([
    ingestCfiaRecalls(db, maxRecords),
    ingestCfiaImportRefusals(db, maxRecords),
    ingestCfiaInspections(db, maxRecords),
  ]);

  return {
    found: results.reduce((s, r) => s + r.found, 0),
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    errors: results.flatMap((r) => r.errors),
  };
}
