// SPDX-License-Identifier: AGPL-3.0-only

import type { AbsSdmxJsonData, AbsFactRecord } from './types.js';

export function parseSdmxObservations(
  dataflowId: string,
  dataflowName: string,
  sdmxData: AbsSdmxJsonData,
): AbsFactRecord[] {
  const records: AbsFactRecord[] = [];
  const dims = sdmxData.structure?.dimensions?.observation ?? [];
  const datasets = sdmxData.dataSets ?? [];
  const lastUpdated = new Date().toISOString();

  for (const ds of datasets) {
    const observations = ds.observations ?? {};
    for (const [key, obs] of Object.entries(observations)) {
      const indices = key.split(':').map(Number);
      const dimValues: Record<string, string> = {};
      for (let i = 0; i < dims.length && i < indices.length; i++) {
        const dim = dims[i];
        const val = dim.values?.[indices[i]];
        dimValues[dim.id] = val?.name ?? val?.id ?? String(indices[i]);
      }

      const period = dimValues['TIME_PERIOD'] ?? dimValues['FREQ'] ?? '';
      records.push({
        id: `ABS:${dataflowId}:${key}`,
        dataflow: dataflowId,
        dataflowName,
        dimensions: dimValues,
        value: obs[0] ?? null,
        period,
        lastUpdated,
      });
    }
  }

  return records;
}

export function parseMultiDataflowResults(
  results: Map<string, { name: string; data: AbsSdmxJsonData }>,
): AbsFactRecord[] {
  const allRecords: AbsFactRecord[] = [];
  for (const [id, { name, data }] of results) {
    allRecords.push(...parseSdmxObservations(id, name, data));
  }
  return allRecords;
}
