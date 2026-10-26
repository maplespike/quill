// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchTimeseries, fetchMultiTimeseries, searchDatasets } from './fetcher.js';
import { parseTimeseries, parseMultiTimeseries } from './parser.js';
import { DEFAULT_TIMESERIES, DEFAULT_DATASETS, TOPIC_DATASETS } from './constants.js';
import type { OnsFactRecord, OnsIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('Office for National Statistics (UK)', {
    sourceUrl: 'https://www.ons.gov.uk/',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult ONS terms and notices for the specific dataset and material.",
  });
}

export async function ingestSeries(cdid: string): Promise<OnsIngestionResult> {
  const start = Date.now();
  const data = await fetchTimeseries(cdid);
  if (!data) {
    return { series: cdid, records: [], observationsExtracted: 0, errors: [`Failed to fetch ${cdid}`], durationMs: Date.now() - start };
  }
  const records = parseTimeseries(cdid, data);
  return { series: cdid, records, observationsExtracted: records.length, errors: [], durationMs: Date.now() - start };
}

export async function ingestAllOns(series?: string[]): Promise<Record<string, OnsFactRecord[]>> {
  const targets = series ?? DEFAULT_TIMESERIES;
  const rawData = await fetchMultiTimeseries(targets);
  const results: Record<string, OnsFactRecord[]> = {};
  for (const [cdid, data] of rawData) {
    results[cdid] = parseTimeseries(cdid, data);
  }
  return results;
}

export async function ingestByTopic(
  topicKey: string,
  series?: string[],
): Promise<{ topic: string; topicName: string; results: Record<string, OnsFactRecord[]> }> {
  const topic = TOPIC_DATASETS[topicKey];
  if (!topic) throw new Error(`Unknown topic: ${topicKey}. Valid: ${Object.keys(TOPIC_DATASETS).join(', ')}`);
  const targets = series ?? topic.timeseries;
  const rawData = await fetchMultiTimeseries(targets);
  const results: Record<string, OnsFactRecord[]> = {};
  for (const [cdid, data] of rawData) {
    results[cdid] = parseTimeseries(cdid, data);
  }
  return { topic: topicKey, topicName: topic.name, results };
}

export async function healthCheck() {
  const attribution = makeAttribution();
  try {
    const data = await fetchTimeseries('CPI');
    return withAttribution({
      healthy: data !== null && (data.months ?? data.quarters ?? data.years ?? []).length > 0,
      testSeries: 'CPI',
      observationsFound: data ? (data.months ?? data.quarters ?? data.years ?? []).length : 0,
    }, attribution);
  } catch {
    return withAttribution({ healthy: false, testSeries: 'CPI', observationsFound: 0 }, attribution);
  }
}

export type { OnsFactRecord, OnsTimeseriesData, OnsIngestionResult } from './types.js';
export { DEFAULT_TIMESERIES, DEFAULT_DATASETS, TOPIC_DATASETS } from './constants.js';
