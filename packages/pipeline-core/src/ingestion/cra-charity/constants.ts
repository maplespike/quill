/**
 * CRA Charity T3010 Constants — Quill
 *
 * CKAN package IDs, download URLs, column mappings, and DDL
 * for the CRA List of Charities open data.
 *
 * The data is published year-by-year from 1991 through 2024 on
 * open.canada.ca. Each year has multiple CSV resources:
 *   - Identification (ident_{year}.csv)
 *   - Financial data (financial_d_and_schedule_6_{year}.csv)
 *   - General information (financial_section_a_b_and_c_{year}.csv)
 *   - Charitable Programs (new_ongoing_programs_{year}.csv)
 *   - Compensation (schedule_3_compensation_{year}.csv)
 *   - Political Activities (schedule_7_*_{year}.csv)
 *
 * PKG IDs discovered via:
 *   https://open.canada.ca/data/api/3/action/package_search?q=List+of+charities+organization:cra-arc
 */

import { CharityStatus } from './types.js';

/* ------------------------------------------------------------------ */
/*  CKAN Base URLs                                                     */
/* ------------------------------------------------------------------ */

export const CRA_CKAN = {
  /** open.canada.ca CKAN portal */
  BASE: 'https://open.canada.ca/data',
  /** CKAN package_search API */
  SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
  /** CKAN package_show API */
  PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
  /** Resource download prefix */
  DOWNLOAD_BASE: 'https://open.canada.ca/data/dataset',
  /** Query for charity datasets */
  CHARITY_QUERY: 'List+of+charities+organization:cra-arc',
} as const;

/* ------------------------------------------------------------------ */
/*  CRA Charity Search Portal                                          */
/* ------------------------------------------------------------------ */

export const CRA_CHARITY_SEARCH_URL =
  'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch';

export const CRA_CSV_DOWNLOAD_URL =
  'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?requestToGo=downloadCSV';

/* ------------------------------------------------------------------ */
/*  Known CKAN Package IDs by Year (latest known)                     */
/* ------------------------------------------------------------------ */

/**
 * Known CKAN package IDs for each year of the List of charities dataset.
 * The data spans 1991 through 2024.
 *
 * Key packages:
 *   2024: 80c00cdb-1358-415c-bb8b-0de7f12675b8
 *   2014: 0bb1fb56-74d0-47f4-b4b3-2b574229416d
 *   2011: 8e4fbdda-f73e-4c49-b0f3-79b86d4a81fb
 *   1991: fa737c91-7fe4-4d0a-97cd-702ac2bffa45
 */
export const CRA_CHARITY_PACKAGE_IDS: Partial<Record<string, string>> = {
  '2024': '80c00cdb-1358-415c-bb8b-0de7f12675b8',
  '2014': '0bb1fb56-74d0-47f4-b4b3-2b574229416d',
  '2011': '8e4fbdda-f73e-4c49-b0f3-79b86d4a81fb',
  '1991': 'fa737c91-7fe4-4d0a-97cd-702ac2bffa45',
};

/** Latest year with a known package ID */
export const CRA_LATEST_YEAR = '2024';

/** Default dataset year to ingest if none specified */
export const CRA_DEFAULT_YEAR = '2024';

/* ------------------------------------------------------------------ */
/*  Resource Name Patterns (per CSV type)                              */
/* ------------------------------------------------------------------ */

/**
 * Patterns to identify resources within a CKAN package.
 * Used by the fetcher to discover the correct resource ID.
 */
export const CRA_RESOURCE_PATTERNS = {
  /** Identification CSV — contains BN, name, status, category, designation */
  IDENTIFICATION: /^identification/i,
  /** Financial data CSV — contains revenue, expenses, assets, liabilities, Schedule 6 */
  FINANCIAL: /^financial data/i,
  /** General info CSV — contains Section A, B, C with compensation, fiscal year info */
  GENERAL_INFO: /^general information/i,
  /** Charitable Programs CSV — program descriptions */
  PROGRAMS: /^charitable programs/i,
  /** Compensation CSV — key employee compensation */
  COMPENSATION: /^compensation(?!.*non-cash)/i,
  /** Political activities description */
  POLITICAL_DESC: /^political activities.+description/i,
  /** Political activities funding */
  POLITICAL_FUNDING: /^political activities.+funding/i,
} as const;

/* ------------------------------------------------------------------ */
/*  CSV Column Name Mappings                                          */
/* ------------------------------------------------------------------ */

/**
 * Header name normalisation map: maps variant CRA column names
 * (which change year-to-year) to canonical keys.
 *
 * Identification CSV columns:
 */
export const IDENT_COLUMN_ALIASES: Record<string, string> = {
  // BN
  'bn': 'bn',
  'bn/registration number': 'bn',
  'business number': 'bn',
  'registration number': 'bn',
  'registered charity number': 'bn',

  // Legal name
  'legal name': 'legal_name',
  'legal_name': 'legal_name',
  'charity name': 'legal_name',
  'name': 'legal_name',

  // Operating name
  'operating name': 'operating_name',
  'operating_name': 'operating_name',
  'trade name': 'operating_name',
  'other name': 'operating_name',
  'doing business as': 'operating_name',

  // Status
  'status': 'status',

  // Category
  'category': 'category',
  'type': 'category',
  'charity type': 'category',

  // Designation
  'designation': 'designation',
};

/**
 * Financial CSV column aliases.
 */
export const FINANCIAL_COLUMN_ALIASES: Record<string, string> = {
  'bn': 'bn',
  'business number': 'bn',
  'registration number': 'bn',

  // Total revenue (Section D, line 4700 — Total revenue)
  'total revenue': 'total_revenue',
  'total revenue (section d)': 'total_revenue',
  'total revenue amount': 'total_revenue',
  'd4700': 'total_revenue',
  // Section D revenue — all sources
  'total revenue from all sources': 'total_revenue',

  // Total expenses (Section D, line 4950 — Total expenditures)
  'total expenditures': 'total_expenses',
  'total expenses': 'total_expenses',
  'total expenditures (section d)': 'total_expenses',
  'd4950': 'total_expenses',

  // Total assets (Balance sheet, line 1000)
  'total assets': 'total_assets',
  'total assets amount': 'total_assets',
  '1000': 'total_assets',

  // Total liabilities (Balance sheet, line 2100)
  'total liabilities': 'total_liabilities',
  'total liabilities amount': 'total_liabilities',
  '2100': 'total_liabilities',

  // Political activities amount (Schedule 6, line 5020)
  'political activities': 'political_activities_amount',
  'political activities amount': 'political_activities_amount',
  'amount spent on political activities': 'political_activities_amount',
  'd5020': 'political_activities_amount',
  'schedule 6 total': 'political_activities_amount',

  // Grants
  'total grants': 'grants_amount',
  'grants': 'grants_amount',
  'grants to qualified donees': 'grants_amount',
  'qualified donees': 'grants_amount',

  // Fiscal year
  'fiscal year start': 'fiscal_year_start',
  'fiscal period start': 'fiscal_year_start',
  'fiscal year end': 'fiscal_year_end',
  'fiscal period end': 'fiscal_year_end',
};

/**
 * General info (Section A/B/C) column aliases.
 * Mainly fiscal year info and employee compensation.
 */
export const GENERAL_COLUMN_ALIASES: Record<string, string> = {
  'bn': 'bn',
  'business number': 'bn',

  'fiscal year start': 'fiscal_year_start',
  'fiscal period start': 'fiscal_year_start',
  'section a fiscal period start': 'fiscal_year_start',

  'fiscal year end': 'fiscal_year_end',
  'fiscal period end': 'fiscal_year_end',
  'section a fiscal period end': 'fiscal_year_end',

  // Compensation amounts
  'compensation - key employees': 'compensation_key_employees',
  'compensation key employees': 'compensation_key_employees',
  'total compensation - employees': 'compensation_key_employees',
  'total compensation': 'compensation_key_employees',
  'total amount of all compensation': 'compensation_key_employees',
  'section b total compensation': 'compensation_key_employees',
};

/* ------------------------------------------------------------------ */
/*  Charity Status Map                                                 */
/* ------------------------------------------------------------------ */

export const CRA_STATUS_MAP: Record<string, CharityStatus> = {
  'active': CharityStatus.Active,
  'ACTIVE': CharityStatus.Active,
  'Active': CharityStatus.Active,
  'registered': CharityStatus.Active,
  'REGISTERED': CharityStatus.Active,
  'Registered': CharityStatus.Active,
  'inactive': CharityStatus.Inactive,
  'INACTIVE': CharityStatus.Inactive,
  'Inactive': CharityStatus.Inactive,
  'revoked': CharityStatus.Revoked,
  'REVOKED': CharityStatus.Revoked,
  'Revoked': CharityStatus.Revoked,
  'suspended': CharityStatus.Suspended,
  'SUSPENDED': CharityStatus.Suspended,
  'Suspended': CharityStatus.Suspended,
  'not listed': CharityStatus.NotListed,
  'not-listed': CharityStatus.NotListed,
  'Not Listed': CharityStatus.NotListed,
};

/* ------------------------------------------------------------------ */
/*  DDL                                                                */
/* ------------------------------------------------------------------ */

export const CRA_CHARITY_T3010_DDL = `
CREATE TABLE IF NOT EXISTS cra_charity_t3010 (
  id TEXT PRIMARY KEY,
  bn TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  operating_name TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  designation TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'unknown',
  fiscal_year_start TEXT,
  fiscal_year_end TEXT,
  total_revenue REAL,
  total_expenses REAL,
  total_assets REAL,
  total_liabilities REAL,
  compensation_key_employees REAL,
  charitable_programs_description TEXT,
  political_activities_amount REAL,
  grants_amount REAL,
  dataset_year TEXT NOT NULL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cra_charity_bn ON cra_charity_t3010(bn);
CREATE INDEX IF NOT EXISTS idx_cra_charity_status ON cra_charity_t3010(status);
CREATE INDEX IF NOT EXISTS idx_cra_charity_category ON cra_charity_t3010(category);
CREATE INDEX IF NOT EXISTS idx_cra_charity_year ON cra_charity_t3010(dataset_year);
CREATE INDEX IF NOT EXISTS idx_cra_charity_fiscal_year ON cra_charity_t3010(fiscal_year_end);
CREATE INDEX IF NOT EXISTS idx_cra_charity_revenue ON cra_charity_t3010(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_cra_charity_political ON cra_charity_t3010(political_activities_amount DESC);
CREATE INDEX IF NOT EXISTS idx_cra_charity_name ON cra_charity_t3010(legal_name);
CREATE INDEX IF NOT EXISTS idx_cra_charity_bn_year ON cra_charity_t3010(bn, dataset_year);
`;

/* ------------------------------------------------------------------ */
/*  URL Builders                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build a CKAN package_show URL for a charity dataset by year.
 */
export function ckanPackageUrl(year: string): string {
  const pkgId = CRA_CHARITY_PACKAGE_IDS[year];
  if (!pkgId) {
    throw new Error(`No known CKAN package ID for year ${year}`);
  }
  return `${CRA_CKAN.PACKAGE_SHOW}?id=${pkgId}`;
}

/**
 * Build a resource download URL from a CKAN package and resource ID.
 *
 * Pattern: https://open.canada.ca/data/dataset/{PKG_ID}/resource/{RES_ID}/download/{filename}
 */
export function ckanDownloadUrl(packageId: string, resourceId: string, filename: string): string {
  return `${CRA_CKAN.DOWNLOAD_BASE}/${packageId}/resource/${resourceId}/download/${filename}`;
}

/**
 * Build a CKAN search URL for charity datasets.
 */
export function ckanSearchUrl(rows: number = 36): string {
  return `${CRA_CKAN.SEARCH}?q=${CRA_CKAN.CHARITY_QUERY}&rows=${rows}&sort=title_translated+desc`;
}

/**
 * Build a CRA charity search URL for a specific query.
 */
export function craSearchUrl(query: string): string {
  return `${CRA_CHARITY_SEARCH_URL}?selectedCharityBn=&selectedFdtnBn=&selectedLanguage=en&q=${encodeURIComponent(query)}`;
}
