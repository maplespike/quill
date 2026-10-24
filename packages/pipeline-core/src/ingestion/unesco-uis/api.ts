// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UNESCO UIS API Fetcher
 *
 * Fetches SDMX-JSON data from the UNESCO Institute for Statistics API.
 * Uses the shared httpGet utility with automatic retry, backoff, and
 * per-domain rate limiting.
 */

import { httpGet } from "../../utils/http.js";
import {
  UNESCO_SDMX_BASE_URL,
  UNESCO_TIMEOUT_MS,
  UNESCO_USER_AGENT,
  UNESCO_DATASETS,
  buildDatasetUrl,
  validateDatasetId,
} from "./constants.js";
import { UnescoApiError } from "./types.js";
import type { UnescoSdmxResponse } from "./types.js";

/**
 * Fetch a specific UNESCO UIS dataset as SDMX-JSON.
 *
 * @param datasetId - Dataset identifier (e.g., "EDULIT_DS", "SCN_DS", "CLT_DS")
 * @param countryCode - Optional ISO-3 country code filter (e.g., "CAN")
 * @returns Parsed SDMX-JSON response
 */
export async function fetchUnescoDataset(
  datasetId: string,
  countryCode?: string,
): Promise<UnescoSdmxResponse> {
  if (!validateDatasetId(datasetId)) {
    throw new Error(`Unknown UNESCO dataset: ${datasetId}. Valid: ${UNESCO_DATASETS.map((d) => d.id).join(", ")}`);
  }

  const url = buildDatasetUrl(datasetId, "json", countryCode);

  const resp = await httpGet(url, {
    timeoutMs: UNESCO_TIMEOUT_MS,
    headers: {
      Accept: "application/json",
      "User-Agent": UNESCO_USER_AGENT,
    },
  });

  if (resp.statusCode >= 400) {
    const err = new UnescoApiError(
      `UNESCO UIS API returned ${resp.statusCode} for dataset ${datasetId}: ${resp.body.slice(0, 500)}`,
    );
    throw err;
  }

  if (resp.statusCode === 0) {
    const err = new UnescoApiError(
      `UNESCO UIS API unreachable for dataset ${datasetId} (all retries failed)`,
    );
    throw err;
  }

  const body = await resp.json<UnescoSdmxResponse>();

  // Some UNESCO endpoints wrap in a { data: ... } envelope
  if (body && typeof body === "object" && "data" in body && !("structure" in body)) {
    const inner = (body as Record<string, unknown>).data;
    if (inner && typeof inner === "object" && "structure" in (inner as object)) {
      return inner as unknown as UnescoSdmxResponse;
    }
  }

  return body;
}

/**
 * Health check: verify the UNESCO UIS API is reachable.
 *
 * @returns true if API responds with 2xx, false otherwise
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const resp = await httpGet(`${UNESCO_SDMX_BASE_URL}/data/UNESCO,EDULIT_DS,1.0?format=json`, {
      timeoutMs: 15_000,
      method: "HEAD",
      headers: {
        "User-Agent": UNESCO_USER_AGENT,
      },
    });
    return resp.statusCode >= 200 && resp.statusCode < 400;
  } catch {
    return false;
  }
}
