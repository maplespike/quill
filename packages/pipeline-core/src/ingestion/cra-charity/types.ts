/**
 * CRA Charity T3010 Filing Types — Quill
 *
 * Strongly-typed interfaces for Canada Revenue Agency (CRA) T3010
 * Registered Charity Information Return data.
 *
 * Every registered Canadian charity files a T3010 annually. This dataset
 * reveals who funds advocacy groups, think tanks, NGOs, and foundations.
 *
 * Sources:
 *   - Open Canada CKAN: https://open.canada.ca/data/en/dataset/?q=List+of+charities
 *   - CRA Charity Search: https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch
 *   - PKG 2024:  80c00cdb-1358-415c-bb8b-0de7f12675b8
 *   - PKG 1991:  fa737c91-7fe4-4d0a-97cd-702ac2bffa45 (yearly from 1991–2024)
 *
 * The dataset has multiple CSV files per year: Identification, Financial,
 * Charitable Programs, Compensation, Political Activities, and more.
 * This module joins Identification + Financial data + Programs into
 * a single flat CraCharityT3010 record per charity per fiscal year.
 */

/* ------------------------------------------------------------------ */
/*  Charity Categories / Enums                                         */
/* ------------------------------------------------------------------ */

/**
 * CRA charity category codes.
 * Based on the CRA List of Charities data dictionary.
 */
export enum CharityCategory {
  CharitableOrganization = 'charitable-organization',
  PublicFoundation = 'public-foundation',
  PrivateFoundation = 'private-foundation',
  Other = 'other',
}

/**
 * Charity designation / sub-type.
 */
export enum CharityDesignation {
  /** Designated as a charitable organization under the Income Tax Act */
  CharitableOrganization = 'charitable-organization',
  /** Public foundation — receives donations from public */
  PublicFoundation = 'public-foundation',
  /** Private foundation — funded by a single source or family */
  PrivateFoundation = 'private-foundation',
  /** Unknown / not classified */
  Unknown = 'unknown',
}

/**
 * CRA charity status codes.
 */
export enum CharityStatus {
  Active = 'active',
  Revoked = 'revoked',
  Suspended = 'suspended',
  Inactive = 'inactive',
  NotListed = 'not-listed',
  Unknown = 'unknown',
}

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

export interface CraCharityT3010 {
  /**
   * SHA-256 hash of BN + fiscal_year_end (primary key).
   * This provides a unique, deterministic ID per charity per filing year.
   */
  id: string;

  /** Business Number (BN) — 9-digit CRA registration number */
  bn: string;

  /** Legal / registered name of the charity */
  legalName: string;

  /** Operating name(s) — the name(s) the charity does business as */
  operatingName: string | null;

  /** Charity category: charitable organization, public foundation, private foundation */
  category: CharityCategory;

  /** Charity designation */
  designation: CharityDesignation;

  /** CRA status: active, revoked, suspended, etc. */
  status: CharityStatus;

  /** Fiscal year start date (ISO-8601 date) */
  fiscalYearStart: string | null;

  /** Fiscal year end date (ISO-8601 date) */
  fiscalYearEnd: string | null;

  /** Total revenue (CAD) from all sources — T3010 Section D, line 4700 */
  totalRevenue: number | null;

  /** Total expenses (CAD) — T3010 Section D, line 4950 */
  totalExpenses: number | null;

  /** Total assets (CAD) — T3010 balance sheet, line 1000 */
  totalAssets: number | null;

  /** Total liabilities (CAD) — T3010 balance sheet, line 2100 */
  totalLiabilities: number | null;

  /** Compensation of key employees (CAD) — Schedule 3 total */
  compensationKeyEmployees: number | null;

  /** Description of charitable programs — from the Charitable Programs CSV */
  charitableProgramsDescription: string | null;

  /** Amount spent on political activities (CAD) — Schedule 6, line 5020 */
  politicalActivitiesAmount: number | null;

  /** Amount in grants to qualified donees (CAD) */
  grantsAmount: number | null;

  /** The year of the dataset this record came from (e.g. "2024") */
  datasetYear: string;

  /** Source URL — link to the CKAN dataset page */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                   */
/* ------------------------------------------------------------------ */

export interface CraCharityIngestionResult {
  /** Dataset year ingested (e.g. "2024") */
  datasetYear: string;
  /** Total records found in the CSV source */
  recordsFound: number;
  /** Records successfully ingested */
  recordsIngested: number;
  /** Per-record ingestion errors */
  errors: string[];
  /** Duration in milliseconds */
  durationMs: number;
}
