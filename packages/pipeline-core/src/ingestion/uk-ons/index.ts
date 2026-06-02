/**
 * UK ONS (Office for National Statistics) API Ingestion Module
 *
 * Ingests UK statistics data from ONS API.
 * No authentication required - public beta API.
 *
 * Data includes:
 * - Datasets by ID
 * - Time series data
 * - Economic indicators
 * - Demographics
 *
 * API Documentation: https://developer.ons.gov.uk/
 */

import { httpGet } from '../../utils/http.js';

const ONS_API_BASE = 'https://api.beta.ons.gov.uk/v1';
const ONS_TIMEOUT_MS = 15_000;
const ONS_USER_AGENT = 'MapleSpike-ONS/1.0 (+https://github.com/reverb256/maplespike)';

interface ONSLink {
  href: string;
  id: string;
}

interface ONSDataset {
  id: string;
  title: string;
  description: string;
  links: {
    self: ONSLink;
    latest_version: ONSLink;
    dimensions: ONSLink;
  };
}

interface ONSTimeSeriesValue {
  date: string;
  value: string;
  year: string;
  month: string;
  quarter: string;
}

interface ONSTimeSeries {
  id: string;
  title: string;
  description: string;
  releaseDate: string;
  nextRelease: string;
  contact: {
    email: string;
    name: string;
    telephone: string;
  };
  links: {
    self: ONSLink;
    dataset_version: ONSLink;
    latest_changes: ONSLink;
  };
}

interface ONSObservation {
  date: string;
  value: string;
  observation: string;
}

interface ONSDatasetVersion {
  id: string;
  version: number;
  links: {
    self: ONSLink;
    dataset: ONSLink;
  };
}

/**
 * Get all available datasets from ONS.
 * @returns List of datasets with metadata
 */
export async function getAllDatasets(): Promise<ONSDataset[]> {
  const url = `${ONS_API_BASE}/datasets`;

  const resp = await httpGet(url, {
    timeoutMs: ONS_TIMEOUT_MS,
    headers: {
      'User-Agent': ONS_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`ONS API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);
  return data.items || [];
}

/**
 * Get dataset by ID.
 * @param datasetId - Dataset identifier
 * @returns Dataset metadata
 */
export async function getDataset(datasetId: string): Promise<ONSDataset> {
  const url = `${ONS_API_BASE}/datasets/${datasetId}`;

  const resp = await httpGet(url, {
    timeoutMs: ONS_TIMEOUT_MS,
    headers: {
      'User-Agent': ONS_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`ONS API error: HTTP ${resp.statusCode}`);
  }

  return JSON.parse(resp.body);
}

/**
 * Get time series data by ID.
 * @param timeSeriesId - Time series identifier
 * @returns Time series data with observations
 */
export async function getTimeSeries(timeSeriesId: string): Promise<{
  series: ONSTimeSeries;
  observations: ONSObservation[];
}> {
  const url = `${ONS_API_BASE}/timeseries/${timeSeriesId}/dataset/${timeSeriesId}`;

  const resp = await httpGet(url, {
    timeoutMs: ONS_TIMEOUT_MS,
    headers: {
      'User-Agent': ONS_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`ONS API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);

  return {
    series: data,
    observations: data.observations || [],
  };
}

/**
 * Search datasets by keyword.
 * @param query - Search query string
 * @returns Matching datasets
 */
export async function searchDatasets(query: string): Promise<ONSDataset[]> {
  const url = `${ONS_API_BASE}/datasets?search=${encodeURIComponent(query)}`;

  const resp = await httpGet(url, {
    timeoutMs: ONS_TIMEOUT_MS,
    headers: {
      'User-Agent': ONS_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`ONS API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);
  return data.items || [];
}

export interface GetTimeSeriesResult {
  series: ONSTimeSeries;
  observations: ONSObservation[];
  total: number;
}