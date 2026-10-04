/**
 * Health Data Ingestion Constants — Quill
 *
 * Source URLs, DDL statements, and defaults for ingesting deep health-data
 * from PHAC, CFIA, CIHI, CADTH, and PMPRB.
 *
 * CKAN base: https://open.canada.ca/data/api/3/action/
 */

import type { HealthDataSource, HealthDataCategory } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs & Datasets                                             */
/* ------------------------------------------------------------------ */

export const HEALTH_DATA_SOURCES: Record<string, Record<string, string>> = {
  PHAC: {
    BASE: 'https://open.canada.ca/data/api/3/action/',
    DISEASE_SURVEILLANCE: 'https://open.canada.ca/data/api/3/action/package_search?q=public+health+agency+disease+surveillance&rows=20',
    OPIOID_DEATHS: 'https://open.canada.ca/data/api/3/action/package_search?q=opioid+toxicity+deaths&rows=20',
    IMMUNIZATION: 'https://open.canada.ca/data/api/3/action/package_search?q=immunization+coverage+canada&rows=20',
    DRUG_SHORTAGES: 'https://open.canada.ca/data/api/3/action/package_search?q=drug+shortage&rows=20',
    OPIOID_DETAIL: 'https://health-infobase.canada.ca/src/data/covidLive/OpioidMortalityData.json',
  },
  CFIA: {
    BASE: 'https://open.canada.ca/data/api/3/action/',
    FOOD_RECALLS: 'https://open.canada.ca/data/api/3/action/package_search?q=canadian+food+inspection+agency+recalls&rows=20',
    IMPORT_REFUSALS: 'https://open.canada.ca/data/api/3/action/package_search?q=cfia+import+refusals&rows=20',
    INSPECTIONS: 'https://open.canada.ca/data/api/3/action/package_search?q=cfia+food+establishment+inspection&rows=20',
    RECALL_RSS: 'https://healthycanadians.gc.ca/recall-alert-rappels-avis/rss/en',
  },
  CIHI: {
    BASE: 'https://www.cihi.ca/en/data',
    BASE_OPEN_CANADA: 'https://open.canada.ca/data/api/3/action/',
    WAIT_TIMES_SURGERY: 'https://www.cihi.ca/en/access-data-and-reports/wait-times-for-surgery-and-diagnostic-tests',
    HEALTH_SPENDING: 'https://www.cihi.ca/en/national-health-expenditure-trends',
  },
  CADTH: {
    BASE: 'https://www.cadth.ca',
    RECOMMENDATIONS: 'https://www.cadth.ca/drugs',
    CDR_RECOMMENDATIONS: 'https://www.cadth.ca/cdr-recommendations',
    PCODR_RECOMMENDATIONS: 'https://www.cadth.ca/pcodr-recommendations',
  },
  PMPRB: {
    BASE: 'https://open.canada.ca/data/api/3/action/',
    PRICING_DECISIONS: 'https://open.canada.ca/data/api/3/action/package_search?q=patented+medicine+prices+review+board&rows=20',
    ANNUAL_REPORT: 'https://www.pmprb-cepmb.gc.ca/CMFiles/Publications/Annual%20Report',
  },
};

/* ------------------------------------------------------------------ */
/*  Data Category → Source Mappings                                    */
/* ------------------------------------------------------------------ */

export const DATA_CATEGORY_TO_SOURCE: Record<HealthDataCategory, HealthDataSource> = {
  disease_surveillance: 'phac',
  opioid_deaths: 'phac',
  immunization_coverage: 'phac',
  food_recall: 'cfia',
  import_refusal: 'cfia',
  food_inspection: 'cfia',
  wait_time: 'cihi',
  health_spending: 'cihi',
  drug_recommendation: 'cadth',
  drug_pricing_decision: 'pmpb',
  drug_shortage: 'phac',
};

export const SOURCE_CATEGORIES: Record<HealthDataSource, HealthDataCategory[]> = {
  phac: ['disease_surveillance', 'opioid_deaths', 'immunization_coverage', 'drug_shortage'],
  cfia: ['food_recall', 'import_refusal', 'food_inspection'],
  cihi: ['wait_time', 'health_spending'],
  cadth: ['drug_recommendation'],
  pmpb: ['drug_pricing_decision'],
};

export const ALL_HEALTH_DATA_SOURCES: HealthDataSource[] = ['phac', 'cfia', 'cihi', 'cadth', 'pmpb'];

export const ALL_HEALTH_DATA_CATEGORIES: HealthDataCategory[] = [
  'disease_surveillance', 'opioid_deaths', 'immunization_coverage',
  'food_recall', 'import_refusal', 'food_inspection',
  'wait_time', 'health_spending',
  'drug_recommendation', 'drug_pricing_decision',
  'drug_shortage',
];

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_CKAN_ROWS = 20;

/* ------------------------------------------------------------------ */
/*  HTTP Timeout (ms)                                                  */
/* ------------------------------------------------------------------ */

export const HTTP_TIMEOUT_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  DDL — PHAC Surveillance                                            */
/* ------------------------------------------------------------------ */

export const PHAC_DISEASE_SURVEILLANCE_DDL = `
CREATE TABLE IF NOT EXISTS health_phac_surveillance (
  id TEXT PRIMARY KEY,
  disease TEXT NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER,
  cases INTEGER,
  cumulative_cases INTEGER,
  province TEXT,
  age_group TEXT,
  sex TEXT,
  hospitalization INTEGER,
  deaths INTEGER,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phac_surv_disease ON health_phac_surveillance(disease);
CREATE INDEX IF NOT EXISTS idx_phac_surv_year ON health_phac_surveillance(year);
CREATE INDEX IF NOT EXISTS idx_phac_surv_province ON health_phac_surveillance(province);
`;

export const PHAC_OPIOID_DEATHS_DDL = `
CREATE TABLE IF NOT EXISTS health_phac_opioid_deaths (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER,
  quarter TEXT,
  province TEXT,
  opioid_type TEXT,
  deaths INTEGER,
  rate_per_100k REAL,
  apparent_opioid_toxicities INTEGER,
  apparent_stimulant_toxicities INTEGER,
  apparent_opioid_stimulant_toxicities INTEGER,
  sex TEXT,
  age_group TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phac_opioid_year ON health_phac_opioid_deaths(year);
CREATE INDEX IF NOT EXISTS idx_phac_opioid_province ON health_phac_opioid_deaths(province);
CREATE INDEX IF NOT EXISTS idx_phac_opioid_type ON health_phac_opioid_deaths(opioid_type);
`;

export const PHAC_IMMUNIZATION_DDL = `
CREATE TABLE IF NOT EXISTS health_phac_immunization (
  id TEXT PRIMARY KEY,
  vaccine TEXT NOT NULL,
  year INTEGER NOT NULL,
  age_group TEXT NOT NULL,
  coverage_percent REAL,
  province TEXT,
  target_population INTEGER,
  vaccinated INTEGER,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phac_imm_vaccine ON health_phac_immunization(vaccine);
CREATE INDEX IF NOT EXISTS idx_phac_imm_year ON health_phac_immunization(year);
`;

export const PHAC_DRUG_SHORTAGES_DDL = `
CREATE TABLE IF NOT EXISTS health_drug_shortages (
  id TEXT PRIMARY KEY,
  drug_name TEXT NOT NULL,
  din TEXT,
  company TEXT,
  shortage_reason TEXT,
  shortage_date TEXT,
  anticipated_end_date TEXT,
  status TEXT,
  therapeutic_area TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ds_drug ON health_drug_shortages(drug_name);
CREATE INDEX IF NOT EXISTS idx_ds_status ON health_drug_shortages(status);
CREATE INDEX IF NOT EXISTS idx_ds_date ON health_drug_shortages(shortage_date);
`;

/* ------------------------------------------------------------------ */
/*  DDL — CFIA                                                         */
/* ------------------------------------------------------------------ */

export const CFIA_RECALLS_DDL = `
CREATE TABLE IF NOT EXISTS health_cfia_recalls (
  id TEXT PRIMARY KEY,
  recall_id TEXT,
  title TEXT NOT NULL,
  brand TEXT,
  product_type TEXT,
  product_name TEXT NOT NULL,
  lot_number TEXT,
  upc TEXT,
  reason TEXT,
  hazard_classification TEXT,
  recall_status TEXT,
  classification TEXT,
  company TEXT,
  province_distribution TEXT,
  distribution TEXT,
  recall_date TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cfia_recall_company ON health_cfia_recalls(company);
CREATE INDEX IF NOT EXISTS idx_cfia_recall_date ON health_cfia_recalls(recall_date);
CREATE INDEX IF NOT EXISTS idx_cfia_recall_class ON health_cfia_recalls(classification);
`;

export const CFIA_IMPORT_REFUSALS_DDL = `
CREATE TABLE IF NOT EXISTS health_cfia_import_refusals (
  id TEXT PRIMARY KEY,
  refusal_date TEXT,
  country_of_origin TEXT,
  manufacturer TEXT,
  product_type TEXT,
  product_sub_type TEXT,
  product_name TEXT NOT NULL,
  reason TEXT,
  import_city TEXT,
  import_province TEXT,
  cfia_office TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cfia_refusal_country ON health_cfia_import_refusals(country_of_origin);
CREATE INDEX IF NOT EXISTS idx_cfia_refusal_date ON health_cfia_import_refusals(refusal_date);
CREATE INDEX IF NOT EXISTS idx_cfia_refusal_type ON health_cfia_import_refusals(product_type);
`;

export const CFIA_INSPECTIONS_DDL = `
CREATE TABLE IF NOT EXISTS health_cfia_inspections (
  id TEXT PRIMARY KEY,
  establishment_name TEXT NOT NULL,
  establishment_address TEXT,
  establishment_city TEXT,
  establishment_province TEXT,
  establishment_type TEXT,
  inspection_date TEXT,
  inspection_type TEXT,
  outcome TEXT,
  non_compliant INTEGER,
  critical_violations INTEGER,
  non_critical_violations INTEGER,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cfia_insp_name ON health_cfia_inspections(establishment_name);
CREATE INDEX IF NOT EXISTS idx_cfia_insp_date ON health_cfia_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_cfia_insp_outcome ON health_cfia_inspections(outcome);
`;

/* ------------------------------------------------------------------ */
/*  DDL — CIHI                                                         */
/* ------------------------------------------------------------------ */

export const CIHI_WAIT_TIMES_DDL = `
CREATE TABLE IF NOT EXISTS health_cihi_wait_times (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  province TEXT NOT NULL,
  surgery_type TEXT,
  procedure TEXT,
  wait_time_days REAL,
  wait_time_p90_days REAL,
  volume INTEGER,
  priority TEXT,
  metric TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cihi_wt_province ON health_cihi_wait_times(province);
CREATE INDEX IF NOT EXISTS idx_cihi_wt_year ON health_cihi_wait_times(year);
CREATE INDEX IF NOT EXISTS idx_cihi_wt_surgery ON health_cihi_wait_times(surgery_type);
`;

export const CIHI_HEALTH_SPENDING_DDL = `
CREATE TABLE IF NOT EXISTS health_cihi_spending (
  id TEXT PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  province TEXT NOT NULL,
  spending_category TEXT,
  amount_cad REAL,
  per_capita REAL,
  growth_percent REAL,
  share_of_gdp REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cihi_spend_fy ON health_cihi_spending(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_cihi_spend_province ON health_cihi_spending(province);
CREATE INDEX IF NOT EXISTS idx_cihi_spend_category ON health_cihi_spending(spending_category);
`;

/* ------------------------------------------------------------------ */
/*  DDL — CADTH                                                        */
/* ------------------------------------------------------------------ */

export const CADTH_RECOMMENDATIONS_DDL = `
CREATE TABLE IF NOT EXISTS health_cadth_recommendations (
  id TEXT PRIMARY KEY,
  drug_name TEXT NOT NULL,
  brand_name TEXT,
  manufacturer TEXT,
  indication TEXT,
  recommendation TEXT,
  recommendation_type TEXT,
  review_type TEXT,
  submission_date TEXT,
  recommendation_date TEXT,
  reimbursement_condition TEXT,
  therapeutic_area TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cadth_drug ON health_cadth_recommendations(drug_name);
CREATE INDEX IF NOT EXISTS idx_cadth_date ON health_cadth_recommendations(recommendation_date);
CREATE INDEX IF NOT EXISTS idx_cadth_rec ON health_cadth_recommendations(recommendation);
`;

/* ------------------------------------------------------------------ */
/*  DDL — PMPRB                                                        */
/* ------------------------------------------------------------------ */

export const PMPRB_PRICING_DDL = `
CREATE TABLE IF NOT EXISTS health_pmprb_pricing (
  id TEXT PRIMARY KEY,
  drug_name TEXT NOT NULL,
  manufacturer TEXT,
  decision_type TEXT,
  decision_date TEXT,
  status TEXT,
  therapeutic_category TEXT,
  proposed_price_cad REAL,
  approved_price_cad REAL,
  foreign_price_comparison TEXT,
  comparison_countries TEXT,
  atc_class TEXT,
  din TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pmprb_drug ON health_pmprb_pricing(drug_name);
CREATE INDEX IF NOT EXISTS idx_pmprb_date ON health_pmprb_pricing(decision_date);
CREATE INDEX IF NOT EXISTS idx_pmprb_status ON health_pmprb_pricing(status);
`;

/* ------------------------------------------------------------------ */
/*  LTC Inspection DDL                                                 */
/* ------------------------------------------------------------------ */

export const LTC_INSPECTIONS_DDL = `
CREATE TABLE IF NOT EXISTS health_ltc_inspections (
  id TEXT PRIMARY KEY,
  province TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  facility_type TEXT,
  inspection_date TEXT,
  inspection_type TEXT,
  overall_rating TEXT,
  total_deficiencies INTEGER,
  critical_deficiencies INTEGER,
  fines_amount_cad REAL,
  resident_harm TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ltc_province ON health_ltc_inspections(province);
CREATE INDEX IF NOT EXISTS idx_ltc_facility ON health_ltc_inspections(facility_name);
CREATE INDEX IF NOT EXISTS idx_ltc_date ON health_ltc_inspections(inspection_date);
`;

/* ------------------------------------------------------------------ */
/*  Aggregated DDL for all health-data tables                          */
/* ------------------------------------------------------------------ */

export const HEALTH_DATA_DDL = [
  PHAC_DISEASE_SURVEILLANCE_DDL,
  PHAC_OPIOID_DEATHS_DDL,
  PHAC_IMMUNIZATION_DDL,
  PHAC_DRUG_SHORTAGES_DDL,
  CFIA_RECALLS_DDL,
  CFIA_IMPORT_REFUSALS_DDL,
  CFIA_INSPECTIONS_DDL,
  CIHI_WAIT_TIMES_DDL,
  CIHI_HEALTH_SPENDING_DDL,
  CADTH_RECOMMENDATIONS_DDL,
  PMPRB_PRICING_DDL,
  LTC_INSPECTIONS_DDL,
];

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class HealthDataError extends Error {
  constructor(message: string, public readonly source?: string) {
    super(message);
    this.name = 'HealthDataError';
  }
}
