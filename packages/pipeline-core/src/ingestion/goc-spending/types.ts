/**
 * GoC-Spending Types — Quill
 *
 * Types for Government of Canada contract spending data from
 * the GoC-Spending project (goc-spending.github.io).
 *
 * Sources:
 *   - Combined dataset CSVs (source, clean, by_year)
 *   - Analysis aggregate CSVs (by department, by vendor, by year)
 *   - Raw proactive disclosure JSON archives
 */

/** A single contract entry from the combined dataset */
export interface GoCContract {
  id: string;
  /** Vendor/company name */
  vendor: string | null;
  /** Normalized vendor name (clean) */
  vendorNormalized: string | null;
  /** Department that issued the contract */
  department: string | null;
  /** Contract description */
  description: string | null;
  /** Contract value */
  value: number | null;
  /** Effective start year */
  startYear: number | null;
  /** Effective end year */
  endYear: number | null;
  /** Original source: proactive-disclosure or open-government */
  source: string | null;
  /** Contract reference number */
  referenceNumber: string | null;
  /** Contract date */
  contractDate: string | null;
  /** Procurement method (e.g. competitive, sole-source) */
  procurementMethod: string | null;
  /** Trade agreement exemption */
  tradeAgreementExemption: string | null;
  /** Data quality flag */
  isDuplicate: boolean;
  isError: boolean;
  /** SHA-256 hash of raw record for verification */
  dataHash: string;
  /** Ingestion timestamp */
  ingestedAt: string;
}

/** Aggregate spending by department */
export interface GoCDeptSpending {
  department: string;
  fiscalYear: string;
  contractCount: number;
  totalValue: number;
  avgValue: number;
  dataHash: string;
  ingestedAt: string;
}

/** Aggregate spending by vendor */
export interface GoCVendorSpending {
  vendor: string;
  vendorNormalized: string;
  totalContracts: number;
  totalValue: number;
  firstYear: number;
  lastYear: number;
  dataHash: string;
  ingestedAt: string;
}

export interface GoCIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
