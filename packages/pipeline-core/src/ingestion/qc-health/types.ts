// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Quebec Health Records Types — Quill
 *
 * Strongly-typed interfaces for Quebec health records:
 *   - RAMQ medical claims statistics
 *   - INSPQ public health surveillance data
 *
 * Primary sources:
 *   RAMQ:     https://www.ramq.gouv.qc.ca
 *   INSPQ:    https://www.inspq.qc.ca
 *   Données Québec: https://www.donneesquebec.ca
 *
 * Cross-reference opportunities:
 *   - Regional: health outcomes by administrative region
 *   - Immigration: health services for newcomers
 *   - Education: school-based health programs
 */

/* ------------------------------------------------------------------ */
/*  Record Type Enum                                                   */
/* ------------------------------------------------------------------ */

export type RAMQRecordType =
  | 'ramq'     // RAMQ medical claims statistics
  | 'inspq';   // INSPQ public health surveillance

/* ------------------------------------------------------------------ */
/*  RAMQ Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single RAMQ medical claims record.
 */
export interface RAMQRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Type of claim (e.g., "physician", "pharmaceutical", "hospital") */
  claimType: string | null;

  /** Service code for the medical service */
  serviceCode: string | null;

  /** Date of service (ISO-8601) */
  serviceDate: string | null;

  /** Type of provider (e.g., "general practitioner", "specialist") */
  providerType: string | null;

  /** Type of beneficiary (e.g., "regular", "welfare", "senior") */
  beneficiaryType: string | null;

  /** Quebec administrative region */
  region: string | null;

  /** Number of claims in this aggregation */
  claimsCount: number | null;

  /** Total amount paid for these claims */
  totalPaid: number | null;

  /** Fiscal year (e.g., "2023-2024") */
  fiscalYear: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  QCHealth Record Type                                               */
/* ------------------------------------------------------------------ */

/**
 * A single Quebec health publication record (INSPQ).
 */
export interface QCHealthRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Title in English */
  title: string | null;

  /** Title in French */
  titleFr: string | null;

  /** Topic category (e.g., "infectious diseases", "chronic diseases") */
  topic: string | null;

  /** Publication date (ISO-8601) */
  publicationDate: string | null;

  /** URL to the publication */
  url: string;

  /** Summary or description */
  summary: string | null;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

export interface RawRAMQRecord {
  claim_type?: string;
  service_code?: string;
  service_date?: string;
  provider_type?: string;
  beneficiary_type?: string;
  region?: string;
  claims_count?: number;
  total_paid?: number;
  fiscal_year?: string;
  source_url?: string;

  [key: string]: unknown;
}

export interface RawQCHealthRecord {
  title?: string;
  title_fr?: string;
  topic?: string;
  publication_date?: string;
  url?: string;
  summary?: string;

  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface QCHealthIngestionOptions {
  /** Record types to ingest (default: both ramq and inspq) */
  recordTypes?: RAMQRecordType[];

  /** Max records to process per record type */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface QCHealthIngestionResult {
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