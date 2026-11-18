// SPDX-License-Identifier: AGPL-3.0-only
/**
 * StatCan WDS Data Types — Quill
 *
 * Strongly typed interfaces for every major Statistics Canada indicator
 * category fetched via the Web Data Service (WDS) REST API.
 *
 * All indicator records share a common base (StatCanRecord) with
 * category-specific extensions.
 *
 * Source terms: Statistics Canada publishes an Open Licence. Verify its
 * scope, dataset coverage, attribution, and exclusions for each use.
 * https://www.statcan.gc.ca/en/terms-conditions/open-licence
 */

/* ------------------------------------------------------------------ */
/*  Base Record Types                                                  */
/* ------------------------------------------------------------------ */

/** Common fields across all StatCan indicator records. */
export interface StatCanRecord {
  /** SHA-256 hash of the row content (primary key) */
  id: string;
  /** StatCan product ID (e.g. "18-10-0004-01") */
  productId: string;
  /** Indicator category (cpi, gdp, labour, population, trade, housing, social) */
  indicatorType: StatCanIndicatorType;
  /** The numeric value */
  value: number | null;
  /** Time period label (e.g. "2024-01", "2024", "2024Q1") */
  period: string;
  /** ISO date string parsed from the time dimension */
  date: string | null;
  /** Geographic level (Canada, province, city, etc.) */
  geography: string;
  /** Geographic code (e.g. "1" for Canada, "35" for Ontario) */
  geoCode: string | null;
  /** Unit of measurement (e.g. "Dollars", "Percent", "Units") */
  unit: string | null;
  /** Seasonal adjustment status */
  seasonalAdjustment: string | null;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
  /** Original dimension labels from JSON-stat response */
  dimensions: Record<string, string>;
  /** Source URL for provenance */
  sourceUrl: string;
}

export type StatCanIndicatorType =
  | 'cpi'
  | 'gdp'
  | 'labour'
  | 'population'
  | 'trade'
  | 'housing'
  | 'social';

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                   */
/* ------------------------------------------------------------------ */

export interface StatCanIngestionResult {
  indicatorType: StatCanIndicatorType;
  productId: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}

export interface StatCanAllIndicatorsResult {
  cpi: StatCanIngestionResult[];
  gdp: StatCanIngestionResult[];
  labour: StatCanIngestionResult[];
  population: StatCanIngestionResult[];
  trade: StatCanIngestionResult[];
  housing: StatCanIngestionResult[];
  social: StatCanIngestionResult[];
  totalRecords: number;
  totalErrors: number;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  CPI-specific Record                                                */
/* ------------------------------------------------------------------ */

export interface CpiRecord extends StatCanRecord {
  indicatorType: 'cpi';
  /** CPI product group (e.g. "All-items", "Food", "Shelter") */
  cpiProduct: string;
  /** CPI basket category */
  cpiCategory: string;
  /** Province if provincial-level */
  province: string | null;
  /** City if city-level */
  city: string | null;
}

/* ------------------------------------------------------------------ */
/*  GDP-specific Record                                                */
/* ------------------------------------------------------------------ */

export interface GdpRecord extends StatCanRecord {
  indicatorType: 'gdp';
  /** Industry name (NAICS-based) */
  industry: string;
  /** NAICS code */
  naics: string | null;
  /** Province (for provincial GDP) */
  province: string | null;
  /** GDP type: chained (real) or current (nominal) */
  gdpType: 'chained' | 'current';
}

/* ------------------------------------------------------------------ */
/*  Labour-specific Record                                             */
/* ------------------------------------------------------------------ */

export interface LabourRecord extends StatCanRecord {
  indicatorType: 'labour';
  /** Labour force characteristic (e.g. "Employment", "Unemployment rate") */
  labourCharacteristic: string;
  /** Population group (e.g. "15 years and over", "15 to 24 years") */
  populationGroup: string | null;
  /** Sex (e.g. "Both sexes", "Males", "Females") */
  sex: string | null;
  /** Industry (for employment by industry) */
  industry: string | null;
  /** NAICS code */
  naics: string | null;
  /** Province */
  province: string | null;
  /** Data type (seasonally adjusted, trend, raw) */
  dataType: string | null;
}

/* ------------------------------------------------------------------ */
/*  Population-specific Record                                         */
/* ------------------------------------------------------------------ */

export interface PopulationRecord extends StatCanRecord {
  indicatorType: 'population';
  /** Age group (e.g. "All ages", "0 to 4 years", "65 years and over") */
  ageGroup: string | null;
  /** Sex (e.g. "Both sexes", "Males", "Females") */
  sex: string | null;
  /** Province / territory */
  province: string | null;
  /** Population type (estimates, projections, census) */
  populationType: string;
}

/* ------------------------------------------------------------------ */
/*  Trade-specific Record                                              */
/* ------------------------------------------------------------------ */

export interface TradeRecord extends StatCanRecord {
  indicatorType: 'trade';
  /** Trade direction: exports, imports, balance */
  tradeDirection: 'exports' | 'imports' | 'balance';
  /** Trade type: merchandise or services */
  tradeType: 'merchandise' | 'services';
  /** Partner country / region */
  partner: string | null;
  /** Partner country code */
  partnerCode: string | null;
  /** Product category */
  productCategory: string | null;
  /** Province (for provincial trade data) */
  province: string | null;
  /** Seasonal adjustment */
  seasonalAdjustment: string | null;
}

/* ------------------------------------------------------------------ */
/*  Housing-specific Record                                            */
/* ------------------------------------------------------------------ */

export interface HousingRecord extends StatCanRecord {
  indicatorType: 'housing';
  /** Housing metric: starts, permits, price index, completions */
  housingMetric: 'starts' | 'permits' | 'price_index' | 'completions';
  /** Geographic area type: province, CMA, Canada */
  areaType: string | null;
  /** CMA / city name */
  cma: string | null;
  /** Housing type (single, multiple, all) */
  housingType: string | null;
  /** Province */
  province: string | null;
}

/* ------------------------------------------------------------------ */
/*  Social-specific Record                                             */
/* ------------------------------------------------------------------ */

export interface SocialRecord extends StatCanRecord {
  indicatorType: 'social';
  /** Social indicator category */
  socialCategory: 'crime' | 'education' | 'health' | 'income';
  /** Detailed indicator name */
  indicatorName: string;
  /** Demographic breakdown */
  demographic: string | null;
  /** Geographic level */
  geoLevel: string | null;
  /** Province */
  province: string | null;
}

/* ------------------------------------------------------------------ */
/*  JSON-stat Parsing Types                                            */
/* ------------------------------------------------------------------ */

export interface JsonStatResponse {
  version: string;
  class: 'dataset';
  label: string;
  source?: string;
  updated?: string;
  id: string[];
  size: number[];
  dimension: Record<string, JsonStatDimension>;
  value: (number | null)[];
  status?: (string | null)[];
  href?: string;
}

export interface JsonStatDimension {
  label: string;
  category: {
    index: Record<string, number>;
    label: Record<string, string>;
    unit?: Record<string, JsonStatUnit>;
  };
}

export interface JsonStatUnit {
  label: string;
  symbol?: string;
  decimals?: number;
  basis?: string;
}

/* ------------------------------------------------------------------ */
/*  WDS Endpoint Response Types                                        */
/* ------------------------------------------------------------------ */

export interface WdsCubeLite {
  productId: string;
  cubeTitleEn: string;
  cubeTitleFr: string;
  cubeSummaryEn: string | null;
  cubeSummaryFr: string | null;
  subjectCode: string;
  subjectEn: string;
  subjectFr: string;
  releaseTime: string;
  frequency: string;
}

export interface WdsCubeMetadata {
  productId: string;
  cubeTitleEn: string;
  cubeTitleFr: string;
  cubeSummaryEn: string | null;
  cubeSummaryFr: string | null;
  subjectCode: string;
  subjectEn: string;
  subjectFr: string;
  releaseTime: string;
  frequency: string;
  dimension: Record<string, {
    dimensionNameId: string;
    dimensionNameEn: string;
    dimensionNameFr: string;
    hasHarvest: boolean;
    values: Array<{
      memberNameEn: string;
      memberNameFr: string;
      memberId: string;
    }>;
  }>;
}

/** WDS error response shape */
export interface WdsErrorResponse {
  status: string;
  message: string;
  errors?: Array<{ code: string; message: string }>;
}
