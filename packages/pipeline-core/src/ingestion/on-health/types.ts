/**
 * Ontario Health Records Types — Quill
 *
 * Strongly-typed interfaces for Ontario health records:
 *   - OHIP Claims — Ontario Health Insurance Plan claims data
 *   - Public Health Ontario — publications and data releases
 *
 * Primary sources:
 *   OHIP Claims:          https://data.ontario.ca/dataset/ohip-claims
 *   Public Health Ontario: https://www.publichealthontario.ca/en/data-and-analysis
 *
 * Cross-reference opportunities:
 *   - Health Canada: federal drug approvals vs Ontario claims
 *   - Corporate: private health service providers linked to lobbying
 *   - Legislation: Ontario health regulations affecting claims
 */

/* ------------------------------------------------------------------ */
/*  Record Type Enum                                                   */
/* ------------------------------------------------------------------ */

/** Ontario health record categories tracked. */
export type OntarioHealthRecordType =
  | 'ohip_claim'    // OHIP claims data
  | 'public_health'; // Public Health Ontario publications

/* ------------------------------------------------------------------ */
/*  OHIP Claim Types                                                   */
/* ------------------------------------------------------------------ */

/** OHIP claim service categories. */
export type OHIPClaimType =
  | 'physician_service'    // Physician services
  | 'laboratory'           // Laboratory services
  | 'diagnostic_imaging'   // Diagnostic imaging
  | 'hospital_service'     // Hospital services
  | 'dental_service'       // Dental services
  | 'optometry_service';   // Optometry services

/* ------------------------------------------------------------------ */
/*  Public Health Topics                                               */
/* ------------------------------------------------------------------ */

/** Public Health Ontario publication topics. */
export type PublicHealthTopic =
  | 'infectious_disease'   // Infectious diseases
  | 'chronic_disease'      // Chronic diseases
  | 'environmental_health' // Environmental health
  | 'health_promotion'     // Health promotion
  | 'injury_prevention'    // Injury prevention
  | 'mental_health'        // Mental health
  | 'substance_use'        // Substance use
  | 'health_equity'        // Health equity
  | 'surveillance'         // Health surveillance
  | 'epidemiology'         // Epidemiology
  | 'vaccination'          // Vaccination programs
  | 'other';               // Other topics

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single Ontario health record.
 * Normalised across OHIP claims and Public Health Ontario publications.
 */
export interface OntarioHealthRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Record type (OHIP claim or Public Health Ontario publication) */
  recordType: OntarioHealthRecordType;

  /** OHIP claim service type */
  claimType: OHIPClaimType | null;

  /** Service code (for OHIP claims) */
  serviceCode: string | null;

  /** Fee schedule (for OHIP claims) */
  feeSchedule: string | null;

  /** Service date (ISO-8601) */
  serviceDate: string | null;

  /** Provider type (for OHIP claims) */
  providerType: string | null;

  /** Number of claims (for OHIP claims) */
  claimsCount: number | null;

  /** Total amount paid (for OHIP claims) */
  totalPaid: number | null;

  /** Fiscal year (YYYY-YYYY format) */
  fiscalYear: string | null;

  /** Publication title (for Public Health Ontario) */
  title: string | null;

  /** Publication topic */
  topic: PublicHealthTopic | null;

  /** Publication date (ISO-8601) */
  publicationDate: string | null;

  /** Publication summary/description */
  summary: string | null;

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

/** Generic raw record from Ontario health sources. */
export interface RawOntarioHealthRecord {
  recordType?: string;
  claimType?: string;
  serviceCode?: string;
  feeSchedule?: string;
  serviceDate?: string;
  providerType?: string;
  claimsCount?: string | number;
  totalPaid?: string | number;
  fiscalYear?: string;
  title?: string;
  topic?: string;
  publicationDate?: string;
  summary?: string;
  sourceUrl?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of an OHIP claims CSV/JSON API response item. */
export interface OhipApiRecord {
  service_code?: string;
  fee_schedule?: string;
  service_date?: string;
  provider_type?: string;
  claims_count?: string | number;
  total_paid?: string | number;
  fiscal_year?: string;
  [key: string]: unknown;
}

/** Shape of a Public Health Ontario RSS/API item. */
export interface PublicHealthApiRecord {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  category?: string;
  topic?: string;
  published_date?: string;
  summary?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface OntarioHealthIngestionOptions {
  /** Record types to ingest (default: both) */
  recordTypes?: OntarioHealthRecordType[];

  /** OHIP claim types to ingest */
  claimTypes?: OHIPClaimType[];

  /** Public Health topics to ingest */
  topics?: PublicHealthTopic[];

  /** Max records to process per type */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface OntarioHealthIngestionResult {
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