/**
 * StatCan WDS Low-level API Client — MapleSpike Pipeline
 *
 * Typed wrapper around the Statistics Canada Web Data Service (WDS) REST API.
 * Provides functions for fetching data, metadata, cube listings, and
 * changed cube detection.
 *
 * WDS API Reference:
 *   Base:   https://www150.statcan.gc.ca/t1/wds/rest
 *   getAllCubesListLite (GET)  — list all 5,000+ cubes
 *   getData (POST)              — fetch data in JSON-stat format
 *   getFullTableDownloadCSV (POST) — download full table as CSV
 *   getCubeMetadata (POST)      — get cube metadata/dimensions
 *   getChangedCubeList (POST)   — list cubes changed since a date
 *
 * Source terms: Statistics Canada publishes an Open Licence. Confirm that it
 * applies to the specific dataset, version, and use; exclusions may apply.
 */

import { httpGet } from '../../utils/http.js';
import {
  STATCAN_WDS_BASE,
  WDS_ENDPOINTS,
  WDS_DEFAULT_TIMEOUT_MS,
  wdsUrl,
} from './constants.js';
import type {
  JsonStatResponse,
  WdsCubeLite,
  WdsCubeMetadata,
  WdsErrorResponse,
} from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Custom Error Class                                                 */
/* ------------------------------------------------------------------ */

export class WdsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
  ) {
    super(message);
    this.name = 'WdsApiError';
  }
}

/* ------------------------------------------------------------------ */
/*  GET Endpoints                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch the list of all available StatCan cubes (5,000+).
 * Uses GET /getAllCubesListLite.
 */
export async function getAllCubesListLite(
  options: { timeoutMs?: number } = {},
): Promise<WdsCubeLite[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  try {
    const url = wdsUrl(WDS_ENDPOINTS.getAllCubesListLite);
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new WdsApiError(
        `getAllCubesListLite returned ${resp.statusCode}`,
        resp.statusCode,
        WDS_ENDPOINTS.getAllCubesListLite,
      );
    }

    const data: WdsCubeLite[] = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof WdsApiError) throw error;
    throw new WdsApiError(
      `getAllCubesListLite failed: ${(error as Error).message}`,
      undefined,
      WDS_ENDPOINTS.getAllCubesListLite,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST Endpoints                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch data for a StatCan product in JSON-stat format.
 * Uses POST /getData.
 *
 * @param productId - StatCan product ID (e.g. "18-10-0004-01")
 * @param options - Optional timeout and format override
 */
export async function getData(
  productId: string,
  options: { timeoutMs?: number; format?: string } = {},
): Promise<JsonStatResponse> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const format = options.format ?? 'json-stat';
  try {
    const url = wdsUrl(WDS_ENDPOINTS.getData);
    const resp = await httpGet(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      // Try to parse WDS error response
      const errorText = resp.body.substring(0, 500);
      throw new WdsApiError(
        `getData returned ${resp.statusCode} for product ${productId}: ${errorText}`,
        resp.statusCode,
        WDS_ENDPOINTS.getData,
      );
    }

    // WDS returns an array with one element containing the response
    const raw: unknown = await resp.json();
    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        throw new WdsApiError(
          `getData returned empty array for product ${productId}`,
          undefined,
          WDS_ENDPOINTS.getData,
        );
      }
      const first = raw[0] as Record<string, unknown>;
      if (first.error) {
        throw new WdsApiError(
          `WDS error for product ${productId}: ${JSON.stringify(first.error)}`,
          undefined,
          WDS_ENDPOINTS.getData,
        );
      }
      // Handle wrapped response: { "object": { ...json-stat... } }
      if (first.object && typeof first.object === 'object') {
        // Check if it has the "value" array (JSON-stat)
        const candidate = first.object as Record<string, unknown>;
        if (Array.isArray(candidate.value)) {
          return candidate as unknown as JsonStatResponse;
        }
        // Maybe object contains response wrapper
        if (candidate.response) {
          return candidate.response as unknown as JsonStatResponse;
        }
        return candidate as unknown as JsonStatResponse;
      }
      // If first element has value array directly (unwrapped)
      if (Array.isArray(first.value)) {
        return first as unknown as JsonStatResponse;
      }
      // Response might be directly the JSON-stat object
      const respData = raw[0] as JsonStatResponse;
      if (respData.value || respData.class === 'dataset') {
        return respData;
      }
      // Object might be at first.object
      if (first.object) {
        return first.object as unknown as JsonStatResponse;
      }
      throw new WdsApiError(
        `Unexpected WDS response format for product ${productId}`,
        undefined,
        WDS_ENDPOINTS.getData,
      );
    }

    // Direct JSON-stat response
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (obj.value || obj.class === 'dataset') {
        return raw as JsonStatResponse;
      }
    }

    throw new WdsApiError(
      `Unexpected WDS response type for product ${productId}`,
      undefined,
      WDS_ENDPOINTS.getData,
    );
  } catch (error) {
    if (error instanceof WdsApiError) throw error;
    throw new WdsApiError(
      `getData failed for product ${productId}: ${(error as Error).message}`,
      undefined,
      WDS_ENDPOINTS.getData,
    );
  }
}

/**
 * Fetch full table data as CSV text.
 * Uses POST /getFullTableDownloadCSV.
 *
 * @param productId - StatCan product ID
 * @param options - Optional timeout
 */
export async function getFullTableDownloadCSV(
  productId: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  try {
    const url = wdsUrl(WDS_ENDPOINTS.getFullTableDownloadCSV);
    const resp = await httpGet(url, {
      headers: {
        Accept: 'text/csv',
        'Content-Type': 'application/json',
      },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new WdsApiError(
        `getFullTableDownloadCSV returned ${resp.statusCode} for product ${productId}`,
        resp.statusCode,
        WDS_ENDPOINTS.getFullTableDownloadCSV,
      );
    }

    return resp.body;
  } catch (error) {
    if (error instanceof WdsApiError) throw error;
    throw new WdsApiError(
      `getFullTableDownloadCSV failed for product ${productId}: ${(error as Error).message}`,
      undefined,
      WDS_ENDPOINTS.getFullTableDownloadCSV,
    );
  }
}

/**
 * Fetch metadata/dimensions for a StatCan cube.
 * Uses POST /getCubeMetadata.
 *
 * @param productId - StatCan product ID
 * @param options - Optional timeout
 */
export async function getCubeMetadata(
  productId: string,
  options: { timeoutMs?: number } = {},
): Promise<WdsCubeMetadata> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  try {
    const url = wdsUrl(WDS_ENDPOINTS.getCubeMetadata);
    const resp = await httpGet(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new WdsApiError(
        `getCubeMetadata returned ${resp.statusCode} for product ${productId}`,
        resp.statusCode,
        WDS_ENDPOINTS.getCubeMetadata,
      );
    }

    const raw: unknown = await resp.json();

    // WDS returns array-wrapped responses
    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        throw new WdsApiError(
          `getCubeMetadata returned empty array for product ${productId}`,
          undefined,
          WDS_ENDPOINTS.getCubeMetadata,
        );
      }
      const first = raw[0] as Record<string, unknown>;
      if (first.error) {
        throw new WdsApiError(
          `WDS error for product ${productId}: ${JSON.stringify(first.error)}`,
          undefined,
          WDS_ENDPOINTS.getCubeMetadata,
        );
      }
      if (typeof raw[0] === 'object' && raw[0] !== null) {
        return raw[0] as WdsCubeMetadata;
      }
    }

    throw new WdsApiError(
      `Unexpected getCubeMetadata response format for product ${productId}`,
      undefined,
      WDS_ENDPOINTS.getCubeMetadata,
    );
  } catch (error) {
    if (error instanceof WdsApiError) throw error;
    throw new WdsApiError(
      `getCubeMetadata failed for product ${productId}: ${(error as Error).message}`,
      undefined,
      WDS_ENDPOINTS.getCubeMetadata,
    );
  }
}

/**
 * Fetch list of cubes changed since a given date.
 * Uses POST /getChangedCubeList.
 *
 * @param changedSinceDate - ISO date string (e.g. "2024-01-01")
 * @param options - Optional timeout
 */
export async function getChangedCubeList(
  changedSinceDate: string,
  options: { timeoutMs?: number } = {},
): Promise<WdsCubeLite[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  try {
    const url = wdsUrl(WDS_ENDPOINTS.getChangedCubeList);
    const resp = await httpGet(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new WdsApiError(
        `getChangedCubeList returned ${resp.statusCode}`,
        resp.statusCode,
        WDS_ENDPOINTS.getChangedCubeList,
      );
    }

    const data: WdsCubeLite[] = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof WdsApiError) throw error;
    throw new WdsApiError(
      `getChangedCubeList failed: ${(error as Error).message}`,
      undefined,
      WDS_ENDPOINTS.getChangedCubeList,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing Utility                                                */
/* ------------------------------------------------------------------ */

/**
 * Parse CSV text from StatCan download into rows.
 * Handles header row and data rows.
 *
 * @param csvText - Raw CSV text
 * @returns Array of header strings and array of row value arrays
 */
export function parseCsvResponse(
  csvText: string,
): { headers: string[]; rows: string[][] } {
  const lines = csvText.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header row
  const headers = parseCsvLine(lines[0]);

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseCsvLine(lines[i]);
    if (parsed.length > 0) {
      rows.push(parsed);
    }
  }

  return { headers, rows };
}



/* ------------------------------------------------------------------ */
/*  JSON-stat Parsing Utility                                          */
/* ------------------------------------------------------------------ */

/**
 * Extract dimension labels from a JSON-stat response.
 * Returns a mapping of dimension ID -> value label.
 *
 * @param data - Parsed JSON-stat response
 * @param index - Index into the "value" array
 */
export function resolveJsonStatDimensions(
  data: JsonStatResponse,
  index: number,
): Record<string, string> {
  const dimensions: Record<string, string> = {};

  if (!data.id || !data.dimension) return dimensions;

  // The JSON-stat "id" array gives dimension IDs in order.
  // The "size" array gives the size of each dimension.
  // We compute the multi-dimensional index from the flat index.
  const sizes = data.size;
  const ids = data.id;

  // Compute dimension values for this flat index
  let remaining = index;
  for (let d = 0; d < ids.length; d++) {
    const dimId = ids[d];
    const dimSize = sizes[d];
    const dimIndex = dimSize > 0 ? remaining % dimSize : 0;
    remaining = Math.floor(remaining / dimSize);

    const dimInfo = data.dimension[dimId];
    if (dimInfo?.category?.label) {
      const labelMap = dimInfo.category.label;
      const key = String(Object.keys(labelMap)[dimIndex] ?? dimIndex);
      dimensions[dimId] = labelMap[key] ?? String(dimIndex);
    }
  }

  return dimensions;
}

/**
 * Get time / period values from a JSON-stat response.
 * The time dimension is typically named "time" or has a date-like category.
 */
export function extractTimeDimension(
  data: JsonStatResponse,
): Array<{ period: string; date: string | null }> {
  const timeEntries: Array<{ period: string; date: string | null }> = [];

  if (!data.dimension?.time?.category?.label) return timeEntries;

  const timeLabels = data.dimension.time.category.label;
  for (const [key, label] of Object.entries(timeLabels)) {
    const dateStr = parseJsonStatDate(label);
    timeEntries.push({
      period: label,
      date: dateStr ?? parseJsonStatDate(key),
    });
  }

  return timeEntries;
}

/**
 * Attempt to derive ISO date from a StatCan time label.
 */
function parseJsonStatDate(label: string): string | null {
  if (!label) return null;

  // "2024-01" (monthly)
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;

  return null;
}
