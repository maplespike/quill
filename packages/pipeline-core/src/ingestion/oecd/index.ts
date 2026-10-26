// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchOecdDataset, parseCsvData, validateCsvHeaders } from './fetcher.js';
import { OECD_DATASETS, OECD_TOPICS, DEFAULT_DATASETS, TOPIC_NAAG, TOPIC_HEALTH, TOPIC_TAX } from './constants.js';
import { parseOecdRecords } from './parser.js';
import type { OecdIngestionResult, OecdRecord } from './types.js';

function makeAttribution() {
  return buildAttribution('OECD Data Explorer', {
    sourceUrl: 'https://data-explorer.oecd.org',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult OECD terms for each specific dataset and its exclusions.",
  });
}

export async function ingestOecdDataset(datasetId: string) {
  const dataset = OECD_DATASETS.find((d) => d.id === datasetId);
  if (!dataset) {
    return withAttribution({
      datasetsAttempted: 1,
      datasetsSucceeded: 0,
      records: [],
      errors: [{ datasetId, error: `Unknown dataset: ${datasetId}` }],
      durationMs: 0,
    }, makeAttribution());
  }

  const startTime = Date.now();

  try {
    const csvText = await fetchOecdDataset(datasetId);
    const rows = parseCsvData(csvText);

    if (rows.length === 0) {
      return withAttribution({
        datasetsAttempted: 1,
        datasetsSucceeded: 0,
        records: [],
        errors: [{ datasetId, error: 'No data returned' }],
        durationMs: Date.now() - startTime,
      }, makeAttribution());
    }

    const headers = Object.keys(rows[0]);
    if (!validateCsvHeaders(headers)) {
      return withAttribution({
        datasetsAttempted: 1,
        datasetsSucceeded: 0,
        records: [],
        errors: [{ datasetId, error: 'Invalid CSV headers' }],
        durationMs: Date.now() - startTime,
      }, makeAttribution());
    }

    const records = await parseOecdRecords(rows, datasetId, dataset.name);

    return withAttribution({
      datasetsAttempted: 1,
      datasetsSucceeded: 1,
      records,
      errors: [],
      durationMs: Date.now() - startTime,
    }, makeAttribution());
  } catch (err) {
    return withAttribution({
      datasetsAttempted: 1,
      datasetsSucceeded: 0,
      records: [],
      errors: [{ datasetId, error: String(err) }],
      durationMs: Date.now() - startTime,
    }, makeAttribution());
  }
}

export async function ingestByTopic(topic: string) {
  const topicData = OECD_TOPICS[topic as keyof typeof OECD_TOPICS];
  if (!topicData) {
    return withAttribution({
      datasetsAttempted: 0,
      datasetsSucceeded: 0,
      records: [],
      errors: [{ datasetId: topic, error: `Unknown topic: ${topic}` }],
      durationMs: 0,
    }, makeAttribution());
  }

  const startTime = Date.now();
  const results = await Promise.all(topicData.datasets.map((datasetId) => ingestOecdDataset(datasetId)));

  const allRecords: OecdRecord[] = [];
  const allErrors: Array<{ datasetId: string; error: string }> = [];

  for (const result of results) {
    const ingestionResult = result.data as OecdIngestionResult;
    allRecords.push(...ingestionResult.records);
    allErrors.push(...ingestionResult.errors);
  }

  return withAttribution({
    datasetsAttempted: results.length,
    datasetsSucceeded: results.filter((r) => (r.data as OecdIngestionResult).datasetsSucceeded > 0).length,
    records: allRecords,
    errors: allErrors,
    durationMs: Date.now() - startTime,
  }, makeAttribution());
}

export async function ingestAllOecd(datasets?: string[]) {
  const targets = datasets ?? DEFAULT_DATASETS;
  const startTime = Date.now();

  const results = await Promise.all(targets.map((datasetId) => ingestOecdDataset(datasetId)));

  const allRecords: OecdRecord[] = [];
  const allErrors: Array<{ datasetId: string; error: string }> = [];

  for (const result of results) {
    const ingestionResult = result.data as OecdIngestionResult;
    allRecords.push(...ingestionResult.records);
    allErrors.push(...ingestionResult.errors);
  }

  return withAttribution({
    datasetsAttempted: results.length,
    datasetsSucceeded: results.filter((r) => (r.data as OecdIngestionResult).datasetsSucceeded > 0).length,
    records: allRecords,
    errors: allErrors,
    durationMs: Date.now() - startTime,
  }, makeAttribution());
}

export async function searchOecdRecords(
  keyword: string,
  options?: { country?: string; indicatorCode?: string; yearStart?: number; yearEnd?: number },
): Promise<OecdRecord[]> {
  const result = await ingestAllOecd();

  const lower = keyword.toLowerCase();
  let filtered = (result.data as OecdIngestionResult).records.filter(
    (r: OecdRecord) =>
      r.indicatorName.toLowerCase().includes(lower) ||
      r.indicatorCode.toLowerCase().includes(lower) ||
      r.topic.toLowerCase().includes(lower),
  );

  if (options?.country) {
    filtered = filtered.filter((r) => r.country === options.country);
  }

  if (options?.indicatorCode) {
    filtered = filtered.filter((r) => r.indicatorCode === options.indicatorCode);
  }

  if (options?.yearStart !== undefined) {
    filtered = filtered.filter((r) => r.year >= options.yearStart!);
  }

  if (options?.yearEnd !== undefined) {
    filtered = filtered.filter((r) => r.year <= options.yearEnd!);
  }

  return filtered;
}

export { OECD_DATASETS, OECD_TOPICS, DEFAULT_DATASETS, TOPIC_NAAG, TOPIC_HEALTH, TOPIC_TAX } from './constants.js';
export type { OecdRecord, OecdIngestionResult, OecdDataset, OecdTopic } from './types.js';