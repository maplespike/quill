/**
 * ATI (Access to Information) Types — Quill
 *
 * Types for completed ATI requests published by federal departments.
 * These are publicly-released records of completed Access to Information
 * requests, showing what information was requested and how much was
 * disclosed/exempted/excluded.
 *
 * Primary source: https://open.canada.ca/en/ati (CKAN-based)
 * Individual department ATI pages supplement the CKAN data.
 *
 * The ATI completions data is useful for:
 *   - Tracking which departments receive the most ATI requests
 *   - Analyzing exemption/exclusion rates by department
 *   - Identifying high-value ATI releases for content curation
 *   - Correlating with lobbying records (what are people requesting?)
 *
 * Cross-reference opportunities:
 *   - Lobbying: departments heavily lobbied may see more ATI requests
 *   - Oversight: OAG reports may reference completed ATIs
 *   - Procurement: ATI releases about contract awards
 */

/* ------------------------------------------------------------------ */
/*  Disposition Types                                                  */
/* ------------------------------------------------------------------ */

/** Outcome of an ATI request — how the department responded. */
export type AtiDisposition =
  | 'disclosed'       // All records released
  | 'disclosed-part'  // Records partially released (some exemptions applied)
  | 'exempted'        // Records withheld under specific exemption(s)
  | 'excluded'        // Records excluded (not under ATIA, Cabinet confidences, etc.)
  | 'no-records'      // No records exist matching the request
  | 'transferred'     // Request transferred to another institution
  | 'abandoned'       // Request abandoned by requester
  | 'pending'         // Still in process
  | 'unknown';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single completed ATI request record.
 */
export interface AtiRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Federal department or institution name */
  department: string;

  /** Department acronym (e.g. 'PSPC', 'HC', 'DND') */
  departmentAcronym: string | null;

  /** ATI request number assigned by the institution */
  requestNumber: string;

  /** Summary or description of what was requested */
  summary: string | null;

  /** Disposition — how the department handled the request */
  disposition: AtiDisposition;

  /** Number of pages released in response */
  pagesReleased: number | null;

  /** Number of pages withheld (exempted/excluded) */
  pagesWithheld: number | null;

  /** Date the request was completed (ISO-8601) */
  dateCompleted: string | null;

  /** Fiscal year the request was completed in */
  fiscalYear: string | null;

  /** Source URL on open.canada.ca or department ATI page */
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

/** Shape of a raw CKAN search result for ATI packages. */
export interface RawAtiCkanPackage {
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
  /** Tags/keywords for the ATI package */
  tags?: Array<{ name: string }>;
  /** ATI-specific extras (some CKAN instances add custom fields) */
  extras?: Array<{ key: string; value: string }>;
}

/** Raw ATI record parsed from a CKAN resource row or HTML page. */
export interface RawAtiRecord {
  /** Department name */
  department?: string;
  /** Department acronym */
  departmentAcronym?: string;
  /** Request number */
  requestNumber?: string;
  /** Request summary */
  summary?: string;
  /** Disposition text (raw from source) */
  disposition?: string;
  /** Pages released */
  pagesReleased?: string | number;
  /** Pages withheld */
  pagesWithheld?: string | number;
  /** Completion date */
  dateCompleted?: string;
  /** Fiscal year */
  fiscalYear?: string;
  /** Source URL */
  sourceUrl?: string;
  /** CKAN package ID */
  ckanPackageId?: string;
  /** CKAN resource ID */
  ckanResourceId?: string;
  /** Source system */
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface AtiIngestionOptions {
  /** Specific departments to process (default: all tracked) */
  departments?: string[];

  /** Specific fiscal years to fetch */
  fiscalYears?: string[];

  /** Max records to process (default: 1000) */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface AtiIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perDepartment: Record<string, {
    recordsFound: number;
    recordsIngested: number;
    errors: string[];
  }>;
  durationMs: number;
}
