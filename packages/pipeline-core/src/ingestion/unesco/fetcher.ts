// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * UNESCO UIS API Fetcher
 *
 * Handles HTTP requests to the UNESCO SDMX REST API.
 * Requires UNESCO_API_KEY environment variable for authentication.
 */

import { httpGet } from "../../utils/http.js";
import {
  UNESCO_BASE_URL,
  UNESCO_TIMEOUT_MS,
  UNESCO_USER_AGENT,
  getUnescoApiKey,
  getDataflowId,
} from "./constants.js";
import type {
  UnescoSdmxResponse,
} from "./types.js";

export class UnescoApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly dataflowId?: string,
  ) {
    super(message);
    this.name = "UnescoApiError";
  }
}

interface FetchOptions {
  timeoutMs?: number;
  startPeriod?: string;
  endPeriod?: string;
  refArea?: string;
}

/**
 * Build a request URL for the UNESCO SDMX data API.
 *
 * UNESCO uses the standard SDMX REST data endpoint:
 *   GET /data/{flowRef}
 * with query parameters for time range, country filter, and format.
 */
function buildDataUrl(dataflowId: string, options: FetchOptions = {}): string {
  const url = new URL(`${UNESCO_BASE_URL}/data/${dataflowId}`);
  url.searchParams.set("format", "jsondata");
  url.searchParams.set("detail", "full");

  if (options.startPeriod) {
    url.searchParams.set("startTime", options.startPeriod);
  }
  if (options.endPeriod) {
    url.searchParams.set("endTime", options.endPeriod);
  }
  if (options.refArea) {
    url.searchParams.set("REF_AREA", options.refArea);
  }

  return url.toString();
}

/**
 * Common headers for UNESCO API requests.
 * Includes API key authentication.
 */
function buildHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": UNESCO_USER_AGENT,
    "api_key": getUnescoApiKey(),
  };
}

/**
 * Fetch data for a specific dataflow from the UNESCO SDMX API.
 */
export async function fetchDataflow(
  dataflowId: string,
  options: FetchOptions = {},
): Promise<UnescoSdmxResponse> {
  const timeoutMs = options.timeoutMs ?? UNESCO_TIMEOUT_MS;
  const url = buildDataUrl(dataflowId, options);

  try {
    const resp = await httpGet(url, {
      headers: buildHeaders(),
      timeoutMs,
    });

    if (resp.statusCode >= 400) {
      throw new UnescoApiError(
        `UNESCO SDMX API returned ${resp.statusCode} for dataflow ${dataflowId}`,
        resp.statusCode,
        dataflowId,
      );
    }

    const body = await resp.json();
    return body as UnescoSdmxResponse;
  } catch (error) {
    if (error instanceof UnescoApiError) throw error;
    throw new UnescoApiError(
      `Failed to fetch UNESCO dataflow ${dataflowId}: ${(error as Error).message}`,
      undefined,
      dataflowId,
    );
  }
}

/**
 * Fetch data for a specific indicator code.
 * Converts indicator code to dataflow ID before fetching.
 */
export async function fetchDataflowByIndicator(
  indicatorCode: string,
  options: FetchOptions = {},
): Promise<UnescoSdmxResponse> {
  const dataflowId = getDataflowId(indicatorCode);
  return fetchDataflow(dataflowId, options);
}

/**
 * Fetch data for multiple indicators sequentially.
 * Respects rate limits by processing one at a time.
 */
export async function fetchMultipleIndicators(
  indicatorCodes: string[],
  options: FetchOptions = {},
): Promise<Map<string, UnescoSdmxResponse>> {
  const results = new Map<string, UnescoSdmxResponse>();

  for (const indicatorCode of indicatorCodes) {
    try {
      const data = await fetchDataflowByIndicator(indicatorCode, options);
      results.set(indicatorCode, data);
    } catch (error) {
      console.warn(
        `[UNESCO] Failed to fetch ${indicatorCode}: ${(error as Error).message}`,
      );
    }
  }

  return results;
}

/**
 * Fetch dataflow structure metadata from UNESCO.
 * Used to discover available dimensions and codelists.
 */
export async function fetchDataflowStructure(
  dataflowId: string,
  options: { timeoutMs?: number } = {},
): Promise<Record<string, unknown> | null> {
  const timeoutMs = options.timeoutMs ?? UNESCO_TIMEOUT_MS;
  const url = `${UNESCO_BASE_URL}/datastructure/${dataflowId}`;

  try {
    const resp = await httpGet(url, {
      headers: buildHeaders(),
      timeoutMs,
    });

    if (resp.statusCode >= 400) {
      return null;
    }

    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Get list of available dataflows from UNESCO.
 */
export async function fetchDataflowList(
  options: { timeoutMs?: number } = {},
): Promise<string[]> {
  const timeoutMs = options.timeoutMs ?? UNESCO_TIMEOUT_MS;
  const url = `${UNESCO_BASE_URL}/dataflow`;

  try {
    const resp = await httpGet(url, {
      headers: buildHeaders(),
      timeoutMs,
    });

    if (resp.statusCode >= 400) {
      return [];
    }

    const body = await resp.json() as Record<string, unknown>;
    const data = body?.data as Record<string, unknown> | undefined;
    const structures = data?.structures;
    if (!Array.isArray(structures)) return [];
    const dataflows = structures[0]?.dataflows;
    if (!Array.isArray(dataflows)) return [];

    return dataflows.map((df: Record<string, unknown>) => String(df.id)).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check UNESCO API health by testing a simple indicator query.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const url = new URL(`${UNESCO_BASE_URL}/data/DF_EDU_NERT_PRY`);
    url.searchParams.set("format", "jsondata");
    url.searchParams.set("detail", "dataonly");

    const resp = await httpGet(url.toString(), {
      headers: buildHeaders(),
      timeoutMs: 5000,
    });
    return resp.statusCode < 500;
  } catch {
    return false;
  }
}
