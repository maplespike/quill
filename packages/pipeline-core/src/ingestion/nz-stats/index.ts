// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchDataset, fetchAllDatasetPages, fetchCatalogue } from './fetcher.js';
import { parseODataRecords } from './parser.js';
import { DEFAULT_DATASETS, TOPIC_DATASETS } from './constants.js';
import type { SnzFactRecord, SnzIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('Statistics New Zealand', {
    sourceUrl: 'https://www.stats.govt.nz/',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult Stats NZ terms and notices for the specific dataset and material.",
  });
}

export async function ingestDataset(datasetId: string): Promise<SnzIngestionResult> {
  const start = Date.now();
  const records = await fetchAllDatasetPages(datasetId);
  if (records.length === 0) {
    return { dataset: datasetId, records: [], observationsExtracted: 0, errors: [`No data returned for ${datasetId}`], durationMs: Date.now() - start };
  }
  const parsed = parseODataRecords(datasetId, datasetId, records);
  return { dataset: datasetId, records: parsed, observationsExtracted: parsed.length, errors: [], durationMs: Date.now() - start };
}

export async function ingestAllSnz(datasets?: string[]): Promise<Record<string, SnzFactRecord[]>> {
  const targets = datasets ?? DEFAULT_DATASETS;
  const results: Record<string, SnzFactRecord[]> = {};
  for (const ds of targets) {
    try {
      const records = await fetchAllDatasetPages(ds);
      results[ds] = parseODataRecords(ds, ds, records);
    } catch { /* skip */ }
  }
  return results;
}

export async function ingestByTopic(topicKey: string, datasets?: string[]): Promise<{ topic: string; topicName: string; results: Record<string, SnzFactRecord[]> }> {
  const topic = TOPIC_DATASETS[topicKey];
  if (!topic) throw new Error(`Unknown topic: ${topicKey}. Valid: ${Object.keys(TOPIC_DATASETS).join(', ')}`);
  const targets = datasets ?? topic.datasets;
  const results: Record<string, SnzFactRecord[]> = {};
  for (const ds of targets) {
    try {
      const records = await fetchAllDatasetPages(ds);
      results[ds] = parseODataRecords(ds, ds, records);
    } catch { /* skip */ }
  }
  return { topic: topicKey, topicName: topic.name, results };
}

export async function healthCheck() {
  const attribution = makeAttribution();
  try {
    const catalogue = await fetchCatalogue();
    return withAttribution({ healthy: catalogue.length > 0, datasetsFound: catalogue.length }, attribution);
  } catch {
    return withAttribution({ healthy: false, datasetsFound: 0 }, attribution);
  }
}

export type { SnzFactRecord, SnzIngestionResult } from './types.js';
export { DEFAULT_DATASETS, TOPIC_DATASETS } from './constants.js';
