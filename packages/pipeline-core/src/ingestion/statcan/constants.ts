// SPDX-License-Identifier: AGPL-3.0-only
/**
 * StatCan WDS Constants — Quill
 *
 * Product IDs, URL patterns, dimension maps, DDL statements, and
 * helper functions for the Statistics Canada Web Data Service.
 *
 * Source terms: Statistics Canada publishes an Open Licence. Verify its
 * scope, dataset coverage, attribution, and exclusions for each use.
 */

import type { StatCanIndicatorType } from './types.js';

/* ------------------------------------------------------------------ */
/*  WDS API Base URL                                                   */
/* ------------------------------------------------------------------ */

export const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';

/* ------------------------------------------------------------------ */
/*  WDS Endpoint Paths                                                 */
/* ------------------------------------------------------------------ */

export const WDS_ENDPOINTS = {
  /** List all 5,000+ cubes (GET) */
  getAllCubesListLite: '/getAllCubesListLite',
  /** Fetch data for a product (POST) */
  getData: '/getData',
  /** Download full table as CSV (POST) */
  getFullTableDownloadCSV: '/getFullTableDownloadCSV',
  /** Get cube metadata (POST) */
  getCubeMetadata: '/getCubeMetadata',
  /** Get list of changed cubes since date (POST) */
  getChangedCubeList: '/getChangedCubeList',
} as const;

/* ------------------------------------------------------------------ */
/*  PRODUCT IDs for Major Economic Indicators                          */
/* ------------------------------------------------------------------ */

export const STATCAN_PRODUCTS = {
  // --- CPI ---
  CPI_MONTHLY: '18-10-0004-01',
  CPI_BY_PROVINCE: '36-10-0222-01',

  // --- GDP ---
  GDP_BY_INDUSTRY_MONTHLY: '36-10-0434-01',

  // --- Labour ---
  LABOUR_FORCE_CHARACTERISTICS: '14-10-0287-01',
  EMPLOYMENT_BY_INDUSTRY: '14-10-0327-01',
  LABOUR_MARKET_INDICATORS: '14-10-0064-01',
  EMPLOYMENT_INSURANCE: '13-10-0096-01',
  MULTIPLE_JOBHOLDERS: '14-10-0012-01',

  // --- Population ---
  POPULATION_ESTIMATES: '17-10-0005-01',
  POPULATION_BY_AGE_GENDER: '17-10-0142-01',

  // --- Trade ---
  INTERNATIONAL_MERCHANDISE_TRADE: '12-10-0011-01',

  // --- Housing ---
  HOUSING_STARTS: '34-10-0135-01',
  BUILDING_PERMITS: '34-10-0136-01',
  HOUSING_PRICE_INDEX: '34-10-0281-01',

  // --- Social ---
  CRIME_STATISTICS: '35-10-0004-01',
  EDUCATION_INDICATORS: '37-10-0003-01',
  HEALTH_CHARACTERISTICS: '13-10-0096-01',
  FAMILY_INCOME: '11-10-0006-01',

  // --- Government Finance ---
  GOV_REVENUE_EXPENDITURE: '36-10-0601-01',
} as const;

/** Typed grouping of product IDs by indicator category */
export const PRODUCTS_BY_CATEGORY: Record<StatCanIndicatorType, string[]> = {
  cpi: [
    STATCAN_PRODUCTS.CPI_MONTHLY,
    STATCAN_PRODUCTS.CPI_BY_PROVINCE,
  ],
  gdp: [
    STATCAN_PRODUCTS.GDP_BY_INDUSTRY_MONTHLY,
  ],
  labour: [
    STATCAN_PRODUCTS.LABOUR_FORCE_CHARACTERISTICS,
    STATCAN_PRODUCTS.EMPLOYMENT_BY_INDUSTRY,
    STATCAN_PRODUCTS.LABOUR_MARKET_INDICATORS,
    STATCAN_PRODUCTS.EMPLOYMENT_INSURANCE,
    STATCAN_PRODUCTS.MULTIPLE_JOBHOLDERS,
  ],
  population: [
    STATCAN_PRODUCTS.POPULATION_ESTIMATES,
    STATCAN_PRODUCTS.POPULATION_BY_AGE_GENDER,
  ],
  trade: [
    STATCAN_PRODUCTS.INTERNATIONAL_MERCHANDISE_TRADE,
  ],
  housing: [
    STATCAN_PRODUCTS.HOUSING_STARTS,
    STATCAN_PRODUCTS.BUILDING_PERMITS,
    STATCAN_PRODUCTS.HOUSING_PRICE_INDEX,
  ],
  social: [
    STATCAN_PRODUCTS.CRIME_STATISTICS,
    STATCAN_PRODUCTS.EDUCATION_INDICATORS,
    STATCAN_PRODUCTS.HEALTH_CHARACTERISTICS,
    STATCAN_PRODUCTS.FAMILY_INCOME,
    STATCAN_PRODUCTS.GOV_REVENUE_EXPENDITURE,
  ],
};

/* ------------------------------------------------------------------ */
/*  URL Builders                                                       */
/* ------------------------------------------------------------------ */

/** Build the full API URL for a given endpoint path. */
export function wdsUrl(endpointPath: string): string {
  return `${STATCAN_WDS_BASE}${endpointPath}`;
}

/** Build the Statistics Canada table view URL for a product. */
export function statcanTableViewUrl(productId: string): string {
  return `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${productId}`;
}

/** Build the Statistics Canada CSV download URL. */
export function statcanCsvDownloadUrl(productId: string): string {
  return `https://www150.statcan.gc.ca/t1/tbl1/en/dnl?pid=${productId}&format=csv`;
}

/* ------------------------------------------------------------------ */
/*  Dimension Mapping — CPI                                            */
/* ------------------------------------------------------------------ */

/** Known CPI product dimension names mapping to human-readable labels */
export const CPI_DIMENSION_MAP: Record<string, string> = {
  'Products and product groups': 'cpiProduct',
  'Products': 'cpiProduct',
  'Geography': 'geography',
  'Seasonal adjustment': 'seasonalAdjustment',
  'Reference period': 'period',
  'UOM': 'unit',
  'SCALAR_FACTOR': 'scalarFactor',
};

/* ------------------------------------------------------------------ */
/*  Dimension Mapping — GDP                                            */
/* ------------------------------------------------------------------ */

export const GDP_DIMENSION_MAP: Record<string, string> = {
  'North American Industry Classification System (NAICS)': 'industry',
  'Seasonal adjustment': 'seasonalAdjustment',
  'Prices': 'gdpType',
  'Geography': 'geography',
  'UOM': 'unit',
  'SCALAR_FACTOR': 'scalarFactor',
};

/* ------------------------------------------------------------------ */
/*  Dimension Mapping — Labour                                         */
/* ------------------------------------------------------------------ */

export const LABOUR_DIMENSION_MAP: Record<string, string> = {
  'Labour force characteristics': 'labourCharacteristic',
  'Population group': 'populationGroup',
  'Sex': 'sex',
  'Age group': 'populationGroup',
  'Industry': 'industry',
  'Geography': 'geography',
  'Seasonal adjustment': 'seasonalAdjustment',
  'Data type': 'dataType',
  'UOM': 'unit',
};

/* ------------------------------------------------------------------ */
/*  Geography Name to GeoCode Mapping                                  */
/* ------------------------------------------------------------------ */

/**
 * StatCan geographic codes for provinces/territories.
 * These are used in the "GEO" dimension of many cubes.
 */
export const PROVINCE_GEO_CODES: Record<string, string> = {
  'Canada': '1',
  'Newfoundland and Labrador': '10',
  'Prince Edward Island': '11',
  'Nova Scotia': '12',
  'New Brunswick': '13',
  'Quebec': '24',
  'Ontario': '35',
  'Manitoba': '46',
  'Saskatchewan': '47',
  'Alberta': '48',
  'British Columbia': '59',
  'Yukon': '60',
  'Northwest Territories': '61',
  'Nunavut': '62',
};

export const PROVINCE_CODES: Record<string, string> = {
  '10': 'NL',
  '11': 'PE',
  '12': 'NS',
  '13': 'NB',
  '24': 'QC',
  '35': 'ON',
  '46': 'MB',
  '47': 'SK',
  '48': 'AB',
  '59': 'BC',
  '60': 'YT',
  '61': 'NT',
  '62': 'NU',
  '1': 'CA',
};

/** Reverse lookup: province short code -> StatCan geo code */
export const PROVINCE_SHORT_TO_GEO: Record<string, string> = {
  'NL': '10',
  'PE': '11',
  'NS': '12',
  'NB': '13',
  'QC': '24',
  'ON': '35',
  'MB': '46',
  'SK': '47',
  'AB': '48',
  'BC': '59',
  'YT': '60',
  'NT': '61',
  'NU': '62',
};

/* ------------------------------------------------------------------ */
/*  Frequency / Period helpers                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse a StatCan time period value into an ISO date string.
 * Handles various formats StatCan uses:
 *   - Monthly: "2024-01" -> "2024-01-01"
 *   - Quarterly: "2024Q1" -> "2024-01-01"
 *   - Annual: "2024" -> "2024-01-01"
 *   - Custom patterns
 */
export function parseStatCanDate(period: string): string | null {
  if (!period) return null;

  // Monthly: "2024-01" or "2024-01-01"
  const monthlyMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthlyMatch) {
    return `${monthlyMatch[1]}-${monthlyMatch[2]}-01`;
  }

  // Already ISO-like: "2024-01-01"
  const isoMatch = period.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Quarterly: "2024Q1" -> first month of quarter
  const quarterMatch = period.match(/^(\d{4})[Qq](\d)$/);
  if (quarterMatch) {
    const qMonth = String((parseInt(quarterMatch[2], 10) - 1) * 3 + 1).padStart(2, '0');
    return `${quarterMatch[1]}-${qMonth}-01`;
  }

  // Annual: "2024"
  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  // MM-YYYY (unusual but seen in some cubes)
  const mmYyyyMatch = period.match(/^(\d{2})-(\d{4})$/);
  if (mmYyyyMatch) {
    return `${mmYyyyMatch[2]}-${mmYyyyMatch[1]}-01`;
  }

  // Try to parse as a full date
  const d = new Date(period);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Extract a short province code from a geography string.
 * Handles "Ontario [35]" -> "ON", "Canada" -> "CA"
 */
export function extractProvinceCode(geography: string): string | null {
  if (!geography) return null;

  // Check direct map
  if (PROVINCE_GEO_CODES[geography]) {
    const geoCode = PROVINCE_GEO_CODES[geography];
    return PROVINCE_CODES[geoCode] || null;
  }

  // "Ontario [35]" pattern
  const bracketMatch = geography.match(/\[(\d+)\]/);
  if (bracketMatch) {
    return PROVINCE_CODES[bracketMatch[1]] || null;
  }

  // Check if geography string itself is a province name
  if (geography === 'Canada') return 'CA';

  return null;
}

/* ------------------------------------------------------------------ */
/*  DDL — Database Table Definitions                                   */
/* ------------------------------------------------------------------ */

export const STATCAN_DDL = `
-- StatCan Indicators — CPI, GDP, Labour, Population, Trade, Housing, Social

CREATE TABLE IF NOT EXISTS statcan_indicators (
  id TEXT PRIMARY KEY,

  -- Core identity
  product_id TEXT NOT NULL,
  indicator_type TEXT NOT NULL CHECK(indicator_type IN (
    'cpi', 'gdp', 'labour', 'population', 'trade', 'housing', 'social'
  )),

  -- Value
  value REAL,
  period TEXT NOT NULL,
  date TEXT,
  unit TEXT,

  -- Geography
  geography TEXT NOT NULL,
  geo_code TEXT,
  province TEXT,

  -- Indicator-specific fields (stored as JSON for flexibility)
  dimensions TEXT NOT NULL DEFAULT '{}',

  -- Seasonal adjustment
  seasonal_adjustment TEXT,

  -- Provenance
  source_url TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(product_id, period, geography, id)
);

CREATE INDEX IF NOT EXISTS idx_statcan_indicator_type ON statcan_indicators(indicator_type);
CREATE INDEX IF NOT EXISTS idx_statcan_product_id ON statcan_indicators(product_id);
CREATE INDEX IF NOT EXISTS idx_statcan_period ON statcan_indicators(period DESC);
CREATE INDEX IF NOT EXISTS idx_statcan_date ON statcan_indicators(date DESC);
CREATE INDEX IF NOT EXISTS idx_statcan_geography ON statcan_indicators(geography);
CREATE INDEX IF NOT EXISTS idx_statcan_province ON statcan_indicators(province);
CREATE INDEX IF NOT EXISTS idx_statcan_value ON statcan_indicators(value);
CREATE INDEX IF NOT EXISTS idx_statcan_type_period ON statcan_indicators(indicator_type, period DESC);
CREATE INDEX IF NOT EXISTS idx_statcan_product_period ON statcan_indicators(product_id, period DESC);
CREATE INDEX IF NOT EXISTS idx_statcan_geo_period ON statcan_indicators(geography, period DESC);
CREATE INDEX IF NOT EXISTS idx_statcan_ingested ON statcan_indicators(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  WDS Request default options                                        */
/* ------------------------------------------------------------------ */

export const WDS_DEFAULT_TIMEOUT_MS = 60_000;
