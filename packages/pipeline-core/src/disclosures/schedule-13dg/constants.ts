// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Disabled Schedule 13D/G foundation for Quill by Maplespike.
 *
 * These constants are policy contracts. They are not a clearance to ingest,
 * and they are not a legal determination. No gate is green.
 */

export const SOURCE_ID = 'sec-schedule-13dg' as const;

export const PRODUCT_LABEL = 'Quill by Maplespike' as const;

export const PARSER_VERSION = 'schedule-13dg-parser/0.1.0-disabled' as const;

/** Live SEC ingestion is not implemented. No setting turns it on. */
export const LIVE_INGEST_IMPLEMENTED = false;

/** The 365-day metadata window stays closed until a separate admission. */
export const FUTURE_ENABLEMENT_CLEARED = false;

/** Kill switch default. Engaged means fail closed. */
export const KILL_SWITCH_DEFAULT_ENGAGED = true;

export const LOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const METADATA_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const MAX_ACCESS_ATTEMPTS = 3;

/**
 * Entity-type codes used only as a screen. A code in this set does not
 * prove privacy eligibility. CO and PN stay in the screen because a type
 * code is never sufficient on its own.
 */
export const ENTITY_TYPE_CODES = [
  'BD',
  'BK',
  'IC',
  'IV',
  'IA',
  'EP',
  'HC',
  'SA',
  'CP',
  'FI',
  'CO',
  'PN',
] as const;

export type EntityTypeCode = (typeof ENTITY_TYPE_CODES)[number];

export const ENTITY_TYPE_CODE_SET: ReadonlySet<string> = new Set(ENTITY_TYPE_CODES);

export const INDIVIDUAL_TYPE_CODE = 'IN';

export const OTHER_TYPE_CODE = 'OO';

export const ENTITY_TYPE_SCREENING = {
  provesEligibility: false,
  files13fManagerProvesEligibility: false,
  pilotRatioIsAdmittedCount: false,
  ceilingLabel: 'entity-type-screening-ceiling',
} as const;

export const ENABLEMENT_GATES = [
  { id: 'identity-security-class', status: 'blocked', blocksEnablement: true },
  { id: 'privacy-eligibility', status: 'blocked', blocksEnablement: true },
  { id: 'retention', status: 'blocked', blocksEnablement: true },
  { id: 'corrections', status: 'blocked', blocksEnablement: true },
  { id: 'access', status: 'unapproved', blocksEnablement: true },
  { id: 'language', status: 'unapproved', blocksEnablement: true },
  { id: 'cusip-cgs-drop-confirmation', status: 'blocked', blocksEnablement: true },
  { id: 'aggregate-claims', status: 'blocked', blocksEnablement: true },
  { id: 'live-index-resync', status: 'not-implemented', blocksEnablement: true },
] as const;

export const LANGUAGE_REVIEW = {
  status: 'unapproved',
  humanReviewedFrench: false,
  frenchLabels: null,
  machineTranslationOfLegalTerms: false,
} as const;

export const ACCESS_REVIEW = {
  status: 'unapproved',
  monitoredContact: null,
  userAgent: null,
  extraSpendUsd: 0,
  budgetRequests: 0,
  approvedRateLimit: false,
} as const;

export const COVERAGE_CLAIMS = {
  completeness: 'not-claimed',
  realtime: 'not-claimed',
  sinceInception: 'not-claimed',
} as const;

export const ENGLISH_CAVEAT =
  'Quill by Maplespike does not read a Schedule 13D/G filing as a trade. ' +
  'An amendment is not a sale. A reported zero holding is not a sale. ' +
  'No observed filing is not a zero holding. Percentages are not added across filers.';

export const SYNTHETIC_ACCESSION = /^SYN-[A-Z0-9-]{1,64}$/;

export const REAL_EDGAR_ACCESSION = /^\d{10}-\d{2}-\d{6}$/;

/** Synthetic entity CIK. A real numeric CIK is not accepted. */
export const SYNTHETIC_CIK = /^SYN-CIK-[A-Z0-9-]{1,32}$/;

export const REVIEW_ID = /^REV-[A-Z0-9-]{1,64}$/;

/** Reviewed class titles are bounded plain text. They are not free XML. */
export const CLASS_TITLE = /^[A-Za-z0-9][A-Za-z0-9 .'()-]{0,79}$/;

export const STORE_ID = /^[a-z0-9-]{1,32}$/;
