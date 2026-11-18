// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CIPO (Canadian Intellectual Property Office) Types — Quill
 *
 * Strongly-typed interfaces for Canadian IP rights records:
 *   - Patents (Canadian Patent Database)
 *   - Trademarks (Canadian Trademarks Database)
 *   - Industrial Designs (Industrial Design Database)
 *
 * Primary sources:
 *   Patent Database:       http://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/search.html
 *   Trademarks Database:   http://www.ic.gc.ca/app/opic-cipo/trdmks/eng/search.html
 *   Industrial Designs:    https://www.ic.gc.ca/opic-cipo/id/eng/search.html
 *
 * Cross-reference opportunities:
 *   - Corporate: patent/trademark owners linked to lobbying/procurement
 *   - Health Canada: pharmaceutical patents linked to DPD drug records
 *   - Influence: IP portfolio concentration by foreign entities
 */

/* ------------------------------------------------------------------ */
/*  IP Type Enum                                                       */
/* ------------------------------------------------------------------ */

/** The three categories of Canadian IP rights tracked. */
export type CipoIpType =
  | 'patent'           // Canadian Patent Database
  | 'trademark'         // Canadian Trademarks Database
  | 'industrial_design'; // Industrial Design Database

/* ------------------------------------------------------------------ */
/*  IP Status                                                          */
/* ------------------------------------------------------------------ */

/** Current status of an IP right application or registration. */
export type CipoStatus =
  | 'active'           // Granted/registered and in force
  | 'pending'          // Application under examination
  | 'abandoned'        // Application abandoned
  | 'expired'          // Term expired
  | 'refused'          // Application refused
  | 'withdrawn'        // Application withdrawn
  | 'opposed'          // Under opposition (trademarks)
  | 'expunged'         // Removed from register
  | 'unknown';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single CIPO IP rights record — patent, trademark, or industrial design.
 * Normalised across all three IP types.
 */
export interface CipoRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Application or registration number */
  applicationNumber: string;

  /** Filing date (ISO-8601) */
  filingDate: string | null;

  /** Current status of the IP right */
  status: CipoStatus;

  /** IP type category */
  type: CipoIpType;

  /** Title of the invention, mark, or design */
  title: string;

  /** Owner/applicant name */
  ownerName: string | null;

  /** Agent or representative name */
  agentName: string | null;

  /** IPC classification (patents) — semi-colon separated */
  ipcClassification: string | null;

  /** Nice classification (trademarks) — semi-colon separated */
  niceClassification: string | null;

  /** Registration/grant date (ISO-8601) */
  registrationDate: string | null;

  /** Expiry/end-of-term date (ISO-8601) */
  expiryDate: string | null;

  /** Publication date (ISO-8601) */
  publicationDate: string | null;

  /** Abstract or description */
  description: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Generic raw record from any CIPO source. */
export interface RawCipoRecord {
  applicationNumber?: string;
  filingDate?: string | null;
  status?: string | null;
  type?: string;
  title?: string | null;
  ownerName?: string | null;
  agentName?: string | null;
  ipcClassification?: string | null;
  niceClassification?: string | null;
  registrationDate?: string | null;
  expiryDate?: string | null;
  publicationDate?: string | null;
  description?: string | null;
  sourceUrl?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of a CIPO patent API/search response item. */
export interface CipoPatentApiRecord {
  application_number?: string;
  filing_date?: string;
  status?: string;
  title?: string;
  owner_name?: string;
  agent_name?: string;
  ipc_codes?: string;
  registration_date?: string;
  expiry_date?: string;
  publication_date?: string;
  abstract?: string;
  [key: string]: unknown;
}

/** Shape of a CIPO trademark API/search response item. */
export interface CipoTrademarkApiRecord {
  application_number?: string;
  filing_date?: string;
  status?: string;
  mark_name?: string;
  owner_name?: string;
  agent_name?: string;
  nice_classes?: string;
  registration_date?: string;
  expiry_date?: string;
  publication_date?: string;
  [key: string]: unknown;
}

/** Shape of a CIPO industrial design API/search response item. */
export interface CipoDesignApiRecord {
  application_number?: string;
  filing_date?: string;
  status?: string;
  design_name?: string;
  owner_name?: string;
  agent_name?: string;
  registration_date?: string;
  expiry_date?: string;
  publication_date?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface CipoIngestionOptions {
  /** IP types to ingest (default: all three) */
  ipTypes?: CipoIpType[];

  /** Year filter — fetch only records filed in this year */
  year?: number;

  /** Max records to process per IP type */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface CipoIngestionResult {
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
