// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Impact Assessment Agency of Canada Types — Quill
 *
 * Strongly-typed interfaces for federal project impact assessments conducted
 * by the Impact Assessment Agency of Canada (IAAC).
 *
 * Tracks federal project assessments, decisions, and conditions under:
 *   - Impact Assessment Act (IAA, 2019) — current
 *   - Canadian Environmental Assessment Act (CEAA, 2012) — previous
 *   - CEAA 2012 (original) — older
 *
 * Primary source:
 *   https://iaac-aeic.gc.ca (project search, decisions)
 *   https://iaac-aeic.gc.ca/050/evaluations/search
 *
 * Cross-reference opportunities:
 *   - NPRI: facility pollution in areas under assessment
 *   - Species at Risk: assessments affecting species habitat
 *   - Corporate: proponents with lobbying/procurement records
 *   - Oversight: follow-up programs and compliance
 */

/* ------------------------------------------------------------------ */
/*  Decision Types                                                     */
/* ------------------------------------------------------------------ */

/**
 * IAAC assessment decision outcomes.
 */
export type ImpactAssessmentDecision =
  | 'approved'          // Project approved (with conditions)
  | 'approved-with-conditions' // Project approved subject to conditions
  | 'denied'            // Project denied
  | 'pending'           // Assessment in progress
  | 'withdrawn'         // Proponent withdrew the project
  | 'exempted'          // Exempted from full assessment
  | 'referred'          // Referred to review panel
  | 'not-required'      // Assessment not required
  | 'unknown';

/**
 * Type of impact assessment process.
 */
export type AssessmentType =
  | 'iaa'               // Impact Assessment Act (2019-present)
  | 'ceaa-2012'         // CEAA 2012
  | 'ceaa-2012-original' // Original CEAA 2012
  | 'panel-review'      // Independent review panel
  | 'substituted'       // Substituted provincial assessment
  | 'unknown';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single IAAC project assessment record.
 */
export interface ImpactAssessmentRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Project name */
  projectName: string;

  /** Proponent (company/organization proposing the project) */
  proponent: string | null;

  /** Type of project (e.g. "Mining", "Pipeline", "Hydroelectric") */
  projectType: string | null;

  /** Project location description */
  location: string | null;

  /** Province or territory */
  province: string | null;

  /** Regulatory decision */
  decision: ImpactAssessmentDecision;

  /** Date of the decision (ISO-8601) */
  decisionDate: string | null;

  /** URL to the conditions document */
  conditionsUrl: string | null;

  /** URL to the assessment report */
  assessmentReportUrl: string | null;

  /** IAAC project reference number */
  iaacReferenceNumber: string | null;

  /** CEAA reference number (older projects) */
  ceaaReferenceNumber: string | null;

  /** Type of assessment */
  assessmentType: AssessmentType;

  /** Whether a federal-provincial agreement exists */
  federalProvincialAgreement: boolean | null;

  /** Source URL on iaac-aeic.gc.ca */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Raw IAAC project record from the search API or page scrape. */
export interface RawImpactAssessmentRecord {
  projectName?: string;
  proponent?: string;
  projectType?: string;
  location?: string;
  province?: string;
  decision?: string;
  decisionDate?: string;
  conditionsUrl?: string;
  assessmentReportUrl?: string;
  iaacReferenceNumber?: string;
  ceaaReferenceNumber?: string;
  assessmentType?: string;
  federalProvincialAgreement?: boolean | string;
  sourceUrl?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface IaacIngestionOptions {
  /** Project type filter */
  projectTypes?: string[];
  /** Province filter */
  provinces?: string[];
  /** Decision filter */
  decisions?: ImpactAssessmentDecision[];
  /** Max records to process */
  maxRecords?: number;
  /** Force re-ingest of already-ingested records */
  force?: boolean;
  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface IaacIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perDecision: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
