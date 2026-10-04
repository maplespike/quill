// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * BC Health Records Types — Quill
 *
 * Strongly-typed interfaces for British Columbia health data:
 *   - BC PharmaCare claims data — drug coverage and claims
 *   - BC CDC data — disease surveillance and publications
 *
 * Primary sources:
 *   PharmaCare:  https://catalogue.data.gov.bc.ca/dataset/pharmacare-benefits-claims-data
 *   BC CDC:      https://www.bccdc.ca/
 *
 * Cross-reference opportunities:
 *   - Corporate: pharmaceutical companies linked to lobbying/procurement
 *   - Federal:   cross-reference with Health Canada DPD for drug approvals
 *   - Education: health education programs in BC education data
 */

/* ------------------------------------------------------------------ */
/*  Record Types                                                       */
/* ------------------------------------------------------------------ */

/**
 * A single BC PharmaCare claim record.
 */
export interface PharmaCareRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Drug name or description */
  drugName: string;

  /** Manufacturer name */
  manufacturer: string | null;

  /** Formulary status */
  formularyStatus: 'full' | 'restricted' | 'non';

  /** ATC (Anatomical Therapeutic Chemical) code */
  atcCode: string | null;

  /** Therapeutic category */
  therapeuticCategory: string | null;

  /** Number of claims */
  claimCount: number;

  /** Total cost of claims */
  totalCost: number;

  /** Fiscal year (e.g., "2023-2024") */
  fiscalYear: string;

  /** Source URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * A single BC CDC publication record.
 */
export interface BCCDCRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Publication title */
  title: string;

  /** Topic or category */
  topic: string | null;

  /** Publication date (ISO-8601) */
  publicationDate: string | null;

  /** Disease focus area */
  diseaseFocus: string | null;

  /** URL to publication */
  url: string;

  /** Summary or abstract */
  summary: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Generic raw record from BC health sources. */
export type PharmaCareFormularyStatus = 'full' | 'restricted' | 'non';

export interface RawBCHealthRecord {
  drugName?: string;
  manufacturer?: string;
  formularyStatus?: string;
  atcCode?: string;
  therapeuticCategory?: string;
  claimCount?: number | string;
  totalCost?: number | string;
  fiscalYear?: string;
  sourceUrl?: string;
  title?: string;
  topic?: string;
  publicationDate?: string;
  diseaseFocus?: string;
  url?: string;
  summary?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of a PharmaCare API JSON response item. */
export interface PharmaCareApiRecord {
  drug_name?: string;
  manufacturer?: string;
  formulary_status?: string;
  atc_code?: string;
  therapeutic_category?: string;
  claim_count?: number;
  total_cost?: number;
  fiscal_year?: string;
  [key: string]: unknown;
}

/** Shape of a BC CDC API/publication record. */
export interface BCCDCApiRecord {
  title?: string;
  topic?: string;
  publication_date?: string;
  disease_focus?: string;
  url?: string;
  summary?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface BCHealthIngestionOptions {
  /** Data sources to ingest (default: both) */
  recordTypes?: ('pharmacare' | 'bccdc')[];

  /** Max records to process per source */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface BCHealthIngestionResult {
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