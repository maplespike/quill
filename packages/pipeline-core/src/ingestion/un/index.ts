// SPDX-License-Identifier: AGPL-3.0-or-later

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import {
  UN_SDMX_API_BASE,
  UN_TIMEOUT_MS,
  UN_USER_AGENT,
  UN_MAX_RECORDS,
  UN_DEFAULT_FORMAT,
} from './constants.js';
import { parseUnRecords } from './parser.js';
import type { UnRecord, UnIngestionResult, UnFilterOptions } from './types.js';
import { UnApiError } from './types.js';
import { UN_DATABASES } from './constants.js';

async function fetchUnData(
  database: string,
  dataset: string,
  filters: Omit<UnFilterOptions, 'database' | 'dataset'> = {},
  format: 'json' | 'xml' | 'csv' = 'json',
): Promise<string> {
  const params = new URLSearchParams();
  params.set('format', format);

  if (filters.country) {
    const countries = Array.isArray(filters.country) ? filters.country : [filters.country];
    countries.forEach(c => params.append('filters', `geo\\.area\\.${c}`));
  }

  if (filters.year && !Array.isArray(filters.year)) {
    params.append('filters', `time_period.${filters.year}`);
  } else if (Array.isArray(filters.year)) {
    filters.year.forEach(y => params.append('filters', `time_period.${y}`));
  } else if (filters.yearStart && filters.yearEnd) {
    params.append('filters', `time_period.\\*start=${filters.yearStart}`);
    params.append('filters', `time_period.\\*end=${filters.yearEnd}`);
  }

  if (filters.indicator) {
    params.append('filters', `indicator\\.key\\.${filters.indicator}`);
  }

  Object.entries(filters.dimensionFilters || {}).forEach(([key, value]) => {
    params.append('filters', `${key}\\.${value}`);
  });

  const url = `${UN_SDMX_API_BASE}/data/${database},${dataset},${UN_DEFAULT_FORMAT}/${params.toString()}`;

  const resp = await httpGet(url, {
    headers: {
      'User-Agent': UN_USER_AGENT,
      Accept: format === 'json' ? 'application/json' : format === 'xml' ? 'application/xml' : 'text/csv',
    },
    timeoutMs: UN_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new UnApiError(
      `UN API returned HTTP ${resp.statusCode} for ${database}/${dataset}`,
      database,
      dataset,
    );
  }

  return resp.body;
}

async function fetchDatasetMetadata(
  database: string,
  dataset: string,
): Promise<{ description: string; dataflow: string; dimensions: Array<{ name: string; code: string }> }> {
  const url = `${UN_SDMX_API_BASE}/dataflow/${database},${dataset}/latest`;

  const resp = await httpGet(url, {
    headers: {
      'User-Agent': UN_USER_AGENT,
      Accept: 'application/json',
    },
    timeoutMs: UN_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new UnApiError(
      `UN API returned HTTP ${resp.statusCode} for dataflow ${database}/${dataset}`,
      database,
      dataset,
    );
  }

  const json = await resp.json() as any;

  return {
    description: json?.data?.[0]?.description || json?.description || '',
    dataflow: json?.data?.[0]?.id || `${database},${dataset}`,
    dimensions: json?.data?.[0]?.structure?.dimensions?.map((d: any) => ({
      name: d?.name || d?.id,
      code: d?.id || d?.name,
    })) || [],
  };
}

export async function ingestUnDataset(
  database: string,
  dataset: string,
  options: Partial<UnFilterOptions> = {},
): Promise<UnIngestionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const maxRecords = options.maxRecords || UN_MAX_RECORDS;
  const format = options.format || 'json';

  const attribution = buildAttribution(`UN ${database}`, {
    sourceUrl: `${UN_SDMX_API_BASE}/data/${database},${dataset}`,
    license: 'United Nations Open Data',
    attributionText: `Data sourced from UN ${database} database`,
  });

  try {
    const metadata = await fetchDatasetMetadata(database, dataset);

    const body = await fetchUnData(database, dataset, options, format);

    const records = await parseUnRecords(
      body,
      format,
      {
        database,
        databaseName: (Object.values(UN_DATABASES) as Array<{ code: string; name: string }>).find(db => db.code === database)?.name || database,
        dataset,
        datasetDescription: metadata.description,
        dataflow: metadata.dataflow,
      },
      maxRecords,
    );

    return {
      database,
      dataset,
      recordsFetched: records.length,
      records,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(errorMsg);
    return {
      database,
      dataset,
      recordsFetched: 0,
      records: [],
      errors,
      durationMs: Date.now() - startTime,
    };
  }
}

export async function ingestMultipleDatasets(
  options: UnFilterOptions & { datasets: Array<{ database: string; dataset: string }> },
): Promise<UnIngestionResult[]> {
  const results: UnIngestionResult[] = [];

  for (const { database, dataset } of options.datasets) {
    const result = await ingestUnDataset(database, dataset, options);
    results.push(result);
  }

  return results;
}

export { UN_DATABASES, UN_DATASETS, UN_SDMX_API_BASE, UN_DEFAULT_FORMAT, UN_MAX_RECORDS } from './constants.js';
export type { UnRecord, UnIngestionResult, UnFilterOptions, UnApiError };