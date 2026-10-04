// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Alberta Health Records Types — Quill
 *
 * Strongly-typed interfaces for Alberta Health Services (AHS) operational metrics
 * and Alberta Health data from open.alberta.ca CKAN portal.
 *
 * Primary sources:
 *   - Surgical Wait Times: https://open.alberta.ca/dataset/surgical-wait-times
 *   - Emergency Department Metrics: https://open.alberta.ca/dataset/emergency-department-wait-times
 *   - Diagnostic Imaging Metrics: https://open.alberta.ca/dataset/diagnostic-imaging-metrics
 *   - Inpatient Care Metrics: https://open.alberta.ca/dataset/inpatient-care-metrics
 *
 * Cross-reference opportunities:
 *   - Federal: Health Canada licensing, CIHI data
 *   - Provincial: Other provincial health metrics for comparison
 */

/* ------------------------------------------------------------------ */
/*  Record Type Enum                                                    */
/* ------------------------------------------------------------------ */

/** The four categories of Alberta Health Services operational metrics tracked. */
export type AHSRecordType =
  | 'surgery'      // Surgical wait times
  | 'emergency'    // Emergency department metrics
  | 'diagnostic'   // Diagnostic imaging metrics
  | 'inpatient';   // Inpatient care metrics

/** The five AHS zones for geographic filtering. */
export type AHSZone =
  | 'Calgary Zone'
  | 'Edmonton Zone'
  | 'Central Zone'
  | 'North Zone'
  | 'South Zone';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single Alberta Health Services operational metric record.
 * Normalised across surgical, emergency, diagnostic, and inpatient data.
 */
export interface AHSRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Record category (surgery, emergency, diagnostic, inpatient) */
  category: AHSRecordType;

  /** Metric name or measure */
  measure: string;

  /** Metric value (as string to preserve precision and units) */
  value: string;

  /** AHS geographic zone */
  region: string | null;

  /** Fiscal year (e.g. "2024-2025") */
  fiscalYear: string | null;

  /** Quarter (Q1, Q2, Q3, Q4) */
  quarter: string | null;

  /** Source URL on open.alberta.ca */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * A single Alberta Health publication/report record.
 */
export interface ABHealthRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Publication title */
  title: string;

  /** Topic area */
  topic: string;

  /** Publication date (ISO-8601) */
  publicationDate: string | null;

  /** Data type (report, dataset, summary, etc.) */
  dataType: string | null;

  /** Source URL */
  url: string;

  /** Brief summary */
  summary: string | null;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Generic raw record from any Alberta Health source. */
export type AHSHealthCategory = 'surgery' | 'emergency' | 'diagnostic' | 'inpatient' | 'outpatient' | 'pharmaceutical';

export interface RawAHSRecord {
  category?: string;
  measure?: string;
  value?: string;
  region?: string;
  fiscalYear?: string;
  fiscal_year?: string;
  quarter?: string;
  sourceUrl?: string;
  source_url?: string;
  sourceSystem?: string;
  source_system?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Generic raw publication record. */
export interface RawABHealthPublication {
  title?: string;
  topic?: string;
  publicationDate?: string;
  publication_date?: string;
  dataType?: string;
  data_type?: string;
  url?: string;
  summary?: string;
  description?: string;
  sourceSystem?: string;
  source_system?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of a CKAN API response item (for open.alberta.ca). */
export interface CkanApiRecord {
  id?: string;
  name?: string;
  title?: string;
  notes?: string;
  resources?: Array<{
    url?: string;
    format?: string;
    name?: string;
  }>;
  organization?: {
    title?: string;
  };
  [key: string]: unknown;
}

/** Shape of CKAN search response. */
export interface CkanSearchResponse {
  result?: {
    count?: number;
    results?: CkanApiRecord[];
  };
  success?: boolean;
  error?: {
    message?: string;
  };
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface ABHealthIngestionOptions {
  /** Record types to ingest (default: all four) */
  recordTypes?: AHSRecordType[];

  /** Include publications (default: false) */
  includePublications?: boolean;

  /** Max records to process per record type */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface ABHealthIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  Search Options                                                     */
/* ------------------------------------------------------------------ */

export interface ABHealthSearchOptions {
  limit?: number;
  category?: AHSRecordType;
  region?: string;
  fiscalYear?: string;
  quarter?: string;
}