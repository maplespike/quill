// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Social Programs Data Types — Quill
 *
 * Strongly-typed interfaces for Canadian social program data from
 * federal and provincial sources including CPP, OAS, EI, CCB,
 * poverty statistics, social assistance, and food security.
 *
 * Data Sources (open.canada.ca CKAN + HTML annual reports):
 *   - CPP/OAS beneficiaries: open.canada.ca dataset
 *   - EI statistics: open.canada.ca dataset
 *   - Canada Child Benefit: open.canada.ca dataset
 *   - LICO/LIM/MBM poverty: open.canada.ca dataset
 *   - Provincial social assistance: HTML per province
 *   - Food banks: Food Banks Canada annual HungerCount
 *   - Homelessness: Reaching Home point-in-time counts
 *   - Canada Disability Benefit: HTML reports
 *   - CPPIB investments: cppinvestments.com annual report
 */

// ─── CPP/OAS ────────────────────────────────────────────────────────────

export interface CppOasBeneficiary {
  /** SHA-256 hash of record (primary key) */
  id: string;
  /** Program: CPP, OAS, GIS, Allowance */
  program: CppOasProgram;
  /** Fiscal or calendar year (e.g. "2023-2024") */
  year: string;
  /** Number of beneficiaries */
  beneficiaries: number;
  /** Province/territory 2-letter code, or "CA" for national */
  province: string;
  /** Gender breakdown if available */
  gender: string | null;
  /** Age bracket if available */
  ageGroup: string | null;
  /** Total benefits paid ($CAD) if available */
  benefitsPaid: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export type CppOasProgram = 'cpp' | 'oas' | 'gis' | 'allowance' | 'cppib';

export interface CppibInvestment {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Fiscal year (e.g. "2024") */
  year: string;
  /** Total assets under management ($CAD) */
  totalAssets: number;
  /** Annual net return (percentage) */
  netReturn: number | null;
  /** 5-year annualized return */
  return5yr: number | null;
  /** 10-year annualized return */
  return10yr: number | null;
  /** Breakdown by asset class (JSON string) */
  assetAllocation: string | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

// ─── Employment Insurance ───────────────────────────────────────────────

export interface EiRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Year or month period (e.g. "2024-01") */
  period: string;
  /** Province/territory 2-letter code */
  province: string;
  /** EI category: claims, beneficiaries, benefits, disqualifications */
  category: EiCategory;
  /** Number of claims/beneficiaries */
  value: number;
  /** Rate (e.g. disqualification rate %) */
  rate: number | null;
  /** Sex breakdown if available */
  sex: string | null;
  /** Age group if available */
  ageGroup: string | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export type EiCategory =
  | 'claims_received'
  | 'claims_established'
  | 'beneficiaries'
  | 'benefits_paid'
  | 'disqualifications'
  | 'disqualification_rate'
  | 'average_duration'
  | 'average_weekly_benefit';

// ─── Canada Child Benefit ───────────────────────────────────────────────

export interface CcbRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Benefit year (e.g. "2023-2024", "2024-07") */
  period: string;
  /** Federal riding or province */
  region: string;
  /** Region type: 'riding' or 'province' or 'national' */
  regionType: 'riding' | 'province' | 'national';
  /** Number of families receiving CCB */
  families: number;
  /** Number of children covered */
  children: number | null;
  /** Total payments ($CAD) */
  totalPayments: number | null;
  /** Average payment per family ($CAD) */
  averagePerFamily: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

// ─── Poverty Statistics ─────────────────────────────────────────────────

export interface PovertyRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Year */
  year: string;
  /** Poverty measure: LICO, LIM, MBM */
  measure: PovertyMeasure;
  /** Province/territory or "CA" for national */
  province: string;
  /** Population group: 'all', 'children', 'seniors', 'working_age', 'families', 'unattached' */
  populationGroup: string;
  /** Poverty rate (percentage) */
  rate: number | null;
  /** Number of persons in poverty */
  count: number | null;
  /** Median income (after-tax, $CAD) */
  medianIncome: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export type PovertyMeasure = 'lico' | 'lim' | 'mbm';

export interface MbmThreshold {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Year */
  year: string;
  /** Province */
  province: string;
  /** Community size category */
  communitySize: string;
  /** MBM threshold for 2-adult-2-child family */
  threshold2adult2child: number | null;
  /** MBM threshold for single adult */
  thresholdSingle: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

// ─── Social Assistance (Provincial Welfare) ─────────────────────────────

export interface SocialAssistanceRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Year */
  year: string;
  /** Province/territory 2-letter code */
  province: string;
  /** Program name (e.g. "Ontario Works", "BC Employment and Assistance") */
  program: string;
  /** Household type: 'single_employable', 'single_disabled', 'lone_parent', 'couple_2children' */
  householdType: string;
  /** Maximum monthly benefit ($CAD) */
  monthlyBenefit: number | null;
  /** Shelter allowance maximum ($CAD) */
  shelterAllowance: number | null;
  /** Total maximum assistance ($CAD) */
  totalAssistance: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

// ─── Food Security (Food Banks, Homelessness, Disability) ──────────────

export interface FoodBankRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Report year (e.g. "2024") */
  year: string;
  /** Province/territory or "CA" for national */
  province: string;
  /** Number of food bank visits / individuals served */
  visits: number | null;
  /** Number of unique individuals */
  individuals: number | null;
  /** Percentage children */
  pctChildren: number | null;
  /** Percentage seniors */
  pctSeniors: number | null;
  /** Percentage employed */
  pctEmployed: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface HomelessnessRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Year */
  year: string;
  /** Community name */
  community: string;
  /** Province/territory */
  province: string;
  /** Total homeless count (point-in-time) */
  totalHomeless: number | null;
  /** Sheltered count */
  sheltered: number | null;
  /** Unsheltered count */
  unsheltered: number | null;
  /** Indigenous percentage */
  pctIndigenous: number | null;
  /** Youth (under 25) count */
  youthCount: number | null;
  /** Veterans count */
  veteranCount: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface DisabilityBenefitRecord {
  /** SHA-256 hash (primary key) */
  id: string;
  /** Year */
  year: string;
  /** Program name */
  program: string;
  /** Jurisdiction (federal or province) */
  jurisdiction: string;
  /** Maximum monthly benefit ($CAD) */
  monthlyBenefit: number | null;
  /** Number of recipients */
  recipients: number | null;
  /** Source URL */
  sourceUrl: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

// ─── CKAN Package Result (shared across all social program modules) ─────

export interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  created: string;
  last_modified: string;
}

export interface CkanPackageResult {
  id: string;
  title: string;
  notes: string | null;
  resources: CkanResource[];
}

// ─── Ingestion Results ──────────────────────────────────────────────────

export interface SocialIngestionResult {
  cppOas: { recordsFound: number; recordsIngested: number; errors: string[] };
  cppib: { recordsFound: number; recordsIngested: number; errors: string[] };
  ei: { recordsFound: number; recordsIngested: number; errors: string[] };
  ccb: { recordsFound: number; recordsIngested: number; errors: string[] };
  poverty: { recordsFound: number; recordsIngested: number; errors: string[] };
  socialAssistance: { recordsFound: number; recordsIngested: number; errors: string[] };
  foodSecurity: { recordsFound: number; recordsIngested: number; errors: string[] };
  durationMs: number;
}
