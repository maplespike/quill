// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  OECD_DATASET_URLS,
  OECD_TIMEOUT_MS,
  OECD_USER_AGENT,
} from './constants.js';
import type { OECDSdmxResponse, OECDIndicator } from './types.js';

export interface OECDFetchResult {
  datasetId: string;
  datasetName: string;
  indicators: OECDIndicator[];
  error?: string;
}

export async function fetchOECDDataset(datasetId: string): Promise<OECDFetchResult> {
  const url = OECD_DATASET_URLS[datasetId];
  if (!url) {
    return { datasetId, datasetName: datasetId, indicators: [], error: `Unknown dataset: ${datasetId}` };
  }

  try {
    const resp = await httpGet(url, {
      timeoutMs: OECD_TIMEOUT_MS,
      headers: { 'User-Agent': OECD_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { datasetId, datasetName: datasetId, indicators: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = (await resp.json()) as OECDSdmxResponse;
    const indicators: OECDIndicator[] = [];

    if (body?.dataSets?.[0]?.observations) {
      const obs = body.dataSets[0].observations;
      for (const [key, values] of Object.entries(obs)) {
        if (values?.[0]) {
          indicators.push({
            datasetId,
            datasetName: datasetId,
            indicatorCode: key,
            country: 'CAN',
            year: parseInt(key.split(':')[0] ?? '0', 10),
            value: parseFloat(values[0]),
            unit: '',
            id: `OECD:${datasetId}:${key}:${parseInt(key.split(':')[0] ?? '0', 10)}`,
          });
        }
      }
    }

    const datasetName = indicators.length > 0 ? datasetId : datasetId;
    return { datasetId, datasetName, indicators };
  } catch (err) {
    return { datasetId, datasetName: datasetId, indicators: [], error: String(err) };
  }
}

export async function fetchMultipleDatasets(
  datasetIds: string[],
): Promise<Map<string, OECDFetchResult>> {
  const results = new Map<string, OECDFetchResult>();
  const fetches = datasetIds.map(async (id) => {
    const result = await fetchOECDDataset(id);
    results.set(id, result);
  });
  await Promise.all(fetches);
  return results;
}
