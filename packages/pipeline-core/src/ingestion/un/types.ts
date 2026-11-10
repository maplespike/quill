// SPDX-License-Identifier: AGPL-3.0-only
/**
 * UN Data Types — Quill
 *
 * Strongly typed interfaces for the UNdata SDMX REST API.
 * Covers 32+ databases with ~60M records across population, trade,
 * development, environment, health, education, and more.
 *
 * API Docs: http://data.un.org/Host.aspx?Content=API
 * Terms: Consult UNdata and agency-specific terms; do not infer permission from API access.
 */

/* ------------------------------------------------------------------ */
/* Base Record Types */
/* ------------------------------------------------------------------ */

/** Common fields across all UNdata records. */
export interface UnRecord {
  /** SHA-256 hash of the row content (primary key) */
  id: string;
  /** UN database code (e.g. "POP", "TRAD", "EDULIT") */
  databaseCode: string;
  /** Human-readable database name */
  databaseName: string;
  /** Data category group (population, trade, health, etc.) */
  category: UnDataCategory;
  /** The numeric value */
  value: number | null;
  /** ISO-3 country code (e.g. "CAN", "USA") */
  refArea: string;
  /** Country or area name */
  refAreaName: string;
  /** Time period (year or date string) */
  timePeriod: string;
  /** Year extracted from time period */
  year: number;
  /** SDMX series key (dimension values concatenated) */
  seriesKey: string;
  /** Unit of measurement */
  unit: string | null;
  /** SDMX observation status (e.g. "A" = normal, "E" = estimated) */
  obsStatus: string | null;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
  /** Source URL for provenance */
  sourceUrl: string;
}

export type UnDataCategory =
  | 'population'
  | 'trade'
  | 'development'
  | 'environment'
  | 'health'
  | 'education'
  | 'labour'
  | 'energy'
  | 'crime'
  | 'gender'
  | 'tourism'
  | 'finance';

/* ------------------------------------------------------------------ */
/* Ingestion Result */
/* ------------------------------------------------------------------ */

export interface UnIngestionResult {
  databaseCode: string;
  databaseName: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}

export interface UnAllDatabasesResult {
  results: UnIngestionResult[];
  totalRecords: number;
  totalErrors: number;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* SDMX-ML API Response Types */
/* ------------------------------------------------------------------ */

/**
 * Parsed SDMX-ML structure from fast-xml-parser.
 * The UN SDMX REST API returns XML with <message:Structure>
 * and <message:GenericData> envelopes.
 */
export interface SdmxMessage {
  'message:Structure'?: SdmxStructure;
  'message:GenericData'?: SdmxGenericData;
  'message:CompactData'?: SdmxCompactData;
  'message:ErrorMessage'?: SdmxErrorMessage;
}

export interface SdmxStructure {
  'message:Header'?: SdmxHeader;
  'structure:Structures'?: SdmxStructures;
}

export interface SdmxGenericData {
  'message:Header'?: SdmxHeader;
  'message:DataSet'?: SdmxDataSet | SdmxDataSet[];
}

export interface SdmxCompactData {
  'message:Header'?: SdmxHeader;
  'message:DataSet'?: SdmxDataSet | SdmxDataSet[];
}

export interface SdmxErrorMessage {
  'common:StatusText'?: Record<string, unknown>;
}

export interface SdmxHeader {
  'message:ID'?: string;
  'message:Prepared'?: string;
  'message:Sender'?: Record<string, unknown>;
}

export interface SdmxStructures {
  'structure:DataStructures'?: Record<string, unknown>;
  'structure:Codelists'?: Record<string, unknown>;
}

export interface SdmxDataSet {
  '@structure'?: string;
  '@dataScope'?: string;
  'generic:Series'?: SdmxSeries | SdmxSeries[];
  'Series'?: SdmxSeries | SdmxSeries[];
}

export interface SdmxSeries {
  'generic:SeriesKey'?: SdmxSeriesKey;
  'generic:Obs'?: SdmxObs | SdmxObs[];
  'SeriesKey'?: SdmxSeriesKey;
  'Obs'?: SdmxObs | SdmxObs[];
}

export interface SdmxSeriesKey {
  'generic:Value'?: SdmxValue[] | SdmxValue;
  'Value'?: SdmxValue[] | SdmxValue;
}

export interface SdmxValue {
  '@id'?: string;
  '@value'?: string;
  id?: string;
  value?: string;
}

export interface SdmxObs {
  'generic:ObsDimension'?: { '@value'?: string; value?: string };
  'generic:ObsValue'?: { '@value'?: string; value?: string | number };
  'generic:Attributes'?: Record<string, unknown>;
  'ObsDimension'?: { '@value'?: string; value?: string };
  'ObsValue'?: { '@value'?: string; value?: string | number };
  'Attributes'?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Dataflow (Database Listing) Types */
/* ------------------------------------------------------------------ */

export interface UnDataflowInfo {
  /** Dataflow ID (e.g. "UNSD/DF_POP") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Database code extracted from dataflow ID */
  databaseCode: string;
  /** Description if available */
  description: string | null;
}
