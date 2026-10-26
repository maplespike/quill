// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UNESCO Institute for Statistics (UIS) Module
 *
 * Public API for ingesting education, science, culture, and communication
 * statistics from the UNESCO UIS SDMX-JSON API.
 *
 * Phase 1 focuses on Education and R&D indicators for Canada.
 *
 * Usage:
 *   import { ingestUnescoDataset, ingestAllUnesco, searchUnescoRecords } from "./ingestion/unesco-uis/index.js";
 *
 *   // Fetch a single dataset for Canada
 *   const result = await ingestUnescoDataset("EDULIT_DS", "CAN");
 *
 *   // Fetch all datasets
 *   const allResults = await ingestAllUnesco();
 *
 *   // Search records by keyword
 *   const matches = searchUnescoRecords(allResults.records, "literacy");
 */

export { UNESCO_DATASETS, UNESCO_TOPICS, buildDatasetUrl, validateDatasetId } from "./constants.js";
export {
  parseSdmxResponse,
  parseSdmxJsonText,
  parseObservation,
  classifyObsStatus,
} from "./parser.js";
export { fetchUnescoDataset, healthCheck } from "./api.js";
export type {
  UnescoRecord,
  UnescoDataset,
  UnescoTopic,
  UnescoIngestionResult,
  UnescoSdmxResponse,
  UnescoApiError,
} from "./types.js";

import { UNESCO_DATASETS, UNESCO_TOPICS, validateDatasetId } from "./constants.js";
import { fetchUnescoDataset } from "./api.js";
import { parseSdmxResponse } from "./parser.js";
import type {
  UnescoRecord,
  UnescoIngestionResult,
} from "./types.js";

/**
 * Ingest a specific UNESCO UIS dataset.
 *
 * Fetches SDMX-JSON data from the API and parses it into structured records.
 *
 * @param datasetId - Dataset identifier (e.g., "EDULIT_DS", "SCN_DS", "CLT_DS")
 * @param countryCode - Optional ISO-3 country code filter (e.g., "CAN")
 * @returns Ingestion result with records, metadata, and any errors
 */
export async function ingestUnescoDataset(
  datasetId: string,
  countryCode?: string,
): Promise<UnescoIngestionResult> {
  const start = Date.now();
  const records: UnescoRecord[] = [];
  const errors: Array<{ datasetId: string; error: string }> = [];

  const dataset = UNESCO_DATASETS.find((d) => d.id === datasetId);
  const datasetName = dataset?.name ?? datasetId;

  try {
    const response = await fetchUnescoDataset(datasetId, countryCode);
    const parsed = await parseSdmxResponse(response, datasetId, datasetName);
    records.push(...parsed);
  } catch (err) {
    errors.push({
      datasetId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    datasetsAttempted: 1,
    datasetsSucceeded: errors.length === 0 ? 1 : 0,
    records,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Ingest all UNESCO UIS datasets (optionally filtered by country).
 *
 * @param countryCode - Optional ISO-3 country code filter (e.g., "CAN")
 * @returns Aggregated ingestion result across all datasets
 */
export async function ingestAllUnesco(
  countryCode?: string,
): Promise<UnescoIngestionResult> {
  const start = Date.now();
  const allRecords: UnescoRecord[] = [];
  const allErrors: Array<{ datasetId: string; error: string }> = [];
  let succeeded = 0;

  for (const dataset of UNESCO_DATASETS) {
    try {
      const response = await fetchUnescoDataset(dataset.id, countryCode);
      const parsed = await parseSdmxResponse(response, dataset.id, dataset.name);
      allRecords.push(...parsed);
      succeeded++;
    } catch (err) {
      allErrors.push({
        datasetId: dataset.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    datasetsAttempted: UNESCO_DATASETS.length,
    datasetsSucceeded: succeeded,
    records: allRecords,
    errors: allErrors,
    durationMs: Date.now() - start,
  };
}

/**
 * Ingest UNESCO datasets for a specific topic (Education, Science, Culture).
 *
 * @param topicCode - Topic code (e.g., "EDUCATION", "SCIENCE", "CULTURE")
 * @param countryCode - Optional ISO-3 country code filter
 * @returns Ingestion result for the specified topic datasets
 */
export async function ingestByTopic(
  topicCode: string,
  countryCode?: string,
): Promise<UnescoIngestionResult> {
  const start = Date.now();
  const topic = UNESCO_TOPICS[topicCode as keyof typeof UNESCO_TOPICS];
  if (!topic) {
    return {
      datasetsAttempted: 0,
      datasetsSucceeded: 0,
      records: [],
      errors: [{ datasetId: topicCode, error: `Unknown topic: ${topicCode}` }],
      durationMs: Date.now() - start,
    };
  }

  const allRecords: UnescoRecord[] = [];
  const allErrors: Array<{ datasetId: string; error: string }> = [];
  let succeeded = 0;

  for (const datasetId of topic.datasets) {
    const dataset = UNESCO_DATASETS.find((d) => d.id === datasetId);
    const datasetName = dataset?.name ?? datasetId;

    try {
      const response = await fetchUnescoDataset(datasetId, countryCode);
      const parsed = await parseSdmxResponse(response, datasetId, datasetName);
      allRecords.push(...parsed);
      succeeded++;
    } catch (err) {
      allErrors.push({
        datasetId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    datasetsAttempted: topic.datasets.length,
    datasetsSucceeded: succeeded,
    records: allRecords,
    errors: allErrors,
    durationMs: Date.now() - start,
  };
}

/**
 * Search UNESCO records by keyword.
 *
 * Matches against indicator name, indicator code, and dataset name (case-insensitive).
 *
 * @param records - Array of UnescoRecord objects to search
 * @param query - Search query string
 * @returns Filtered array of records matching the query
 */
export function searchUnescoRecords(
  records: UnescoRecord[],
  query: string,
): UnescoRecord[] {
  const lowerQuery = query.toLowerCase();
  return records.filter(
    (r) =>
      r.indicatorName.toLowerCase().includes(lowerQuery) ||
      r.indicatorCode.toLowerCase().includes(lowerQuery) ||
      r.datasetName.toLowerCase().includes(lowerQuery),
  );
}
