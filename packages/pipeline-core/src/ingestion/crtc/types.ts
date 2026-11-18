// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CRTC Ingestion Types — Quill
 *
 * Types for CRTC (Canadian Radio-television and Telecommunications Commission)
 * decisions, ownership changes, and licensing data.
 *
 * The CRTC is Canada's independent regulator of broadcasting and
 * telecommunications. Every media merger, ownership change, broadcasting
 * licence renewal, and major telecom pricing decision goes through the CRTC.
 *
 * Key for tracking: media consolidation (Péladeau/Quebecor, Entwistle/Bell),
 * net neutrality enforcement, telecom pricing regulation, and Canadian
 * content requirements.
 *
 * Sources:
 *   - CRTC decisions archive: https://crtc.gc.ca/eng/archive/
 *   - CRTC ownership data:     https://crtc.gc.ca/eng/cancon/ownership.htm
 *   - CRTC open data (CKAN):  https://open.canada.ca (CRTC datasets)
 *   - CRTC RSS feeds for broadcasting and telecom decisions
 */

/* ------------------------------------------------------------------ */
/*  Decision Types                                                     */
/* ------------------------------------------------------------------ */

/** CRTC decision type classification */
export type CrtcDecisionType =
  | 'broadcasting-decision'
  | 'telecom-decision'
  | 'administrative'
  | 'ownership-change'
  | 'policy'
  | 'notice-consultation';

/** Decision outcome classification */
export type CrtcDecisionOutcome =
  | 'approved'
  | 'denied'
  | 'conditionally-approved'
  | 'partially-approved'
  | 'deferred'
  | 'withdrawn'
  | 'unknown';

/** Subject matter categories for CRTC decisions */
export type CrtcSubjectMatter =
  | 'licensing'
  | 'ownership-change'
  | 'net-neutrality'
  | 'telecom-pricing'
  | 'wholesale-access'
  | 'canadian-content'
  | 'diversity-of-voices'
  | 'local-news'
  | 'indigenous-broadcasting'
  | 'french-language'
  | 'accessibility'
  | 'emergency-alerting'
  | 'spectrum'
  | 'consumer-protection'
  | 'other';

/**
 * A CRTC regulatory decision.
 *
 * CRTC decisions use distinct numbering patterns:
 *   - Broadcasting Decision CRTC 2024-123
 *   - Telecom Decision CRTC 2024-456
 *   - Broadcasting Order CRTC 2024-789
 *   - Telecom Order CRTC 2024-321
 *   - Notice of Consultation CRTC 2024-654
 */
export interface CrtcDecision {
  /** SHA-256 hash of the decision content (primary key) */
  id: string;

  /** CRTC decision number (e.g., '2024-123', '2024-456') */
  decisionNumber: string;

  /** Full decision title */
  title: string;

  /** Publication date (ISO-8601) */
  date: string;

  /** Decision type classification */
  type: CrtcDecisionType;

  /** The applicant or proponent of the application */
  applicant: string | null;

  /** Decision outcome */
  outcome: CrtcDecisionOutcome;

  /** Subject matter classification */
  subjectMatter: CrtcSubjectMatter[];

  /** Companies or entities directly affected by the decision */
  relatedCompanies: string[];

  /** Regulatory conditions imposed */
  conditions: string[];

  /** Key findings from the decision text */
  findings: string[];

  /** Whether the decision relates to a media ownership change */
  isOwnershipChange: boolean;

  /** Whether the decision relates to net neutrality */
  isNetNeutrality: boolean;

  /** Whether the decision relates to telecom pricing */
  isTelecomPricing: boolean;

  /** Whether the decision relates to Canadian content requirements */
  isCanadianContent: boolean;

  /** Whether the decision was a licence renewal */
  isLicenceRenewal: boolean;

  /** Summary of the decision (from the HTML page) */
  summary: string | null;

  /** URL to the decision page on CRTC website */
  sourceUrl: string;

  /** URL to the full decision PDF */
  pdfUrl: string | null;

  /** Language of the decision ('en' or 'fr' or 'bilingual') */
  language: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Ownership Types                                                    */
/* ------------------------------------------------------------------ */

/** Type of CRTC ownership record */
export type OwnershipRecordType =
  | 'broadcasting-undertaking'
  | 'telecom-undertaking'
  | 'media-ownership-group'
  | 'transfer-of-control'
  | 'transfer-of-ownership';

/**
 * A CRTC ownership record — tracks who owns what in Canadian media.
 *
 * The CRTC maintains data on ownership of broadcasting undertakings
 * (TV stations, radio stations, specialty services) and tracks
 * transfers of ownership and control. This is critical for monitoring
 * media consolidation by companies like Bell, Rogers, Quebecor, and Shaw.
 */
export interface CrtcOwnershipRecord {
  /** SHA-256 hash of the ownership record (primary key) */
  id: string;

  /** Record type */
  recordType: OwnershipRecordType;

  /** Name of the broadcasting/telecom undertaking */
  undertakingName: string;

  /** Type of undertaking (e.g., 'television', 'radio', 'specialty', 'telecom') */
  undertakingType: string;

  /** Location / service area (e.g., 'Toronto', 'National') */
  serviceArea: string | null;

  /** Licence number if applicable */
  licenceNumber: string | null;

  /** Owner name */
  ownerName: string;

  /** Parent company or corporate group */
  parentCompany: string | null;

  /** Percentage ownership (if applicable) */
  ownershipPercentage: number | null;

  /** Effective date of the ownership arrangement (ISO-8601) */
  effectiveDate: string | null;

  /** Date the record was published/updated by CRTC (ISO-8601) */
  publishedDate: string | null;

  /** Transaction value (CAD) if disclosed */
  transactionValue: number | null;

  /** Source URL on CRTC website */
  sourceUrl: string;

  /** Source system identifier */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw / Fetch Types                                                  */
/* ------------------------------------------------------------------ */

/** Raw decision item from CRTC RSS feed or archive listing */
export interface RawCrtcDecisionItem {
  title: string;
  date: string;
  url: string;
  summary: string | null;
  /** Raw type string from the source (e.g., 'Broadcasting Decision', 'Telecom Decision') */
  rawType: string;
  /** Decision number if extractable from title/URL */
  decisionNumber: string | null;
  /** HTML body of the decision detail page */
  bodyHtml: string | null;
}

/** Raw ownership record from CRTC ownership page */
export interface RawCrtcOwnershipItem {
  undertakingName: string;
  undertakingType: string;
  serviceArea: string | null;
  licenceNumber: string | null;
  ownerName: string;
  parentCompany: string | null;
  ownershipPercentage: string | null;
  effectiveDate: string | null;
  publishedDate: string | null;
  transactionValue: string | null;
  sourceUrl: string;
  /** Raw HTML of the ownership detail page */
  bodyHtml: string | null;
}

/** Raw HTML page for parsing */
export interface RawCrtcPage {
  url: string;
  html: string;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result Type                                              */
/* ------------------------------------------------------------------ */

/** Result of the CRTC ingestion pipeline */
export interface CrtcIngestionResult {
  decisionsFound: number;
  decisionsIngested: number;
  ownershipRecordsFound: number;
  ownershipRecordsIngested: number;
  sourcesTried: string[];
  errors: string[];
  durationMs: number;
}
