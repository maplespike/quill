// SPDX-License-Identifier: AGPL-3.0-only
/**
 * UN Data Ingestion — Quill
 *
 * Orchestrates UNdata ingestion across all major statistical
 * databases via the SDMX REST API.
 *
 * Covers 10+ top databases across population, trade, development,
 * environment, health, education, energy, and finance.
 */

import { computeHash } from '../../verification/hashing.js';
import { fetchDatasetXml, extractSeriesFromSdmx, extractObsFromSeries, extractSeriesKeyValue } from './api.js';
import {
  UN_DATABASES,
  UN_TOP_DATABASES,
  UN_DATABASE_CATEGORIES,
  UN_DATABASES_BY_CATEGORY,
  unDataExplorerUrl,
  unDatabaseName,
  UN_DEFAULT_TIMEOUT_MS,
} from './constants.js';
import type {
  UnRecord,
  UnDataCategory,
  UnIngestionResult,
  UnAllDatabasesResult,
  SdmxObs,
} from './types.js';

export async function ingestUnDataset(
  dataflowId: string,
  options: {
    key?: string;
    startTime?: string;
    endTime?: string;
    timeoutMs?: number;
  } = {},
): Promise<UnIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const databaseName = unDatabaseName(dataflowId);
  const sourceUrl = unDataExplorerUrl(dataflowId);
  const timeoutMs = options.timeoutMs ?? UN_DEFAULT_TIMEOUT_MS;

  try {
    const message = await fetchDatasetXml(dataflowId, {
      key: options.key,
      startTime: options.startTime,
      endTime: options.endTime,
      timeoutMs,
    });

    const allSeries = extractSeriesFromSdmx(message);
    if (allSeries.length === 0) {
      return {
        databaseCode: dataflowId,
        databaseName,
        recordsFound: 0,
        recordsIngested: 0,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    let recordCount = 0;
    for (const series of allSeries) {
      const dims = extractSeriesKeyValue(series);
      const obs = extractObsFromSeries(series);
      for (const ob of obs) {
        const rec = parseUnObs(ob, dims, dataflowId, databaseName, sourceUrl);
        if (rec !== null) recordCount++;
      }
    }

    return {
      databaseCode: dataflowId,
      databaseName,
      recordsFound: allSeries.reduce((sum, s) => sum + extractObsFromSeries(s).length, 0),
      recordsIngested: recordCount,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      databaseCode: dataflowId,
      databaseName,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

export async function ingestByDatabase(
  category: UnDataCategory,
  options: { timeoutMs?: number } = {},
): Promise<UnAllDatabasesResult> {
  const start = Date.now();
  const databases = UN_DATABASES_BY_CATEGORY[category];
  const results: UnIngestionResult[] = [];
  let totalRecords = 0;
  let totalErrors = 0;

  for (const code of databases) {
    const result = await ingestUnDataset(code, options);
    results.push(result);
    totalRecords += result.recordsIngested;
    totalErrors += result.errors.length;
  }

  return {
    results,
    totalRecords,
    totalErrors,
    durationMs: Date.now() - start,
  };
}

export async function ingestAllUn(
  options: { timeoutMs?: number } = {},
): Promise<UnAllDatabasesResult> {
  const start = Date.now();
  const results: UnIngestionResult[] = [];
  let totalRecords = 0;
  let totalErrors = 0;
  const timeoutMs = options.timeoutMs ?? UN_DEFAULT_TIMEOUT_MS;

  const batchSize = 5;
  for (let i = 0; i < UN_TOP_DATABASES.length; i += batchSize) {
    const batch = UN_TOP_DATABASES.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((code) => ingestUnDataset(code, { timeoutMs })),
    );

    for (const result of batchResults) {
      results.push(result);
      totalRecords += result.recordsIngested;
      totalErrors += result.errors.length;
    }
  }

  return {
    results,
    totalRecords,
    totalErrors,
    durationMs: Date.now() - start,
  };
}

export function parseUnObs(
  obs: SdmxObs,
  dimensions: Record<string, string>,
  databaseCode: string,
  databaseName: string,
  sourceUrl: string,
): UnRecord | null {
  const obsDimension = obs['generic:ObsDimension'] ?? obs['ObsDimension'];
  const obsValue = obs['generic:ObsValue'] ?? obs['ObsValue'];

  const timePeriod = String(obsDimension?.['@value'] ?? obsDimension?.value ?? dimensions['TIME_PERIOD'] ?? '');
  const rawValue = obsValue?.['@value'] ?? obsValue?.value;

  if (!timePeriod) return null;

  const year = parseInt(String(timePeriod).substring(0, 4), 10);
  if (isNaN(year)) return null;

  const value = rawValue != null && rawValue !== '' ? parseFloat(String(rawValue)) : null;
  if (rawValue != null && rawValue !== '' && isNaN(value ?? 0)) return null;

  const category = UN_DATABASE_CATEGORIES[databaseCode] ?? 'development';
  const now = new Date().toISOString();

  const refArea = dimensions['REF_AREA'] ?? dimensions['FREQ'] ?? '';
  const refAreaName = dimensions['REF_AREA_NAME'] ?? refArea;

  const seriesParts = Object.entries(dimensions)
    .filter(([k]) => k !== 'TIME_PERIOD')
    .map(([k, v]) => `${k}=${v}`)
    .join('|');

  const content = JSON.stringify({
    databaseCode,
    refArea,
    timePeriod,
    value,
    seriesKey: seriesParts,
  });
  const id = String(computeHash(content, 'sha256'));

  return {
    id,
    databaseCode,
    databaseName,
    category,
    value,
    refArea,
    refAreaName,
    timePeriod,
    year,
    seriesKey: seriesParts,
    unit: dimensions['UNIT'] ?? null,
    obsStatus: dimensions['OBS_STATUS'] ?? null,
    ingestedAt: now,
    sourceUrl,
  };
}

export { parseUnRecord, parseUnRecords, normalizeDate, parseNumeric } from './parser.js';
export {
  UN_DATABASES,
  UN_DATABASES_BY_CATEGORY,
  UN_DATABASE_CATEGORIES,
  UN_TOP_DATABASES,
  UN_DATABASE_NAMES,
  unDataUrl,
  unDataExplorerUrl,
} from './constants.js';
