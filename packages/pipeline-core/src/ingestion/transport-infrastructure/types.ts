// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Transport Infrastructure Data Types — Quill
 *
 * Types for Canadian transportation safety, infrastructure funding, and
 * regulatory data across 6 agencies:
 *   - TSB: Transportation Safety Board (occurrences/investigations)
 *   - Transport Canada: safety recalls, violations, audits, fines
 *   - CIIB: Canada Infrastructure Bank ($35B loan mandate)
 *   - CTA: Canadian Transportation Agency (airline rulings, accessibility)
 *   - Infrastructure Canada: project funding by riding/party
 *   - National Trade Corridors Fund: projects, rationale, amounts
 *
 * Source terms vary by publisher and dataset; public access does not establish reuse permission.
 */

/* ------------------------------------------------------------------ */
/*  TSB — Transportation Safety Board Occurrences                      */
/* ------------------------------------------------------------------ */

export interface TsbOccurrence {
  /** SHA-256 citation hash */
  id: string;

  /** TSB occurrence number (e.g. A21P0001) */
  occurrenceNumber: string;

  /** Mode of transport: aviation, rail, marine, pipeline */
  mode: 'aviation' | 'rail' | 'marine' | 'pipeline';

  /** Occurrence category: accident, incident */
  category: string;

  /** Occurrence status: active, closed, final-report */
  status: string;

  /** Date of occurrence (ISO 8601) */
  occurrenceDate: string | null;

  /** Location description */
  location: string | null;

  /** Province/territory */
  province: string | null;

  /** Latitude */
  latitude: number | null;

  /** Longitude */
  longitude: number | null;

  /** Fatalities count */
  fatalities: number | null;

  /** Injuries count */
  injuries: number | null;

  /** Aircraft/vehicle make */
  make: string | null;

  /** Aircraft/vehicle model */
  model: string | null;

  /** Registration (aircraft) */
  registration: string | null;

  /** Operator name */
  operator: string | null;

  /** Event types (comma-separated) */
  eventTypes: string | null;

  /** Narrative / description of occurrence */
  narrative: string | null;

  /** Source URL */
  sourceUrl: string;

  /** CKAN dataset ID */
  ckanDatasetId: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Transport Canada — Safety Recalls, Violations, Audits, Fines       */
/* ------------------------------------------------------------------ */

export interface TcRecall {
  id: string;
  /** Recall number */
  recallNumber: string | null;
  /** Vehicle make */
  make: string | null;
  /** Vehicle model */
  model: string | null;
  /** Year range (e.g. "2018-2021") */
  yearRange: string | null;
  /** Number of units affected */
  unitsAffected: number | null;
  /** Component/system */
  component: string | null;
  /** Hazard description */
  hazard: string | null;
  /** Corrective action */
  correctiveAction: string | null;
  /** Recall date */
  recallDate: string | null;
  /** Source URL */
  sourceUrl: string;
  /** CKAN dataset ID */
  ckanDatasetId: string;
  ingestedAt: string;
}

export interface TcViolationAudit {
  id: string;
  /** Violation or audit type */
  type: string;
  /** Organization / company */
  organization: string | null;
  /** Date of action */
  actionDate: string | null;
  /** Description */
  description: string | null;
  /** Penalty/fine amount if applicable */
  penaltyAmount: number | null;
  /** Source URL */
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  CIIB — Canada Infrastructure Bank Projects                         */
/* ------------------------------------------------------------------ */

export interface CiibProject {
  id: string;
  /** Project name */
  projectName: string;
  /** Sector (transport, energy, water, etc.) */
  sector: string | null;
  /** Sub-sector */
  subSector: string | null;
  /** Province/territory */
  province: string | null;
  /** CIIB investment amount (CAD) */
  ciibInvestment: number | null;
  /** Total project value (CAD) */
  totalProjectValue: number | null;
  /** Loan commitment date */
  commitmentDate: string | null;
  /** Project status (active, completed, etc.) */
  status: string | null;
  /** Counterparty / partner */
  counterparty: string | null;
  /** Description */
  description: string | null;
  /** Source URL */
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  CTA — Canadian Transportation Agency Rulings                       */
/* ------------------------------------------------------------------ */

export interface CtaRuling {
  id: string;
  /** Ruling / decision number */
  rulingNumber: string | null;
  /** Title */
  title: string | null;
  /** Case type (airline complaints, accessibility, etc.) */
  caseType: string | null;
  /** Complainant / applicant */
  complainant: string | null;
  /** Respondent / airline */
  respondent: string | null;
  /** Decision date */
  decisionDate: string | null;
  /** Ruling outcome */
  outcome: string | null;
  /** Summary */
  summary: string | null;
  /** Source URL */
  sourceUrl: string;
  /** CKAN dataset ID */
  ckanDatasetId: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Infrastructure Canada — Project Funding by Riding                  */
/* ------------------------------------------------------------------ */

export interface InfrastructureFunding {
  id: string;
  /** Project name */
  projectName: string;
  /** Recipient name */
  recipient: string | null;
  /** Province/territory */
  province: string | null;
  /** Federal electoral district (riding) */
  riding: string | null;
  /** Political party of MP */
  party: string | null;
  /** Funding program */
  program: string | null;
  /** Total federal contribution */
  federalContribution: number | null;
  /** Total project value */
  totalProjectValue: number | null;
  /** Announcement date */
  announcementDate: string | null;
  /** Project status */
  status: string | null;
  /** Description */
  description: string | null;
  /** Source URL */
  sourceUrl: string;
  /** CKAN dataset ID */
  ckanDatasetId: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  NTCF — National Trade Corridors Fund Projects                      */
/* ------------------------------------------------------------------ */

export interface NtcfProject {
  id: string;
  /** Project name */
  projectName: string;
  /** Recipient / applicant */
  recipient: string | null;
  /** Province/territory */
  province: string | null;
  /** Transport mode (road, rail, marine, air, multi-modal) */
  transportMode: string | null;
  /** NTCF contribution amount */
  ntcfContribution: number | null;
  /** Total project value */
  totalProjectValue: number | null;
  /** Announcement date */
  announcementDate: string | null;
  /** Project status */
  status: string | null;
  /** Rationale / justification */
  rationale: string | null;
  /** Description */
  description: string | null;
  /** Source URL */
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                   */
/* ------------------------------------------------------------------ */

export interface TransportInfrastructureIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
