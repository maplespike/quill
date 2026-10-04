/**
 * Crown Corporations Types — Quill
 *
 * Types for tracking Canada's crown corporations — government-owned
 * enterprises that operate at arm's length from the federal government.
 *
 * Tracked crown corporations include:
 *   - CBC/Radio-Canada (public broadcaster)
 *   - Canada Post Corporation
 *   - CN Rail (privatized 1995, still tracked for historical/legacy)
 *   - Via Rail (passenger rail)
 *   - EDC (Export Development Canada)
 *   - BDC (Business Development Bank of Canada)
 *   - CMHC (Canada Mortgage and Housing Corporation)
 *   - CCC (Canada Council for the Arts)
 *   - National Arts Centre
 *   - Other Schedule III/Part X crown corporations
 *
 * Each crown corporation publishes:
 *   - Annual reports (PDF, with audited financial statements)
 *   - Quarterly financial reports
 *   - Corporate plans / summaries
 *   - Board meeting minutes (varies by corp)
 *   - Executive compensation disclosures
 */

/** Crown corporation identifier code */
export type CrownCorporationCode =
  | 'CBC'           // Canadian Broadcasting Corporation
  | 'CPC'           // Canada Post Corporation
  | 'CN'            // Canadian National Railway (privatized 1995)
  | 'VIA'           // Via Rail Canada
  | 'EDC'           // Export Development Canada
  | 'BDC'           // Business Development Bank of Canada
  | 'CMHC'          // Canada Mortgage and Housing Corporation
  | 'CCC'           // Canada Council for the Arts
  | 'NAC'           // National Arts Centre
  | 'NRC'           // National Research Council (not a crown corp per se, but tracked)
  | 'CBCL'          // Cape Breton Development Corporation
  | 'FCC'           // Farm Credit Canada
  | 'PBC'           // Public Sector Pension Investment Board
  | 'C.D.C.'        // Canada Development Corporation
  | 'OTHER';        // Placeholder for future additions

/** Type of report published by a crown corporation */
export type ReportType =
  | 'annual-report'
  | 'quarterly-financials'
  | 'corporate-plan'
  | 'board-minutes'
  | 'executive-compensation'
  | 'sustainability-report'
  | 'diversity-report'
  | 'other';

/**
 * A single crown corporation record — the unified schema covering
 * reports, financials, governance, and disclosures.
 *
 * Fields are nullable where not all data sources provide them.
 */
export interface CrownCorporationRecord {
  /** SHA-256 hash of the record content (primary key) */
  id: string;

  /** Crown corporation code */
  org: CrownCorporationCode;

  /** Organization full legal name */
  orgName: string;

  /** Report type */
  reportType: ReportType;

  /** Fiscal year (e.g. "2024", "2023-24") */
  fiscalYear: string;

  /** Fiscal quarter (Q1-Q4 or "annual") */
  fiscalQuarter: string | null;

  /** Report title */
  title: string | null;

  /** Report summary / description */
  summary: string | null;

  /** Total revenue in CAD (as reported) */
  revenue: number | null;

  /** Total expenses in CAD */
  expenses: number | null;

  /** Net income in CAD (positive = profit, negative = loss) */
  netIncome: number | null;

  /** Government funding / appropriations in CAD */
  governmentFunding: number | null;

  /** Total assets in CAD (from balance sheet) */
  totalAssets: number | null;

  /** Total liabilities in CAD */
  totalLiabilities: number | null;

  /** Number of employees (FTE) */
  employeeCount: number | null;

  /** Executive compensation data (JSON string with named entries) */
  executiveCompensation: string | null;

  /** Board members (JSON string array) */
  boardMembers: string | null;

  /** Chairperson of the board */
  boardChair: string | null;

  /** CEO / President name */
  ceoName: string | null;

  /** URL to the report document (PDF or HTML) */
  reportUrl: string | null;

  /** Published date (ISO-8601) */
  publishedDate: string | null;

  /** Language of the report ('en', 'fr', or null) */
  language: string | null;

  /** Source URL where the record was originally retrieved */
  sourceUrl: string;

  /** Source system name (e.g. 'cbc-annual-reports', 'canadapost-rss') */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * Configuration for a single crown corporation data source.
 */
export interface CrownCorporationConfig {
  /** Organization code */
  code: CrownCorporationCode;

  /** Organization full legal name */
  name: string;

  /** Short display name */
  shortName: string;

  /** Homepage URL */
  homepageUrl: string;

  /** Annual reports listing URL */
  annualReportsUrl: string | null;

  /** Quarterly financials URL */
  quarterlyReportsUrl: string | null;

  /** Corporate plans URL */
  corporatePlanUrl: string | null;

  /** Board minutes URL */
  boardMinutesUrl: string | null;

  /** Executive compensation disclosure URL */
  executiveCompUrl: string | null;

  /** RSS feed URL for publications (if available) */
  rssFeedUrl: string | null;

  /** Whether this entity is still a crown corporation */
  isCurrent: boolean;

  /** Sector / industry classification */
  sector: string;

  /** Reporting currency */
  currency: string;

  /** Notes about data availability */
  notes?: string;
}

/**
 * Ingestion options for crown corporation data.
 */
export interface CrownCorporationIngestionOptions {
  /** Specific crown corporations to fetch (default: all current) */
  orgs?: CrownCorporationCode[];

  /** Report types to include (default: all) */
  reportTypes?: ReportType[];

  /** Fiscal year filter */
  fiscalYear?: string;

  /** Start date for fetching records (ISO-8601) */
  dateFrom?: string;

  /** End date for fetching records (ISO-8601) */
  dateTo?: string;

  /** Max records per org (default: 100) */
  maxRecordsPerOrg?: number;

  /** Progress callback */
  onProgress?: (msg: string) => void;

  /** Force re-ingest already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
}

/**
 * Result of a crown corporation ingestion run.
 */
export interface CrownCorporationIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perOrg: Record<string, {
    recordsFound: number;
    recordsIngested: number;
    newRecords: number;
    errors: string[];
  }>;
  durationMs: number;
}
