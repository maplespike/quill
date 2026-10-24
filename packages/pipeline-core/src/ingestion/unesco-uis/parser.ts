// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UNESCO UIS SDMX-JSON Parser
 *
 * Parses SDMX-JSON responses from the UNESCO Institute for Statistics API
 * into structured UnescoRecord objects with SHA-256 content hashing.
 *
 * SDMX-JSON structure:
 * - structure.dimensions.series: dimension definitions (REF_AREA, INDICATOR, TIME_PERIOD, etc.)
 * - structure.dimensions.observation: observation-level dimensions
 * - structure.attributes.observation: attribute definitions (OBS_STATUS, UNIT, etc.)
 * - dataSets[].series: keyed by dimension index combinations, each containing observations
 */

import { computeHash } from "../../verification/hashing.js";

import type { UnescoRecord, UnescoSdmxResponse } from "./types.js";

/**
 * Extract dimension value maps from SDMX-JSON structure.
 * Returns a map of dimension ID → array of {id, name} values.
 */
function extractDimensionMaps(
  response: UnescoSdmxResponse,
): Map<string, Array<{ id: string; name: string }>> {
  const dimMap = new Map<string, Array<{ id: string; name: string }>>();

  const dims = response.structure?.dimensions?.series ?? [];
  for (const dim of dims) {
    if (dim.values) {
      dimMap.set(dim.id, dim.values.map((v) => ({ id: v.id, name: v.name })));
    }
  }

  // Also include observation-level dimensions (e.g., TIME_PERIOD)
  const obsDims = response.structure?.dimensions?.observation ?? [];
  for (const dim of obsDims) {
    if (dim.values) {
      dimMap.set(dim.id, dim.values.map((v) => ({ id: v.id, name: v.name })));
    }
  }

  return dimMap;
}

/**
 * Extract attribute value maps from SDMX-JSON structure.
 * Returns a map of attribute ID → array of {id, name} values.
 */
function extractAttributeMaps(
  response: UnescoSdmxResponse,
): Map<string, Array<{ id: string; name: string }>> {
  const attrMap = new Map<string, Array<{ id: string; name: string }>>();

  const obsAttrs = response.structure?.attributes?.observation ?? [];
  for (const attr of obsAttrs) {
    if (attr.values) {
      attrMap.set(attr.id, attr.values.map((v) => ({ id: v.id, name: v.name })));
    }
  }

  const seriesAttrs = response.structure?.attributes?.series ?? [];
  for (const attr of seriesAttrs) {
    if (attr.values) {
      attrMap.set(attr.id, attr.values.map((v) => ({ id: v.id, name: v.name })));
    }
  }

  return attrMap;
}

/**
 * Parse a single observation value into a UnescoRecord.
 */
export async function parseObservation(
  country: string,
  indicatorCode: string,
  indicatorName: string,
  year: number,
  value: number,
  unit: string,
  obsStatus: string | undefined,
  datasetId: string,
  datasetName: string,
): Promise<UnescoRecord> {
  const content = `${datasetId}:${country}:${indicatorCode}:${year}:${value}:${unit}`;
  const id = await computeHash(content);

  return {
    id,
    datasetId,
    datasetName,
    country,
    indicatorCode,
    indicatorName,
    year,
    value,
    unit,
    obsStatus,
  };
}

/**
 * Parse an SDMX-JSON response from the UNESCO UIS API.
 *
 * Extracts records from the dataSets and structure sections of the response,
 * resolving dimension indices to their human-readable names.
 *
 * @param response - Parsed SDMX-JSON response object
 * @param datasetId - Dataset identifier (e.g., "EDULIT_DS")
 * @param datasetName - Human-readable dataset name
 * @returns Array of UnescoRecord objects
 */
export async function parseSdmxResponse(
  response: UnescoSdmxResponse,
  datasetId: string,
  datasetName: string,
): Promise<UnescoRecord[]> {
  const records: UnescoRecord[] = [];

  if (!response.dataSets || response.dataSets.length === 0) {
    return records;
  }

  const dimMap = extractDimensionMaps(response);
  const attrMap = extractAttributeMaps(response);

  // Resolve dimension arrays
  const refAreaValues = dimMap.get("REF_AREA") ?? [];
  const indicatorValues = dimMap.get("INDICATOR") ?? dimMap.get("MEASURE") ?? [];
  const timeValues = dimMap.get("TIME_PERIOD") ?? dimMap.get("TIME") ?? [];
  const unitValues = attrMap.get("UNIT") ?? attrMap.get("UNIT_MEASURE") ?? [];
  const obsStatusValues = attrMap.get("OBS_STATUS") ?? attrMap.get("OBS_STATUS_VALEUR") ?? [];

  for (const dataSet of response.dataSets) {
    if (!dataSet.series) continue;

    for (const [seriesKey, seriesData] of Object.entries(dataSet.series)) {
      // Series key is a colon-separated index string, e.g., "0:0:0"
      const indices = seriesKey.split(":").map((i) => parseInt(i, 10));

      // Map indices to dimension values
      const country = refAreaValues[indices[0]]?.id ?? `IDX_${indices[0]}`;
      const indicatorCode = indicatorValues[indices[1]]?.id ?? `IND_${indices[1]}`;
      const indicatorName = indicatorValues[indices[1]]?.name ?? `Indicator ${indices[1]}`;

      // Resolve series-level attributes
      const seriesAttrs = seriesData.attributes ?? [];
      let unit = "unknown";
      if (seriesAttrs.length > 0 && unitValues.length > 0) {
        const unitIdx = seriesAttrs[0];
        if (typeof unitIdx === "number" && unitIdx < unitValues.length) {
          unit = unitValues[unitIdx]?.id ?? unitValues[unitIdx]?.name ?? "unknown";
        }
      }

      // Parse observations
      if (!seriesData.observations) continue;

      for (const [obsKey, obsValue] of Object.entries(seriesData.observations)) {
        const obsIndex = parseInt(obsKey, 10);
        const timePeriod = timeValues[obsIndex];
        if (!timePeriod) continue;

        const year = parseInt(timePeriod.id, 10);
        if (isNaN(year)) continue;

        // Observation value is typically the first element of the array
        const value = Array.isArray(obsValue) ? obsValue[0] : obsValue;
        if (typeof value !== "number" || isNaN(value)) continue;

        // Resolve observation status from attributes (second element if present)
        let obsStatus: string | undefined;
        if (Array.isArray(obsValue) && obsValue.length > 1) {
          const statusIdx = obsValue[1];
          if (typeof statusIdx === "number" && statusIdx < obsStatusValues.length) {
            obsStatus = obsStatusValues[statusIdx]?.id ?? obsStatusValues[statusIdx]?.name;
          }
        }

        const record = await parseObservation(
          country,
          indicatorCode,
          indicatorName,
          year,
          value,
          unit,
          obsStatus,
          datasetId,
          datasetName,
        );

        records.push(record);
      }
    }
  }

  return records;
}

/**
 * Parse raw JSON text as SDMX-JSON and return records.
 * Wrapper around parseSdmxResponse that handles JSON parsing.
 *
 * @param jsonText - Raw JSON response string
 * @param datasetId - Dataset identifier
 * @param datasetName - Human-readable dataset name
 * @returns Array of UnescoRecord objects
 */
export async function parseSdmxJsonText(
  jsonText: string,
  datasetId: string,
  datasetName: string,
): Promise<UnescoRecord[]> {
  if (!jsonText || jsonText.trim().length === 0) {
    return [];
  }

  const parsed = JSON.parse(jsonText) as UnescoSdmxResponse;
  return parseSdmxResponse(parsed, datasetId, datasetName);
}

/**
 * Classify an observation status code into a human-readable label.
 */
export function classifyObsStatus(code: string | undefined): string {
  if (!code) return "unknown";
  const statusMap: Record<string, string> = {
    A: "Official",
    E: "Estimated",
    F: "Forecast",
    I: "Imputed",
    M: "Missing",
    P: "Provisional",
    S: "Adjusted",
    D: "Discontinued",
    L: "Missing value",
  };
  return statusMap[code] ?? "unknown";
}
