/**
 * Health Data Types — Quill
 *
 * Unified TypeScript interfaces for deep health-data ingestion from:
 *   - PHAC  — Public Health Agency of Canada (disease surveillance, opioids, immunization)
 *   - CFIA  — Canadian Food Inspection Agency (food recalls, import refusals, inspections)
 *   - CIHI  — Canadian Institute for Health Information (wait times, health spending)
 *   - CADTH — Canadian Agency for Drugs and Technologies in Health (drug recommendations)
 *   - PMPRB — Patented Medicine Prices Review Board (drug pricing decisions)
 *
 * Cross-reference opportunities:
 *   - PHAC opioids ↔ CADTH drug recommendations (opioid therapies, safer supply)
 *   - CFIA recalls ↔ Health Canada recalls via health-canada module
 *   - PMPRB pricing ↔ corporate lobbying records / Health Canada DPD
 *   - CIHI wait times ↔ provincial health data / budget documents
 *   - PMPRB ↔ CADTH (drug review → pricing decision pipeline)
 */

/* ------------------------------------------------------------------ */
/*  Source / Agency Enum                                               */
/* ------------------------------------------------------------------ */

export type HealthDataSource =
  | 'phac'
  | 'cfia'
  | 'cihi'
  | 'cadth'
  | 'pmpb';

export type HealthDataCategory =
  | 'disease_surveillance'
  | 'opioid_deaths'
  | 'immunization_coverage'
  | 'food_recall'
  | 'import_refusal'
  | 'food_inspection'
  | 'wait_time'
  | 'health_spending'
  | 'drug_recommendation'
  | 'drug_pricing_decision'
  | 'drug_shortage';

/* ------------------------------------------------------------------ */
/*  PHAC — Public Health Agency of Canada                              */
/* ------------------------------------------------------------------ */

/** A PHAC disease surveillance record (notifiable diseases). */
export interface PhacDiseaseSurveillance {
  id: string;
  disease: string;
  year: number;
  week?: number;
  cases: number | null;
  cumulative_cases: number | null;
  province: string | null;
  age_group: string | null;
  sex: string | null;
  hospitalization: number | null;
  deaths: number | null;
  source_url: string;
  ingested_at: string;
}

/** A PHAC opioid-toxicity death record. */
export interface PhacOpioidDeath {
  id: string;
  year: number;
  month?: number;
  quarter?: string;
  province: string | null;
  opioid_type: string | null;
  deaths: number | null;
  rate_per_100k: number | null;
  apparent_opioid_toxicities: number | null;
  apparent_stimulant_toxicities: number | null;
  apparent_opioid_stimulant_toxicities: number | null;
  sex: string | null;
  age_group: string | null;
  source_url: string;
  ingested_at: string;
}

/** A PHAC immunization coverage record. */
export interface PhacImmunization {
  id: string;
  vaccine: string;
  year: number;
  age_group: string;
  coverage_percent: number | null;
  province: string | null;
  target_population: number | null;
  vaccinated: number | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  CFIA — Canadian Food Inspection Agency                             */
/* ------------------------------------------------------------------ */

/** A CFIA food recall alert. */
export interface CfiaRecall {
  id: string;
  recall_id: string | null;
  title: string;
  brand: string | null;
  product_type: string | null;
  product_name: string;
  lot_number: string | null;
  upc: string | null;
  reason: string | null;
  hazard_classification: string | null;
  recall_status: string | null;
  classification: string | null;
  company: string | null;
  province_distribution: string | null;
  distribution: string | null;
  recall_date: string | null;
  source_url: string;
  ingested_at: string;
}

/** A CFIA import refusal record. */
export interface CfiaImportRefusal {
  id: string;
  refusal_date: string | null;
  country_of_origin: string | null;
  manufacturer: string | null;
  product_type: string | null;
  product_sub_type: string | null;
  product_name: string;
  reason: string | null;
  import_city: string | null;
  import_province: string | null;
  cfia_office: string | null;
  source_url: string;
  ingested_at: string;
}

/** A CFIA food establishment inspection. */
export interface CfiaInspection {
  id: string;
  establishment_name: string;
  establishment_address: string | null;
  establishment_city: string | null;
  establishment_province: string | null;
  establishment_type: string | null;
  inspection_date: string | null;
  inspection_type: string | null;
  outcome: string | null;
  non_compliant: number | null;
  critical_violations: number | null;
  non_critical_violations: number | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  CIHI — Canadian Institute for Health Information                   */
/* ------------------------------------------------------------------ */

/** A CIHI wait-time record (surgery, diagnostic, emergency). */
export interface CihiWaitTime {
  id: string;
  year: number;
  province: string;
  surgery_type: string | null;
  procedure: string | null;
  wait_time_days: number | null;
  wait_time_p90_days: number | null;
  volume: number | null;
  priority: string | null;
  metric: string | null;
  source_url: string;
  ingested_at: string;
}

/** A CIHI health-spending record. */
export interface CihiHealthSpending {
  id: string;
  fiscal_year: string;
  province: string;
  spending_category: string | null;
  amount_cad: number | null;
  per_capita: number | null;
  growth_percent: number | null;
  share_of_gdp: number | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  CADTH — Canadian Agency for Drugs and Technologies in Health      */
/* ------------------------------------------------------------------ */

/** A CADTH drug recommendation (CDR/pCODR recommendation). */
export interface CadthRecommendation {
  id: string;
  drug_name: string;
  brand_name: string | null;
  manufacturer: string | null;
  indication: string | null;
  recommendation: string | null;
  recommendation_type: string | null;
  review_type: string | null;
  submission_date: string | null;
  recommendation_date: string | null;
  reimbursement_condition: string | null;
  therapeutic_area: string | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  PMPRB — Patented Medicine Prices Review Board                      */
/* ------------------------------------------------------------------ */

/** A PMPRB drug-pricing decision or report. */
export interface PmprbPricing {
  id: string;
  drug_name: string;
  manufacturer: string | null;
  decision_type: string | null;
  decision_date: string | null;
  status: string | null;
  therapeutic_category: string | null;
  proposed_price_cad: number | null;
  approved_price_cad: number | null;
  foreign_price_comparison: string | null;
  comparison_countries: string | null;
  atc_class: string | null;
  din: string | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  Drug Shortage Record (cross-cutting)                               */
/* ------------------------------------------------------------------ */

export interface DrugShortage {
  id: string;
  drug_name: string;
  din: string | null;
  company: string | null;
  shortage_reason: string | null;
  shortage_date: string | null;
  anticipated_end_date: string | null;
  status: string | null;
  therapeutic_area: string | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  Long-Term Care Inspection (per-province)                           */
/* ------------------------------------------------------------------ */

export interface LongTermCareInspection {
  id: string;
  province: string;
  facility_name: string;
  facility_type: string | null;
  inspection_date: string | null;
  inspection_type: string | null;
  overall_rating: string | null;
  total_deficiencies: number | null;
  critical_deficiencies: number | null;
  fines_amount_cad: number | null;
  resident_harm: string | null;
  source_url: string;
  ingested_at: string;
}

/* ------------------------------------------------------------------ */
/*  Unified Record Type                                                */
/* ------------------------------------------------------------------ */

/** A tagged union for all health-data record types. */
export type HealthDataRecord =
  | PhacDiseaseSurveillance
  | PhacOpioidDeath
  | PhacImmunization
  | CfiaRecall
  | CfiaImportRefusal
  | CfiaInspection
  | CihiWaitTime
  | CihiHealthSpending
  | CadthRecommendation
  | PmprbPricing
  | DrugShortage
  | LongTermCareInspection;

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface HealthDataIngestionOptions {
  /** Data sources to include (default: all) */
  sources?: HealthDataSource[];

  /** Data sub-categories per source (optional filter) */
  categories?: HealthDataCategory[];

  /** Max records per source (default: per-source constant) */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize D1 tables if they don't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface HealthDataIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perSource: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
