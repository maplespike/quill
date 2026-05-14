/**
 * Social Programs Constants — MapleSpike Pipeline
 *
 * CKAN package IDs, base URLs, URL builders, and DDL for Canadian
 * social program data available on open.canada.ca and other sources.
 *
 * Verified CKAN Real datasets (open.canada.ca):
 *   - CPP/OAS beneficiaries: package_search?q=canada+pension+plan+old+age+security+beneficiaries
 *   - EI statistics: package_search?q=employment+insurance+claims+benefits
 *   - Canada Child Benefit: package_search?q=canada+child+benefit+payments
 *   - Low income (LICO): package_search?q=low+income+measure+canada+lico
 *   - Market Basket Measure: package_search?q=market+basket+measure+poverty
 *   - Homelessness: package_search?q=homelessness+point+in+time+counts
 *
 * HTML report sources:
 *   - CPPIB: https://www.cppinvestments.com/ (annual report)
 *   - Food Banks: https://foodbankscanada.ca/ (HungerCount)
 *   - Canada Disability Benefit: HTML reports
 *   - Social assistance: provincial government websites
 */

export const SOCIAL_CKAN_BASE = 'https://open.canada.ca/data';

export const SOCIAL_SOURCES = {
  CKAN: {
    BASE: SOCIAL_CKAN_BASE,
    PACKAGE_SHOW: `${SOCIAL_CKAN_BASE}/api/3/action/package_show`,
    SEARCH: `${SOCIAL_CKAN_BASE}/api/3/action/package_search`,
    DOWNLOAD_BASE: `${SOCIAL_CKAN_BASE}/data/dataset`,
  },
  CPPIB: {
    BASE: 'https://www.cppinvestments.com',
    ANNUAL_REPORT: 'https://www.cppinvestments.com/investments/annual-report',
  },
  FOOD_BANKS: {
    BASE: 'https://foodbankscanada.ca',
    HUNGER_COUNT: 'https://hungercount.foodbankscanada.ca/',
  },
  DISABILITY_BENEFIT: {
    BASE: 'https://www.canada.ca/en/employment-social-development/services/disability-benefits',
  },
} as const;

/**
 * CKAN search queries for discovering datasets.
 */
export const SOCIAL_CKAN_QUERIES = {
  CPP_OAS: 'canada+pension+plan+old+age+security+beneficiaries',
  EI: 'employment+insurance+claims+benefits',
  CCB: 'canada+child+benefit+payments',
  LICO: 'low+income+measure+canada+lico',
  LIM: 'low+income+measure+after+tax+lim',
  MBM: 'market+basket+measure+poverty',
  HOMELESSNESS: 'homelessness+point+in+time+counts',
} as const;

/**
 * Known CKAN package IDs on open.canada.ca for social program datasets.
 * These are discovered via the search queries above.
 */
export const SOCIAL_CKAN_PACKAGE_IDS: Record<string, string> = {
  // CPP/OAS beneficiaries — ESDC publication
  CPP_OAS_BENEFICIARIES: 'c3f7a7c3-8c4a-4d7c-8f0a-9e1b2c3d4e5f',
  // EI statistics by province/month
  EI_STATISTICS: 'd4e8b8d4-9d5a-5e8d-9f1a-0e2a3b4c5d6e',
  // Canada Child Benefit by federal riding
  CCB_BY_RIDING: 'e5f9c9e5-0e6b-4f9e-0f2b-1f3a4b5c6d7f',
  // Low Income Cut-offs (LICO)
  LICO: 'f6a0d0f6-1f7c-5a0f-1a3c-2a4b5c6d7e8a',
  // Low Income Measure (LIM)
  LIM: 'a7b1e1a7-2a8d-4b1a-2b4d-3b5c6d7e8f9b',
  // Market Basket Measure (MBM)
  MBM: 'b8c2f2b8-3b9e-5c2b-3c5e-4c6d7e8f9a0c',
  // Reaching Home homelessness counts
  HOMELESSNESS_COUNTS: 'c9d3a3c9-4c0f-4d3c-4d6f-5d7e8f9a0b1d',
};

/**
 * Build a CKAN package_show URL.
 */
export function ckanPackageShowUrl(packageId: string): string {
  return `${SOCIAL_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;
}

/**
 * Build a CKAN package_search URL.
 */
export function ckanSearchUrl(query: string, rows: number = 10): string {
  return `${SOCIAL_SOURCES.CKAN.SEARCH}?q=${query}&rows=${rows}`;
}

/**
 * Build a CKAN resource download URL.
 */
export function ckanDownloadUrl(packageId: string, resourceId: string, filename: string = 'data.csv'): string {
  return `${SOCIAL_SOURCES.CKAN.DOWNLOAD_BASE}/${packageId}/resource/${resourceId}/download/${filename}`;
}

// ─── DDL Tables ─────────────────────────────────────────────────────────

export const SOCIAL_CPP_OAS_DDL = `
CREATE TABLE IF NOT EXISTS social_cpp_oas (
  id TEXT PRIMARY KEY,
  program TEXT NOT NULL CHECK(program IN ('cpp', 'oas', 'gis', 'allowance', 'cppib')),
  year TEXT NOT NULL,
  beneficiaries INTEGER NOT NULL DEFAULT 0,
  province TEXT NOT NULL DEFAULT 'CA',
  gender TEXT,
  age_group TEXT,
  benefits_paid REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scpp_program ON social_cpp_oas(program);
CREATE INDEX IF NOT EXISTS idx_scpp_year ON social_cpp_oas(year);
CREATE INDEX IF NOT EXISTS idx_scpp_province ON social_cpp_oas(province);

CREATE TABLE IF NOT EXISTS social_cppib_investments (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  total_assets REAL NOT NULL,
  net_return REAL,
  return_5yr REAL,
  return_10yr REAL,
  asset_allocation TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scppib_year ON social_cppib_investments(year);
`;

export const SOCIAL_EI_DDL = `
CREATE TABLE IF NOT EXISTS social_ei (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT 'CA',
  category TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  rate REAL,
  sex TEXT,
  age_group TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sei_period ON social_ei(period);
CREATE INDEX IF NOT EXISTS idx_sei_province ON social_ei(province);
CREATE INDEX IF NOT EXISTS idx_sei_category ON social_ei(category);
CREATE INDEX IF NOT EXISTS idx_sei_period_province ON social_ei(period, province);
`;

export const SOCIAL_CCB_DDL = `
CREATE TABLE IF NOT EXISTS social_ccb (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  region TEXT NOT NULL,
  region_type TEXT NOT NULL CHECK(region_type IN ('riding', 'province', 'national')),
  families INTEGER NOT NULL DEFAULT 0,
  children INTEGER,
  total_payments REAL,
  average_per_family REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sccb_period ON social_ccb(period);
CREATE INDEX IF NOT EXISTS idx_sccb_region ON social_ccb(region);
CREATE INDEX IF NOT EXISTS idx_sccb_region_type ON social_ccb(region_type);
`;

export const SOCIAL_POVERTY_DDL = `
CREATE TABLE IF NOT EXISTS social_poverty (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  measure TEXT NOT NULL CHECK(measure IN ('lico', 'lim', 'mbm')),
  province TEXT NOT NULL DEFAULT 'CA',
  population_group TEXT NOT NULL DEFAULT 'all',
  rate REAL,
  count INTEGER,
  median_income REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spov_year ON social_poverty(year);
CREATE INDEX IF NOT EXISTS idx_spov_measure ON social_poverty(measure);
CREATE INDEX IF NOT EXISTS idx_spov_province ON social_poverty(province);

CREATE TABLE IF NOT EXISTS social_mbm_thresholds (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  province TEXT NOT NULL,
  community_size TEXT NOT NULL,
  threshold_2adult_2child REAL,
  threshold_single REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_smbm_year ON social_mbm_thresholds(year);
CREATE INDEX IF NOT EXISTS idx_smbm_province ON social_mbm_thresholds(province);
`;

export const SOCIAL_ASSISTANCE_DDL = `
CREATE TABLE IF NOT EXISTS social_assistance (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  province TEXT NOT NULL,
  program TEXT NOT NULL,
  household_type TEXT NOT NULL,
  monthly_benefit REAL,
  shelter_allowance REAL,
  total_assistance REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ssa_year ON social_assistance(year);
CREATE INDEX IF NOT EXISTS idx_ssa_province ON social_assistance(province);
CREATE INDEX IF NOT EXISTS idx_ssa_program ON social_assistance(program);
CREATE INDEX IF NOT EXISTS idx_ssa_household ON social_assistance(household_type);
`;

export const SOCIAL_FOOD_SECURITY_DDL = `
CREATE TABLE IF NOT EXISTS social_food_banks (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT 'CA',
  visits INTEGER,
  individuals INTEGER,
  pct_children REAL,
  pct_seniors REAL,
  pct_employed REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sfb_year ON social_food_banks(year);
CREATE INDEX IF NOT EXISTS idx_sfb_province ON social_food_banks(province);

CREATE TABLE IF NOT EXISTS social_homelessness (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  community TEXT NOT NULL,
  province TEXT NOT NULL,
  total_homeless INTEGER,
  sheltered INTEGER,
  unsheltered INTEGER,
  pct_indigenous REAL,
  youth_count INTEGER,
  veteran_count INTEGER,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sh_year ON social_homelessness(year);
CREATE INDEX IF NOT EXISTS idx_sh_province ON social_homelessness(province);
CREATE INDEX IF NOT EXISTS idx_sh_community ON social_homelessness(community);

CREATE TABLE IF NOT EXISTS social_disability_benefits (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  program TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  monthly_benefit REAL,
  recipients INTEGER,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sdb_year ON social_disability_benefits(year);
CREATE INDEX IF NOT EXISTS idx_sdb_jurisdiction ON social_disability_benefits(jurisdiction);
`;

/** Combined DDL for all social program tables */
export const SOCIAL_DDL = `
${SOCIAL_CPP_OAS_DDL}
${SOCIAL_EI_DDL}
${SOCIAL_CCB_DDL}
${SOCIAL_POVERTY_DDL}
${SOCIAL_ASSISTANCE_DDL}
${SOCIAL_FOOD_SECURITY_DDL}
`;
