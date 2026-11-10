// SPDX-License-Identifier: AGPL-3.0-only
/**
 * NPRI (National Pollutant Release Inventory) Types — Quill
 *
 * Strongly-typed interfaces for Canada's National Pollutant Release Inventory.
 * Tracks pollutant releases by facilities across Canada — air, water, land,
 * as well as off-site disposal and recycling.
 *
 * Primary source:
 *   https://www.canada.ca/en/environment-climate-change/services/national-pollutant-release-inventory.html
 *   CKAN: open.canada.ca datasets for NPRI
 *
 * Cross-reference opportunities:
 *   - Corporate: parent companies matching lobbying/procurement records
 *   - Oversight: ECCC enforcement actions against NPRI reporters
 *   - Municipal: facilities located in specific cities/municipalities
 *   - Geospatial: facility location mapping
 */

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single NPRI facility pollutant release record.
 */
export interface NpriRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Facility name */
  facilityName: string;

  /** Facility location (city, address) */
  facilityLocation: string | null;

  /** Province or territory (two-letter code) */
  province: string | null;

  /** Latitude of facility */
  latitude: number | null;

  /** Longitude of facility */
  longitude: number | null;

  /** Substance name (e.g. "Mercury", "Lead", "Cadmium") */
  substanceName: string;

  /** CAS Registry Number for the substance */
  substanceCas: string | null;

  /** Release to air (kg) */
  releaseAirKg: number | null;

  /** Release to water (kg) */
  releaseWaterKg: number | null;

  /** Release to land (kg) */
  releaseLandKg: number | null;

  /** Off-site disposal (kg) */
  disposalKg: number | null;

  /** Off-site recycling (kg) */
  recyclingKg: number | null;

  /** Fiscal year of the reported data (e.g. "2023") */
  fiscalYear: string;

  /** Parent company / reported-by entity */
  reportedBy: string | null;

  /** Source URL on open.canada.ca or NPRI page */
  sourceUrl: string;

  /** CKAN package ID if sourced from open.canada.ca */
  ckanPackageId: string | null;

  /** CKAN resource ID if sourced from a specific resource */
  ckanResourceId: string | null;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Shape of a raw CKAN search result for NPRI packages. */
export interface RawNpriCkanPackage {
  id: string;
  name: string;
  title: string;
  notes: string | null;
  organization: {
    name: string;
    title: string;
  } | null;
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
    created: string;
    last_modified: string | null;
  }>;
  metadata_created: string;
  metadata_modified: string;
  tags?: Array<{ name: string }>;
  extras?: Array<{ key: string; value: string }>;
}

/** Raw NPRI record parsed from a CKAN resource row. */
export interface RawNpriRecord {
  facilityName?: string;
  facilityLocation?: string;
  province?: string;
  latitude?: string | number;
  longitude?: string | number;
  substanceName?: string;
  substanceCas?: string;
  releaseAirKg?: string | number;
  releaseWaterKg?: string | number;
  releaseLandKg?: string | number;
  disposalKg?: string | number;
  recyclingKg?: string | number;
  fiscalYear?: string;
  reportedBy?: string;
  sourceUrl?: string;
  ckanPackageId?: string;
  ckanResourceId?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface NpriIngestionOptions {
  /** Specific fiscal years to process */
  fiscalYears?: string[];
  /** Specific provinces to filter by */
  provinces?: string[];
  /** Max records to process */
  maxRecords?: number;
  /** Force re-ingest of already-ingested records */
  force?: boolean;
  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface NpriIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perSubstance: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
