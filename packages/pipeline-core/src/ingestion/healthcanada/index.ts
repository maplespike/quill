/**
 * Health Canada Ingestion — MapleSpike Pipeline
 *
 * Orchestrates Health Canada recall and advisory data ingestion from
 * multiple Health Canada sources.
 *
 * Pipeline:
 *   1. Fetch recalls and advisories from Health Canada portals
 *   2. Parse raw records into structured HealthCanadaRecall objects
 *   3. Categorize by recall type and risk level
 *   4. Persist to database
 *   5. Enable search and cross-referencing
 *
 * Designed for cron-based ingestion and ad-hoc queries.
 */

import { fetchHealthCanadaRecalls, fetchFromCKANPackage } from './fetcher.js';
import { parseHealthCanadaRecords } from './parser.js';
import { upsertHealthCanadaRecalls, getHighRiskHealthCanadaRecalls } from './db.js';
import { HEALTH_CANADA_SOURCES, HEALTH_CANADA_CATEGORIES } from './constants.js';
import type { HealthCanadaRecall, HealthCanadaIngestionResult, HealthCanadaCategory, HealthCanadaRiskLevel } from './types.js';

/**
 * Ingest Health Canada recalls into the database.
 *
 * Steps:
 *   1. Fetch from Health Canada CKAN
 *   2. Parse raw records
 *   3. Categorize recalls
 *   4. Persist to database
 */
export async function ingestHealthCanadaRecalls(
  db: any,
  options: {
    /** Limit records per source */
    limit?: number;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Only specific CKAN package IDs */
    ckanPackageIds?: string[];
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<HealthCanadaIngestionResult> {
  const startTime = Date.now();
  const result: HealthCanadaIngestionResult = {
    source: 'healthcanada-recalls',
    recordsFound: 0,
    recordsIngested: 0,
    categoriesFound: {
      food: 0,
      drug: 0,
      device: 0,
      consumer: 0,
      advisory: 0,
    },
    riskLevelsFound: {
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    },
    highRiskCount: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[Health Canada] Fetching recalls from CKAN...');
    const fetched = await fetchHealthCanadaRecalls({
      limit: options.limit,
      ckanPackageId: options.ckanPackageIds?.[0],
    });

    result.recordsFound = fetched.records.length;
    log(`[Health Canada] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[Health Canada] No records found from any source');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log('[Health Canada] Parsing raw records...');
    const recalls = parseHealthCanadaRecords(fetched.records, {
      sourceSystem: fetched.source,
      category: 'food',
    });

    log(`[Health Canada] Parsed ${recalls.length} structured recalls`);

    // Categorize
    for (const recall of recalls) {
      result.categoriesFound[recall.category]++;
      result.riskLevelsFound[recall.riskLevel]++;

      if (recall.riskLevel === 'high' || recall.riskLevel === 'critical') {
        result.highRiskCount++;
      }
    }

    // Persist to database
    if (db) {
      log('[Health Canada] Persisting to database...');
      const dbResult = await upsertHealthCanadaRecalls(db, recalls);
      result.recordsIngested = dbResult.recordsAffected;

      if (!dbResult.success) {
        result.errors.push(dbResult.message);
      }
    } else {
      log('[Health Canada] No database provided, skipping persistence');
      result.recordsIngested = recalls.length;
    }

    log(`[Health Canada] Ingestion complete: ${result.recordsIngested}/${result.recordsFound} records`);

  } catch (error) {
    result.errors.push(`Ingestion error: ${error}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Ingest all Health Canada modules (food, drug, device, consumer, advisories).
 */
export async function ingestAllHealthCanada(
  db: any,
  options: {
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<HealthCanadaIngestionResult[]> {
  const results: HealthCanadaIngestionResult[] = [];

  const log = options.onProgress ?? (() => {});

  for (const category of HEALTH_CANADA_CATEGORIES) {
    log(`[Health Canada] Processing category: ${category}`);
    const result = await ingestHealthCanadaRecalls(db, {
      ...options,
    });
    results.push(result);
  }

  return results;
}

/**
 * Registry export: ingestHealthCanada - wrapper for full Health Canada ingestion.
 */
export async function ingestHealthCanada(
  db: any,
  options?: {
    limit?: number;
    force?: boolean;
    onProgress?: (msg: string) => void;
  },
): Promise<HealthCanadaIngestionResult[]> {
  return ingestAllHealthCanada(db, options);
}

/**
 * Registry export: searchHealthCanadaRecords - search by keyword.
 */
export function searchHealthCanadaRecords(
  db: any,
  query: string,
): Promise<HealthCanadaRecall[]> {
  // Placeholder - in production would query DB
  return Promise.resolve([]);
}

/**
 * Registry export: getHealthCanadaRecallsBySeverity - get by severity level.
 */
export async function getHealthCanadaRecallsBySeverity(
  db: any,
  severity: 'low' | 'moderate' | 'high' | 'critical',
  limit: number = 100,
): Promise<HealthCanadaRecall[]> {
  // Placeholder - in production would query DB
  return Promise.resolve([]);
}

/**
 * Get high-risk Health Canada recalls.
 */
export async function getHighRiskRecalls(db: any, limit: number = 100): Promise<HealthCanadaRecall[]> {
  return getHighRiskHealthCanadaRecalls(db, limit);
}

/**
 * Search Health Canada recalls by keyword (memory-based).
 */
export function searchHealthCanadaRecalls(
  recalls: HealthCanadaRecall[],
  query: string,
): HealthCanadaRecall[] {
  const lowerQuery = query.toLowerCase();

  return recalls.filter(recall =>
    String(recall.productName).toLowerCase().includes(lowerQuery) ||
    String(recall.company).toLowerCase().includes(lowerQuery) ||
    String(recall.hazard).toLowerCase().includes(lowerQuery),
  );
}

/**
 * Get Health Canada recalls by category.
 */
export function getRecallsByCategory(
  recalls: HealthCanadaRecall[],
  category: HealthCanadaCategory,
): HealthCanadaRecall[] {
  return recalls.filter(recall => recall.category === category);
}

/**
 * Get Health Canada recalls by risk level (memory-based).
 */
export function getRecallsByRiskLevel(
  recalls: HealthCanadaRecall[],
  riskLevel: HealthCanadaRiskLevel,
): HealthCanadaRecall[] {
  return recalls.filter(recall => recall.riskLevel === riskLevel);
}