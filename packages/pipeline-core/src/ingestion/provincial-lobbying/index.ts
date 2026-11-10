// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Lobbying Ingestion — Quill
 *
 * Orchestrates provincial lobbying registry data ingestion across
 * Canadian provinces. Starts with Ontario (the largest and most active
 * provincial lobbying registry) and provides hooks for additional provinces.
 *
 * Pipeline:
 *   1. Fetch raw records from provincial registry (CKAN CSV, HTML search, API)
 *   2. Parse and normalize to federal LobbyingRecord schema
 *   3. Persist to D1 database with province discrimination
 *   4. Enable search and cross-jurisdiction queries
 *
 * Cross-jurisdiction queries allow tracing companies that lobby both
 * federally AND provincially on the same issue.
 *
 * Designed for cron-based ingestion and ad-hoc queries.
 */

import { fetchOntarioLobbying, fetchOntarioMonthlyReports, searchOntarioRegistry } from './fetcher.js';
import { fetchBCLobbying } from './fetchers/bc.js';
import { fetchAlbertaLobbying } from './fetchers/ab.js';
import { fetchQuebecLobbying } from './fetchers/qc.js';
import { fetchSKLobbying } from './fetchers/sk.js';
import { fetchMBLobbying } from './fetchers/mb.js';
import { fetchNSLobbying } from './fetchers/ns.js';
import { fetchNBLobbying } from './fetchers/nb.js';
import { fetchNLLobbying } from './fetchers/nl.js';
import { fetchPELobbying } from './fetchers/pe.js';
import { fetchYTLobbying } from './fetchers/yt.js';
import { fetchNTLobbying } from './fetchers/nt.js';
import { fetchNULobbying } from './fetchers/nu.js';
import { normalizeBatch, normalizeToFederalSchema } from './parser.js';
import { PROVINCE_CONFIGS } from './types.js';
import { ONTARIO_LOBBYING } from './constants.js';
import type { ProvincialLobbyingRecord, Province, ProvinceConfig, ProvincialIngestionResult, RawOntarioRecord, RawBCRecord, RawAlbertaRecord, RawQuebecRecord, RawSaskatchewanRecord, RawManitobaRecord, RawNovaScotiaRecord, RawNewBrunswickRecord, RawNewfoundlandRecord, RawPEIRecord, RawYukonRecord, RawNWTRecord, RawNunavutRecord } from './types.js';
import type { D1Database } from '../committees/db.js';


/**
 * Ingest Ontario lobbying records into the database.
 *
 * Steps:
 *   1. Fetch raw records from Ontario sources (CKAN, HTML search)
 *   2. Normalize to federal schema
 *   3. Persist to D1 database
 */
export async function ingestOntarioLobbying(
  db: D1Database | null,
  options: {
    /** Limit records per source */
    limit?: number;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Search query filter (optional) */
    query?: string;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'ontario-lobbying',
    province: 'ON',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Phase 1: Fetch raw records
    log('[ON-Lobbying] Fetching Ontario lobbying records...');
    const fetched = await fetchOntarioLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[ON-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[ON-Lobbying] No records found. Trying alternative sources...');

      // Fall back to monthly reports metadata
      const reports = await fetchOntarioMonthlyReports();
      log(`[ON-Lobbying] Found ${reports.length} monthly report links`);

      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Phase 2: Normalize records
    log('[ON-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('ON', fetched.records, {
      sourceSystem: fetched.source === 'ckan' ? 'ontario-ckan' : 'ontario-registry',
    });
    log(`[ON-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    // Phase 3: Persist to database
    if (db) {
      log('[ON-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          // Check for existing record unless force flag
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) {
              continue;
            }
          }

          // Upsert record
          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id,
            record.province,
            record.registrantName,
            record.registrantClient,
            record.registrantAddress,
            record.clientName,
            record.clientBusiness,
            record.subjectMatter.join('; '),
            record.governmentInstitution,
            record.publicOfficeHolder,
            record.communicationDate,
            record.startDate,
            record.endDate,
            record.lobbyingCostCad,
            record.lobbyistType,
            record.sourceUrl,
            record.originalId,
            record.sourceSystem,
            record.ingestedAt,
          ).run();

          result.recordsIngested++;

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }

      log(`[ON-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      // No DB — just return the data count
      result.recordsIngested = normalized.length;
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[ON-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;

  log(`[ON-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}


/**
 * Ingest British Columbia lobbying records into the database.
 */
export async function ingestBCLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'bc-lobbying',
    province: 'BC',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[BC-Lobbying] Fetching BC lobbying records...');
    const fetched = await fetchBCLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[BC-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[BC-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[BC-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('BC', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'bc-registry',
    });
    log(`[BC-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[BC-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[BC-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[BC-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[BC-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Alberta lobbying records into the database.
 */
export async function ingestAlbertaLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'ab-lobbying',
    province: 'AB',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[AB-Lobbying] Fetching Alberta lobbying records...');
    const fetched = await fetchAlbertaLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[AB-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[AB-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[AB-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('AB', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'alberta-registry',
    });
    log(`[AB-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[AB-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[AB-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[AB-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[AB-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Quebec lobbying records into the database.
 */
export async function ingestQuebecLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'qc-lobbying',
    province: 'QC',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[QC-Lobbying] Fetching Quebec lobbying records...');
    const fetched = await fetchQuebecLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[QC-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[QC-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[QC-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('QC', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'quebec-registry',
    });
    log(`[QC-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[QC-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[QC-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[QC-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[QC-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Saskatchewan lobbying records into the database.
 */
export async function ingestSaskatchewanLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'sk-lobbying',
    province: 'SK',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[SK-Lobbying] Fetching Saskatchewan lobbying records...');
    const fetched = await fetchSKLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[SK-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[SK-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[SK-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('SK', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'saskatchewan-registry',
    });
    log(`[SK-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[SK-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[SK-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[SK-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[SK-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Manitoba lobbying records into the database.
 */
export async function ingestManitobaLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'mb-lobbying',
    province: 'MB',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[MB-Lobbying] Fetching Manitoba lobbying records...');
    const fetched = await fetchMBLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[MB-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[MB-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[MB-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('MB', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'manitoba-registry',
    });
    log(`[MB-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[MB-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[MB-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[MB-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[MB-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Nova Scotia lobbying records into the database.
 */
export async function ingestNovaScotiaLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'ns-lobbying',
    province: 'NS',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[NS-Lobbying] Fetching Nova Scotia lobbying records...');
    const fetched = await fetchNSLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[NS-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[NS-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[NS-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('NS', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'nova-scotia-registry',
    });
    log(`[NS-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[NS-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[NS-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[NS-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[NS-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest New Brunswick lobbying records into the database.
 */
export async function ingestNewBrunswickLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'nb-lobbying',
    province: 'NB',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[NB-Lobbying] Fetching New Brunswick lobbying records...');
    const fetched = await fetchNBLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[NB-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[NB-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[NB-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('NB', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'new-brunswick-registry',
    });
    log(`[NB-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[NB-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[NB-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[NB-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[NB-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Newfoundland and Labrador lobbying records into the database.
 */
export async function ingestNewfoundlandLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'nl-lobbying',
    province: 'NL',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[NL-Lobbying] Fetching Newfoundland and Labrador lobbying records...');
    const fetched = await fetchNLLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[NL-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[NL-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[NL-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('NL', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'newfoundland-registry',
    });
    log(`[NL-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[NL-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[NL-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[NL-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[NL-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Prince Edward Island lobbying records into the database.
 */
export async function ingestPEILobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'pe-lobbying',
    province: 'PE',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[PE-Lobbying] Fetching Prince Edward Island lobbying records...');
    const fetched = await fetchPELobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[PE-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[PE-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[PE-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('PE', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'pei-registry',
    });
    log(`[PE-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[PE-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[PE-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[PE-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[PE-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Yukon lobbying records into the database.
 */
export async function ingestYukonLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'yt-lobbying',
    province: 'YT',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[YT-Lobbying] Fetching Yukon lobbying records...');
    const fetched = await fetchYTLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[YT-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[YT-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[YT-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('YT', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'yukon-registry',
    });
    log(`[YT-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[YT-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[YT-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[YT-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[YT-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Northwest Territories lobbying records into the database.
 */
export async function ingestNWTLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'nt-lobbying',
    province: 'NT',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[NT-Lobbying] Fetching Northwest Territories lobbying records...');
    const fetched = await fetchNTLobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[NT-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[NT-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[NT-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('NT', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'nt-no-registry',
    });
    log(`[NT-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[NT-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[NT-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[NT-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[NT-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Ingest Nunavut lobbying records into the database.
 */
export async function ingestNunavutLobbying(
  db: D1Database | null,
  options: {
    limit?: number;
    force?: boolean;
    query?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProvincialIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialIngestionResult = {
    source: 'nu-lobbying',
    province: 'NU',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[NU-Lobbying] Fetching Nunavut lobbying records...');
    const fetched = await fetchNULobbying({
      query: options.query,
      limit: options.limit,
    });

    result.recordsFound = fetched.records.length;
    log(`[NU-Lobbying] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[NU-Lobbying] No records found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[NU-Lobbying] Normalizing records to federal schema...');
    const normalized = await normalizeBatch('NU', fetched.records as unknown as RawOntarioRecord[], {
      sourceSystem: 'nu-no-registry',
    });
    log(`[NU-Lobbying] Normalized ${normalized.length} provincial lobbying records`);

    if (db) {
      log('[NU-Lobbying] Persisting to database...');
      for (const record of normalized) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM provincial_lobbying WHERE id = ? LIMIT 1',
            ).bind(record.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO provincial_lobbying
              (id, province, registrant_name, registrant_client, registrant_address,
               client_name, client_business, subject_matter, government_institution,
               public_office_holder, communication_date, start_date, end_date,
               lobbying_cost_cad, lobbyist_type, source_url, original_id,
               source_system, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            record.id, record.province, record.registrantName, record.registrantClient,
            record.registrantAddress, record.clientName, record.clientBusiness,
            record.subjectMatter.join('; '), record.governmentInstitution,
            record.publicOfficeHolder, record.communicationDate, record.startDate,
            record.endDate, record.lobbyingCostCad, record.lobbyistType,
            record.sourceUrl, record.originalId, record.sourceSystem, record.ingestedAt,
          ).run();

          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${record.id}: ${msg}`);
        }
      }
      log(`[NU-Lobbying] Persisted ${result.recordsIngested} records`);
    } else {
      result.recordsIngested = normalized.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[NU-Lobbying] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[NU-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  return result;
}


/**
 * Search provincial lobbying records in the database.
 */
export async function searchProvincialLobbying(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    province?: Province;
    lobbyistType?: string;
  } = {},
): Promise<ProvincialLobbyingRecord[]> {
  let sql = `
    SELECT * FROM provincial_lobbying
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      registrant_name LIKE ? OR
      client_name LIKE ? OR
      client_business LIKE ? OR
      subject_matter LIKE ? OR
      government_institution LIKE ? OR
      public_office_holder LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q, q);
  }

  if (options.province) {
    sql += ' AND province = ?';
    params.push(options.province);
  }

  if (options.lobbyistType) {
    sql += ' AND lobbyist_type = ?';
    params.push(options.lobbyistType);
  }

  sql += ` ORDER BY communication_date DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<ProvincialLobbyingRecord>();
  return result.results ?? [];
}

/**
 * Search specifically in Ontario lobbying records.
 */
export async function searchOntario(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    name?: string;
    organization?: string;
  } = {},
): Promise<ProvincialLobbyingRecord[]> {
  // First: try the online registry for real-time results
  try {
    if (!db) {
      const onlineResults = await searchOntarioRegistry(query);
      if (onlineResults.length > 0) {
        // Normalize online results and return
        const normalized = await normalizeBatch('ON', onlineResults, {
          sourceSystem: 'ontario-registry-query',
        });
        return normalized;
      }
    }
  } catch {
    // Fall through to DB search
  }

  // Second: search the local database
  let sql = `
    SELECT * FROM provincial_lobbying
    WHERE province = 'ON'
  `;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      registrant_name LIKE ? OR
      client_name LIKE ? OR
      client_business LIKE ? OR
      subject_matter LIKE ? OR
      government_institution LIKE ? OR
      public_office_holder LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q, q);
  }

  if (options.name) {
    sql += ' AND (registrant_name LIKE ? OR public_office_holder LIKE ?)';
    const n = `%${options.name}%`;
    params.push(n, n);
  }

  if (options.organization) {
    sql += ' AND (client_name LIKE ? OR government_institution LIKE ?)';
    const org = `%${options.organization}%`;
    params.push(org, org);
  }

  sql += ` ORDER BY communication_date DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<ProvincialLobbyingRecord>();
  return result.results ?? [];
}


/**
 * Find records where the same client/registrant appears in both federal
 * and provincial lobbying registries.
 *
 * Requires both lobbying_records and provincial_lobbying tables.
 */
export async function findCrossJurisdictionActivity(
  db: D1Database,
  options: {
    limit?: number;
    province?: Province;
    clientName?: string;
  } = {},
): Promise<Array<{
  clientName: string;
  federalRecords: number;
  provincialRecords: number;
  provinces: string[];
  latestCommunicationDate: string | null;
}>> {
  let sql = `
    SELECT
      COALESCE(pl.client_name, lr.client_name) as client_name,
      COUNT(DISTINCT lr.id) as federal_record_count,
      COUNT(DISTINCT pl.id) as provincial_record_count,
      GROUP_CONCAT(DISTINCT pl.province) as provinces,
      MAX(COALESCE(pl.communication_date, lr.communication_date)) as latest_date
    FROM provincial_lobbying pl
    FULL OUTER JOIN lobbying_records lr ON (
      lr.client_name = pl.client_name
      OR lr.registrant_name = pl.registrant_name
    )
    WHERE (pl.id IS NOT NULL AND lr.id IS NOT NULL)
  `;
  const params: unknown[] = [];

  if (options.province) {
    sql += ' AND pl.province = ?';
    params.push(options.province);
  }

  if (options.clientName) {
    sql += ' AND (pl.client_name LIKE ? OR lr.client_name LIKE ?)';
    const c = `%${options.clientName}%`;
    params.push(c, c);
  }

  sql += `
    GROUP BY client_name
    HAVING federal_record_count > 0 AND provincial_record_count > 0
    ORDER BY latest_date DESC
    LIMIT ?
  `;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<any>();
  return (result.results ?? []).map((r: any) => ({
    clientName: r.client_name,
    federalRecords: r.federal_record_count,
    provincialRecords: r.provincial_record_count,
    provinces: r.provinces ? r.provinces.split(',') : [],
    latestCommunicationDate: r.latest_date,
  }));
}


/**
 * Run ingestion for all configured provinces.
 * All 13 provinces and territories
 */
export async function ingestAllProvincial(
  db: D1Database | null,
  options: {
    /** Limit records per province */
    limit?: number;
    /** Force re-ingestion */
    force?: boolean;
    /** Specific provinces to ingest (default: all) */
    provinces?: Province[];
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, ProvincialIngestionResult>> {
  const log = options.onProgress ?? (() => {});

  log('=== Provincial Lobbying Ingestion ===');

  const results: Record<string, ProvincialIngestionResult> = {};

  // Determine which provinces to process
  const configuredProvinces = getConfiguredProvinces();
  const provincesToProcess = options.provinces
    ? configuredProvinces.filter(p => options.provinces!.includes(p.code))
    : configuredProvinces;

  log(`Configured provinces: ${provincesToProcess.map(p => p.code).join(', ')}`);

  for (const config of provincesToProcess) {
    log(`\n--- ${config.name} (${config.code}) ---`);

    switch (config.code) {
      case 'ON':
        results[config.code] = await ingestOntarioLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'BC':
        results[config.code] = await ingestBCLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'AB':
        results[config.code] = await ingestAlbertaLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'QC':
        results[config.code] = await ingestQuebecLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'SK':
        results[config.code] = await ingestSaskatchewanLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'MB':
        results[config.code] = await ingestManitobaLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'NS':
        results[config.code] = await ingestNovaScotiaLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'NB':
        results[config.code] = await ingestNewBrunswickLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'NL':
        results[config.code] = await ingestNewfoundlandLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'PE':
        results[config.code] = await ingestPEILobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'YT':
        results[config.code] = await ingestYukonLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'NT':
        results[config.code] = await ingestNWTLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      case 'NU':
        results[config.code] = await ingestNunavutLobbying(db, {
          limit: options.limit,
          force: options.force,
          onProgress: options.onProgress,
        });
        break;

      default:
        log(`[${config.code}] Not yet implemented — skipping`);
        results[config.code] = {
          source: `${(config.code as string).toLowerCase()}-lobbying`,
          province: config.code,
          recordsFound: 0,
          recordsIngested: 0,
          errors: [],
          durationMs: 0,
        };
        break;
    }

    const r = results[config.code];
    log(`${config.code}: ${r.recordsIngested}/${r.recordsFound} ingested` +
      (r.errors.length > 0 ? ` (${r.errors.length} errors)` : ''));
  }

  // Summary
  log(`\n=== Provincial Summary ===`);
  let totalFound = 0;
  let totalIngested = 0;
  let totalErrors = 0;

  for (const [code, r] of Object.entries(results)) {
    totalFound += r.recordsFound;
    totalIngested += r.recordsIngested;
    totalErrors += r.errors.length;
    log(`${code}: ${r.recordsIngested}/${r.recordsFound} in ${r.durationMs}ms`);
  }

  log(`Total: ${totalIngested}/${totalFound} records` +
    (totalErrors > 0 ? `, ${totalErrors} errors` : ''));

  return results;
}


/**
 * Get all configured provinces that have implementations.
 */
function getConfiguredProvinces(): ProvinceConfig[] {
  return PROVINCE_CONFIGS;
}

/**
 * Get the configuration for a specific province.
 */
export function getProvinceConfig(province: Province): ProvinceConfig | undefined {
  return PROVINCE_CONFIGS.find(p => p.code === province);
}


export type {
  ProvincialLobbyingRecord,
  Province,
  ProvinceConfig,
  ProvincialIngestionResult,
  RawOntarioRecord,
  RawBCRecord,
  RawAlbertaRecord,
  RawQuebecRecord,
  RawSaskatchewanRecord,
  RawManitobaRecord,
  RawNovaScotiaRecord,
  RawNewBrunswickRecord,
  RawNewfoundlandRecord,
  RawPEIRecord,
  RawYukonRecord,
  RawNWTRecord,
  RawNunavutRecord,
} from './types.js';

export {
  PROVINCE_CONFIGS,
} from './types.js';

export {
  ONTARIO_LOBBYING,
  ONTARIO_CKAN,
  ONTARIO_LOBBYING_SUBJECTS,
  BC_LOBBYING,
  ALBERTA_LOBBYING,
  QUEBEC_LOBBYING,
  SASKATCHEWAN_LOBBYING,
  MANITOBA_LOBBYING,
  NOVA_SCOTIA_LOBBYING,
  NEW_BRUNSWICK_LOBBYING,
  NEWFOUNDLAND_LOBBYING,
  PEI_LOBBYING,
  YUKON_LOBBYING,
  NWT_LOBBYING,
  NUNAVUT_LOBBYING,
} from './constants.js';

export {
  fetchOntarioLobbying,
  fetchOntarioMonthlyReports,
  searchOntarioCkanDatasets,
  fetchOntarioCkanPackage,
  searchOntarioRegistry,
} from './fetcher.js';

export {
  fetchBCLobbying,
  searchBCRegistry,
  fetchAlbertaLobbying,
  searchAlbertaRegistry,
  fetchQuebecLobbying,
  searchQuebecRegistry,
  fetchSKLobbying,
  searchSKRegistry,
  fetchMBLobbying,
  searchMBRegistry,
  fetchNSLobbying,
  searchNSRegistry,
  fetchNBLobbying,
  searchNBRegistry,
  fetchNLLobbying,
  searchNLRegistry,
  fetchPELobbying,
  searchPERegistry,
  fetchYTLobbying,
  searchYTRegistry,
  fetchNTLobbying,
  searchNTRegistry,
  fetchNULobbying,
  searchNURegistry,
} from './fetchers/index.js';

export {
  normalizeToFederalSchema,
  normalizeOntarioRecord,
  normalizeOntarioSubjects,
  normalizeBCRecord,
  normalizeAlbertaRecord,
  normalizeQuebecRecord,
  normalizeSaskatchewanRecord,
  normalizeManitobaRecord,
  normalizeNovaScotiaRecord,
  normalizeNewBrunswickRecord,
  normalizeNewfoundlandRecord,
  normalizePEIRecord,
  normalizeYukonRecord,
  normalizeNWTRecord,
  normalizeNunavutRecord,
  normalizeBatch,
  toFederalRecord,
} from './parser.js';
