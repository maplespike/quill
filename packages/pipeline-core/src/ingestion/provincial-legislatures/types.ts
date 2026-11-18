// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Legislatures Types — Quill
 *
 * Types for legislative data from all 10 Canadian provinces.
 * Covers Hansard transcripts, committee hearings, and bills.
 *
 * Each province publishes its own legislative data differently:
 *   - Ontario: ola.org (XML Hansard, committees API)
 *   - BC: leg.bc.ca (Hansard XML, committee pages)
 *   - Alberta: assembly.ab.ca (Hansard HTML, committee hearings)
 *   - Quebec: assnat.qc.ca (Hansard XML, French + English)
 *   - Saskatchewan, Manitoba, Nova Scotia, New Brunswick,
 *     Newfoundland, PEI, NS all have their own formats
 *
 * This module normalises across all provinces into a unified schema.
 */

/** Canadian province/territory code */
export type ProvinceCode =
  | 'ON' | 'BC' | 'AB' | 'QC' | 'SK' | 'MB'
  | 'NS' | 'NB' | 'NL' | 'PE' | 'NT' | 'YT' | 'NU';

/** Chamber within a provincial legislature */
export type ProvinceChamber = 'legislative-assembly' | 'legislative-council' | 'senate';

/** Type of legislative record */
export type LegislativeRecordType = 'hansard' | 'committee' | 'bill';

/**
 * A single provincial legislative record — a unified schema covering
 * Hansard transcripts, committee hearings, and bill-related records
 * from all 10 Canadian provinces.
 *
 * Fields are nullable where not all data sources provide them.
 */
export interface ProvincialLegislatureRecord {
  /** SHA-256 hash of the record content (primary key) */
  id: string;

  /** Province code (ON, BC, AB, QC, SK, MB, NS, NB, NL, PE) */
  province: ProvinceCode;

  /** Type of record: hansard, committee, or bill */
  recordType: LegislativeRecordType;

  /** Chamber (typically 'legislative-assembly' for unicameral provinces) */
  chamber: ProvinceChamber;

  /** Date the legislature sat / the bill was introduced */
  sittingDate: string | null;

  /** URL to the full Hansard transcript */
  hansardUrl: string | null;

  /** Meeting topic / debate subject */
  topic: string | null;

  /** Speaker name (for Hansard and committee interventions) */
  speaker: string | null;

  /** Speaker's party affiliation */
  party: string | null;

  /** Speaker's electoral district / riding */
  riding: string | null;

  /** Text excerpt from the transcript */
  textExcerpt: string | null;

  /** Reference to a specific bill being discussed */
  billReference: string | null;

  /** Bill number (e.g. "Bill 124", "Bill C-3") */
  billNumber: string | null;

  /** Bill short title */
  billTitle: string | null;

  /** Bill status (for bills table) */
  billStatus: string | null;

  /** Bill introduction date */
  billDate: string | null;

  /** Committee name (for committee hearings) */
  committeeName: string | null;

  /** Meeting number within the committee */
  meetingNumber: number | null;

  /** Meeting start time */
  meetingStartTime: string | null;

  /** Meeting end time */
  meetingEndTime: string | null;

  /** Number of interventions in a meeting (for summaries) */
  interventionCount: number | null;

  /** Language of the record ('en', 'fr', or null) */
  language: string | null;

  /** Source URL where the record was originally retrieved */
  sourceUrl: string;

  /** Original ID from the source system */
  sourceRecordId: string | null;

  /** Source system name (e.g. 'ola-xml', 'bcleg-xml', 'assembly-ab-html') */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * Ingestion options for provincial legislature data.
 */
export interface ProvincialLegislatureIngestionOptions {
  /** Specific provinces to ingest (default: all) */
  provinces?: ProvinceCode[];

  /** Record types to include (default: all) */
  recordTypes?: LegislativeRecordType[];

  /** Start date for fetching records (ISO-8601) */
  dateFrom?: string;

  /** End date for fetching records (ISO-8601) */
  dateTo?: string;

  /** Max records per province (default: 500) */
  maxRecordsPerProvince?: number;

  /** Progress callback */
  onProgress?: (msg: string) => void;

  /** Force re-ingest already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
}

/**
 * Result of a provincial legislature ingestion run.
 */
export interface ProvincialLegislatureIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perProvince: Record<string, {
    recordsFound: number;
    recordsIngested: number;
    newRecords: number;
    errors: string[];
  }>;
  durationMs: number;
}

/**
 * Configuration for a single province data source.
 */
export interface ProvinceLegislatureConfig {
  /** Province code */
  province: ProvinceCode;

  /** Province name */
  name: string;

  /** Official legislative assembly name */
  assemblyName: string;

  /** Base URL for legislative data */
  baseUrl: string;

  /** Hansard URL template (if available) */
  hansardUrl: string;

  /** Committees URL */
  committeesUrl: string;

  /** Bills URL */
  billsUrl: string;

  /** API endpoints (if available) */
  apiEndpoints?: {
    hansard?: string;
    committees?: string;
    bills?: string;
  };

  /** Whether the province publishes XML Hansard */
  hasXmlHansard: boolean;

  /** Whether the province has a committee API */
  hasCommitteeApi: boolean;

  /** Whether the province has a bills API */
  hasBillsApi: boolean;

  /** Notes about data format / quirks */
  notes?: string;
}
