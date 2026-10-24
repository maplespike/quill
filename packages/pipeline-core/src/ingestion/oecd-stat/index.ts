// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchOECDDataset, fetchMultipleDatasets } from './fetcher.js';
import { DEFAULT_DATASETS, OECD_DATASETS } from './constants.js';
import type { OECDIndicator, OECDDataset, OECDIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('OECD Statistics', {
    sourceUrl: 'https://stats.oecd.org',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult OECD terms for each specific dataset and its exclusions.",
  });
}

export async function fetchAllOECDData(datasets?: string[]) {
  const targets = datasets ?? DEFAULT_DATASETS;
  const attribution = makeAttribution();

  const results = await fetchMultipleDatasets(targets);
  const allIndicators: OECDIndicator[] = [];
  const errors: string[] = [];

  for (const [id, result] of results) {
    if (result.error) {
      errors.push(`${id}: ${result.error}`);
    } else {
      allIndicators.push(...result.indicators);
    }
  }

  const ingestionResult: OECDIngestionResult = {
    datasetsAttempted: targets.length,
    datasetsSucceeded: targets.length - errors.length,
    indicators: allIndicators,
    errors,
    durationMs: 0,
  };

  return withAttribution(ingestionResult, attribution);
}

export async function searchOECDDatasets(keyword: string) {
  const lower = keyword.toLowerCase();
  const matched = OECD_DATASETS.filter(
    d => d.id.toLowerCase().includes(lower) || d.name.toLowerCase().includes(lower),
  );
  const attribution = makeAttribution();
  return withAttribution({ datasets: matched, keyword }, attribution);
}

export async function healthCheck() {
  const result = await fetchOECDDataset('QNA');
  const attribution = makeAttribution();
  return withAttribution({
    healthy: !result.error,
    datasetCount: OECD_DATASETS.length,
  }, attribution);
}

export type { OECDIndicator, OECDDataset, OECDIngestionResult } from './types.js';
