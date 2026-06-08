// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * UNESCO SDMX-JSON Parser
 *
 * Parses SDMX-JSON v2 responses from the UNESCO Institute for Statistics API
 * into normalized UnescoRecord arrays.
 *
 * The SDMX-JSON structure is identical in format to ILO and other SDMX providers:
 * - structures[] define dimension metadata (REF_AREA, SEX, EDUCATION_LEVEL, etc.)
 * - dataSets[] contain the actual time-series observations
 * - annotations[] provide metadata about the data
 */

import type {
  UnescoSdmxResponse,
  UnescoRecord,
  UnescoDataStructure,
  UnescoDataSet,
} from "./types.js";

/**
 * Parse a full UNESCO SDMX-JSON response into normalized records.
 *
 * Extracts dimension metadata from the structure definition to map
 * dimension key values (e.g., "CAN") to human-readable names (e.g., "Canada").
 * Iterates over all time-series observations and produces one record per
 * observation per dimension combination.
 */
export function parseSdmxResponse(
  response: UnescoSdmxResponse,
  indicatorCode: string,
  indicatorName: string,
  category: string,
): UnescoRecord[] {
  const records: UnescoRecord[] = [];
  const { structures, dataSets, annotations } = response.data;

  if (!structures.length || !dataSets.length) return records;

  const structure = structures[0];

  // Build dimension value lookups from the series dimensions
  const { refAreaValues, sexValues, eduLevelValues, ageValues } =
    buildDimensionLookups(structure);

  // Build annotation lookup
  const annotationMap = new Map<number, string>();
  for (const ann of annotations) {
    annotationMap.set(annotations.indexOf(ann), ann.title);
  }

  const sourceUrl = `${response.meta.sender.id}/data/DF_${indicatorCode}`;

  for (const dataSet of dataSets) {
    for (const [seriesKey, series] of Object.entries(dataSet.series ?? {})) {
      const dimKeys = seriesKey.split(":");

      // Map dimension keys to values for this series
      const { refArea, refAreaName, sex, educationLevel, ageGroup } =
        mapSeriesDimensions(dimKeys, structure, {
          refAreaValues,
          sexValues,
          eduLevelValues,
          ageValues,
        });

      // Parse all time-series observations
      for (const [time, values] of Object.entries(series.observations ?? {})) {
        const year = parseInt(time, 10);
        if (isNaN(year)) continue;

        const value = values[0] ?? null;

        records.push({
          indicatorCode,
          indicatorName,
          category,
          refArea,
          refAreaName,
          year,
          value,
          frequency: "A",
          ...(sex ? { sex } : {}),
          ...(educationLevel ? { educationLevel } : {}),
          ...(ageGroup ? { ageGroup } : {}),
          ingestedAt: new Date().toISOString(),
          sourceUrl,
        } satisfies UnescoRecord);
      }
    }
  }

  return records;
}

/**
 * Build lookup maps for dimension values from the SDMX structure definition.
 */
function buildDimensionLookups(structure: UnescoDataStructure): {
  refAreaValues: Map<string, string>;
  sexValues: Map<string, string>;
  eduLevelValues: Map<string, string>;
  ageValues: Map<string, string>;
} {
  const refAreaValues = new Map<string, string>();
  const sexValues = new Map<string, string>();
  const eduLevelValues = new Map<string, string>();
  const ageValues = new Map<string, string>();

  const seriesDims = structure.dimensions.series ?? [];

  for (const dim of seriesDims) {
    if (dim.roles.includes("REF_AREA")) {
      for (const v of dim.values) {
        refAreaValues.set(v.id, v.name);
      }
    } else if (dim.id === "SEX" || dim.roles.includes("SEX")) {
      for (const v of dim.values) {
        sexValues.set(v.id, v.name);
      }
    } else if (
      dim.id === "EDUCATION_LEVEL" ||
      dim.id === "EDUCATION_ISCE" ||
      dim.roles.includes("EDUCATION_LEVEL") ||
      dim.roles.includes("ISCE")
    ) {
      for (const v of dim.values) {
        eduLevelValues.set(v.id, v.name);
      }
    } else if (dim.id === "AGE" || dim.roles.includes("AGE")) {
      for (const v of dim.values) {
        ageValues.set(v.id, v.name);
      }
    }
  }

  return { refAreaValues, sexValues, eduLevelValues, ageValues };
}

interface DimensionLookups {
  refAreaValues: Map<string, string>;
  sexValues: Map<string, string>;
  eduLevelValues: Map<string, string>;
  ageValues: Map<string, string>;
}

/**
 * Map dimension key values from the series key to human-readable names.
 */
function mapSeriesDimensions(
  dimKeys: string[],
  structure: UnescoDataStructure,
  lookups: DimensionLookups,
): {
  refArea: string;
  refAreaName: string;
  sex?: string;
  educationLevel?: string;
  ageGroup?: string;
} {
  const seriesDims = structure.dimensions.series ?? [];
  let refArea = "";
  let refAreaName = "";
  let sex: string | undefined;
  let educationLevel: string | undefined;
  let ageGroup: string | undefined;

  for (let i = 0; i < dimKeys.length; i++) {
    if (i < seriesDims.length) {
      const dim = seriesDims[i];
      const key = dimKeys[i];

      if (dim.roles.includes("REF_AREA")) {
        refArea = key;
        refAreaName = lookups.refAreaValues.get(key) ?? key;
      } else if (dim.id === "SEX" || dim.roles.includes("SEX")) {
        sex = lookups.sexValues.get(key) ?? key;
      } else if (
        dim.id === "EDUCATION_LEVEL" ||
        dim.id === "EDUCATION_ISCE" ||
        dim.roles.includes("EDUCATION_LEVEL") ||
        dim.roles.includes("ISCE")
      ) {
        educationLevel = lookups.eduLevelValues.get(key) ?? key;
      } else if (dim.id === "AGE" || dim.roles.includes("AGE")) {
        ageGroup = lookups.ageValues.get(key) ?? key;
      }
    }
  }

  return { refArea, refAreaName, sex, educationLevel, ageGroup };
}
