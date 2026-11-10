// SPDX-License-Identifier: AGPL-3.0-only
/**
 * PHAC Ingestion — Public Health Agency of Canada
 *
 * Ingests disease surveillance, opioid mortality, immunization coverage,
 * and drug shortage data from the Government of Canada Open Data Portal (CKAN)
 * and Health Infobase direct JSON endpoints.
 *
 * Data sources:
 *   - CKAN: disease surveillance, opioid deaths, immunization, drug shortages
 *   - Health Infobase: direct opioid mortality JSON
 *
 * Pipeline:
 *   1. Search CKAN packages for relevant datasets
 *   2. Fetch resource JSON/CSV content
 *   3. Parse into typed records
 *   4. Deduplicate and persist to D1
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  HEALTH_DATA_SOURCES,
  PHAC_DISEASE_SURVEILLANCE_DDL,
  PHAC_OPIOID_DEATHS_DDL,
  PHAC_IMMUNIZATION_DDL,
  PHAC_DRUG_SHORTAGES_DDL,
  DEFAULT_MAX_RECORDS,
  HTTP_TIMEOUT_MS,
  DEFAULT_CKAN_ROWS,
  HealthDataError,
} from './constants.js';
import type {
  PhacDiseaseSurveillance,
  PhacOpioidDeath,
  PhacImmunization,
  DrugShortage,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Type-safe helpers for unknown row extraction                        */
/* ------------------------------------------------------------------ */

/** Safely extract string or null from an unknown value. */
function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** Safely extract number or null from an unknown value. */
function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const num = Number(v);
  return isNaN(num) ? null : num;
}

/** Safely extract number or undefined (for optional fields like week/month). */
function nu(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const num = Number(v);
  return isNaN(num) ? undefined : num;
}

/** Safely extract string or undefined (for optional string fields like quarter). */
function su(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

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

interface CkanPackage {
  id: string;
  title: string;
  notes?: string;
  resources?: CkanResource[];
  organization?: { name?: string };
}

interface CkanResource {
  id: string;
  name?: string;
  format?: string;
  url?: string;
  package_id?: string;
}

interface CkanSearchResult {
  result?: {
    results?: CkanPackage[];
    count?: number;
  };
}

/**
 * Search CKAN for packages matching a query.
 */
async function searchCkanPackages(
  query: string,
  rows: number = DEFAULT_CKAN_ROWS,
): Promise<CkanPackage[]> {
  const base = HEALTH_DATA_SOURCES.PHAC.BASE;
  const url = `${base}package_search?q=${encodeURIComponent(query)}&rows=${rows}`;
  const resp = await httpGet(url, { timeoutMs: HTTP_TIMEOUT_MS });
  const parsed: CkanSearchResult = JSON.parse(resp.body);
  return parsed?.result?.results ?? [];
}

/**
 * Fetch a JSON resource from a CKAN resource URL.
 */
async function fetchCkanResourceJson(url: string): Promise<unknown[]> {
  const resp = await httpGet(url, { timeoutMs: HTTP_TIMEOUT_MS });
  const parsed = JSON.parse(resp.body);
  // CKAN resources can be arrays or wrapped in result/results
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.result?.results && Array.isArray(parsed.result.results)) return parsed.result.results;
  if (parsed?.results && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

/* ------------------------------------------------------------------ */
/*  PHAC: Disease Surveillance                                         */
/* ------------------------------------------------------------------ */

async function fetchPhacDiseaseSurveillance(maxRecords: number): Promise<PhacDiseaseSurveillance[]> {
  const packages = await searchCkanPackages('public health agency disease surveillance', DEFAULT_CKAN_ROWS);
  const records: PhacDiseaseSurveillance[] = [];
  const now = new Date().toISOString();

  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const disease = String(r.disease ?? r.disease_name ?? r.disease_en ?? r.Disease ?? '');
          const year = parseInt(String(r.year ?? r.Year ?? r.report_year ?? '0'), 10);
          if (!disease || !year) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            disease,
            year,
            week: nu(r.week),
            cases: n(r.cases ?? r.total_cases ?? r.cases_reported),
            cumulative_cases: n(r.cumulative_cases ?? r.cumulative),
            province: s(r.province ?? r.province_territory ?? r.location),
            age_group: s(r.age_group ?? r.age),
            sex: s(r.sex),
            hospitalization: n(r.hospitalization ?? r.hospitalizations),
            deaths: n(r.deaths ?? r.fatalities),
            source_url: `https://open.canada.ca/data/dataset/${pkg.id}`,
            ingested_at: now,
          });
        }
      } catch {
        // skip resource that could not be fetched
      }
    }
  }
  return records;
}

/* ------------------------------------------------------------------ */
/*  PHAC: Opioid Deaths                                                */
/* ------------------------------------------------------------------ */

async function fetchPhacOpioidDeaths(maxRecords: number): Promise<PhacOpioidDeath[]> {
  const records: PhacOpioidDeath[] = [];
  const now = new Date().toISOString();

  // Try direct Health Infobase JSON endpoint
  try {
    const infobaseUrl = HEALTH_DATA_SOURCES.PHAC.OPIOID_DETAIL;
    const resp = await httpGet(infobaseUrl, { timeoutMs: HTTP_TIMEOUT_MS });
    const data = JSON.parse(resp.body);
    const rows = Array.isArray(data) ? data : (data?.data ?? data?.results ?? []);
    for (const row of rows.slice(0, maxRecords)) {
      const r = row as Record<string, unknown>;
      const year = parseInt(String(r.year ?? r.Year ?? r.YEAR ?? '0'), 10);
      if (!year) continue;

      const content = JSON.stringify(r);
      const id = await computeHash(content, 'sha256');

      records.push({
        id,
        year,
        month: nu(r.month),
        quarter: su(r.quarter),
        province: s(r.province ?? r.geo),
        opioid_type: s(r.opioid_type ?? r.substance ?? r.drug_type),
        deaths: n(r.deaths ?? r.total_deaths ?? r.value),
        rate_per_100k: n(r.rate_per_100k ?? r.rate),
        apparent_opioid_toxicities: n(r.apparent_opioid_toxicities),
        apparent_stimulant_toxicities: n(r.apparent_stimulant_toxicities),
        apparent_opioid_stimulant_toxicities: n(r.apparent_opioid_stimulant_toxicities),
        sex: s(r.sex),
        age_group: s(r.age_group ?? r.age_grp),
        source_url: infobaseUrl,
        ingested_at: now,
      });
    }
  } catch {
    // Fall back to CKAN
    const packages = await searchCkanPackages('opioid toxicity deaths', DEFAULT_CKAN_ROWS);
    for (const pkg of packages.slice(0, 3)) {
      const resources = pkg.resources ?? [];
      for (const res of resources.slice(0, 2)) {
        if (!res.url) continue;
        try {
          const rows = await fetchCkanResourceJson(res.url);
          for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
            const r = row as Record<string, unknown>;
            const year = parseInt(String(r.year ?? r.Year ?? '0'), 10);
            if (!year) continue;

            const content = JSON.stringify(r);
            const id = await computeHash(content, 'sha256');

            records.push({
              id,
              year,
              month: nu(r.month),
              quarter: su(r.quarter),
              province: s(r.province ?? r.geo),
              opioid_type: s(r.opioid_type ?? r.substance),
              deaths: n(r.deaths ?? r.value),
              rate_per_100k: n(r.rate_per_100k),
              apparent_opioid_toxicities: null,
              apparent_stimulant_toxicities: null,
              apparent_opioid_stimulant_toxicities: null,
              sex: s(r.sex),
              age_group: s(r.age_group),
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
  return records;
}

/* ------------------------------------------------------------------ */
/*  PHAC: Immunization Coverage                                        */
/* ------------------------------------------------------------------ */

async function fetchPhacImmunization(maxRecords: number): Promise<PhacImmunization[]> {
  const packages = await searchCkanPackages('immunization coverage canada', DEFAULT_CKAN_ROWS);
  const records: PhacImmunization[] = [];
  const now = new Date().toISOString();

  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const vaccine = String(r.vaccine ?? r.vaccine_name ?? r.antigen ?? r.Vaccine ?? '');
          const year = parseInt(String(r.year ?? r.Year ?? r.survey_year ?? '0'), 10);
          const ageGroup = String(r.age_group ?? r.age_grp ?? r.ageGroup ?? '');
          if (!vaccine || !year || !ageGroup) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            vaccine,
            year,
            age_group: ageGroup,
            coverage_percent: n(r.coverage_percent ?? r.coverage ?? r.value),
            province: s(r.province ?? r.geo),
            target_population: n(r.target_population ?? r.population),
            vaccinated: n(r.vaccinated ?? r.number_vaccinated),
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
/*  PHAC: Drug Shortages                                               */
/* ------------------------------------------------------------------ */

async function fetchPhacDrugShortages(maxRecords: number): Promise<DrugShortage[]> {
  const packages = await searchCkanPackages('drug shortage', DEFAULT_CKAN_ROWS);
  const records: DrugShortage[] = [];
  const now = new Date().toISOString();

  for (const pkg of packages.slice(0, 3)) {
    const resources = pkg.resources ?? [];
    for (const res of resources.slice(0, 3)) {
      if (!res.url) continue;
      try {
        const rows = await fetchCkanResourceJson(res.url);
        for (const row of rows.slice(0, Math.floor(maxRecords / 3))) {
          const r = row as Record<string, unknown>;
          const drugName = String(r.drug_name ?? r.brand_name ?? r.medication ?? r.DrugName ?? '');
          if (!drugName) continue;

          const content = JSON.stringify(r);
          const id = await computeHash(content, 'sha256');

          records.push({
            id,
            drug_name: drugName,
            din: s(r.din ?? r.DIN ?? r.drug_identification_number),
            company: s(r.company ?? r.manufacturer ?? r.company_name),
            shortage_reason: s(r.shortage_reason ?? r.reason ?? r.ResonForShortage),
            shortage_date: s(r.shortage_date ?? r.report_date ?? r.Date),
            anticipated_end_date: s(r.anticipated_end_date ?? r.expected_end_date),
            status: s(r.status ?? r.shortage_status ?? r.Status),
            therapeutic_area: s(r.therapeutic_area ?? r.therapeutic_class),
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

export async function initializePhacTables(db: D1Database): Promise<void> {
  await db.exec(PHAC_DISEASE_SURVEILLANCE_DDL);
  await db.exec(PHAC_OPIOID_DEATHS_DDL);
  await db.exec(PHAC_IMMUNIZATION_DDL);
  await db.exec(PHAC_DRUG_SHORTAGES_DDL);
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

export async function ingestPhacDiseaseSurveillance(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchPhacDiseaseSurveillance(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'disease', 'year', 'week', 'cases', 'cumulative_cases',
        'province', 'age_group', 'sex', 'hospitalization', 'deaths', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_phac_surveillance', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`PHAC disease surveillance: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestPhacOpioidDeaths(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchPhacOpioidDeaths(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'year', 'month', 'quarter', 'province', 'opioid_type',
        'deaths', 'rate_per_100k', 'apparent_opioid_toxicities',
        'apparent_stimulant_toxicities', 'apparent_opioid_stimulant_toxicities',
        'sex', 'age_group', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_phac_opioid_deaths', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`PHAC opioid deaths: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestPhacImmunization(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchPhacImmunization(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'vaccine', 'year', 'age_group', 'coverage_percent',
        'province', 'target_population', 'vaccinated', 'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_phac_immunization', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`PHAC immunization: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestPhacDrugShortages(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let inserted = 0;

  try {
    const records = await fetchPhacDrugShortages(maxRecords);
    found = records.length;

    if (db) {
      const columns = ['id', 'drug_name', 'din', 'company', 'shortage_reason',
        'shortage_date', 'anticipated_end_date', 'status', 'therapeutic_area',
        'source_url', 'ingested_at'];

      for (const rec of records) {
        const ok = await upsertGeneric(db, 'health_drug_shortages', columns, rec);
        if (ok) inserted++;
      }
    }
  } catch (err) {
    errors.push(`PHAC drug shortages: ${(err as Error).message}`);
  }

  return { found, inserted, errors };
}

export async function ingestAllPhac(
  db: D1Database | null,
  maxRecords: number = DEFAULT_MAX_RECORDS,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  const results = await Promise.all([
    ingestPhacDiseaseSurveillance(db, maxRecords),
    ingestPhacOpioidDeaths(db, maxRecords),
    ingestPhacImmunization(db, maxRecords),
    ingestPhacDrugShortages(db, maxRecords),
  ]);

  return {
    found: results.reduce((s, r) => s + r.found, 0),
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    errors: results.flatMap((r) => r.errors),
  };
}
