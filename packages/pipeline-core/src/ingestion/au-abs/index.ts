// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchDataflows, fetchDataflowData, fetchMultiDataflowData } from './fetcher.js';
import { parseSdmxObservations, parseMultiDataflowResults } from './parser.js';
import { DEFAULT_DATAFLOWS, TOPIC_DATAFLOWS } from './constants.js';
import type { AbsFactRecord, AbsIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('Australian Bureau of Statistics', {
    sourceUrl: 'https://www.abs.gov.au/',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult ABS terms and notices for the specific dataset and material.",
  });
}

export async function ingestDataflow(dataflowId: string): Promise<AbsIngestionResult> {
  const start = Date.now();
  const data = await fetchDataflowData(dataflowId, { detail: 'dataonly' });
  if (!data) {
    return { dataflow: dataflowId, records: [], observationsExtracted: 0, errors: [`Failed to fetch ${dataflowId}`], durationMs: Date.now() - start };
  }
  const records = parseSdmxObservations(dataflowId, dataflowId, data);
  return { dataflow: dataflowId, records, observationsExtracted: records.length, errors: [], durationMs: Date.now() - start };
}

export async function ingestAllAbs(dataflows?: string[]): Promise<Record<string, AbsFactRecord[]>> {
  const targets = dataflows ?? DEFAULT_DATAFLOWS;
  const rawData = await fetchMultiDataflowData(targets);
  const results: Record<string, AbsFactRecord[]> = {};
  for (const [id, data] of rawData) {
    results[id] = parseSdmxObservations(id, id, data);
  }
  return results;
}

export async function ingestByTopic(topicKey: string, dataflows?: string[]): Promise<{ topic: string; topicName: string; results: Record<string, AbsFactRecord[]> }> {
  const topic = TOPIC_DATAFLOWS[topicKey];
  if (!topic) throw new Error(`Unknown topic: ${topicKey}. Valid: ${Object.keys(TOPIC_DATAFLOWS).join(', ')}`);
  const targets = dataflows ?? DEFAULT_DATAFLOWS.filter((df) => topic.prefixes.some((p) => df.startsWith(p)));
  const rawData = await fetchMultiDataflowData(targets);
  const results: Record<string, AbsFactRecord[]> = {};
  for (const [id, data] of rawData) {
    results[id] = parseSdmxObservations(id, id, data);
  }
  return { topic: topicKey, topicName: topic.name, results };
}

export async function healthCheck() {
  const attribution = makeAttribution();
  try {
    const flows = await fetchDataflows();
    return withAttribution({ healthy: flows.length > 0, dataflowsFound: flows.length }, attribution);
  } catch {
    return withAttribution({ healthy: false, dataflowsFound: 0 }, attribution);
  }
}

export type { AbsFactRecord, AbsSdmxJsonData, AbsIngestionResult } from './types.js';
export { DEFAULT_DATAFLOWS, TOPIC_DATAFLOWS } from './constants.js';
