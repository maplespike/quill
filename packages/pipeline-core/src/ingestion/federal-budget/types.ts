/**
 * Federal Budget Types — Quill
 *
 * Strongly-typed interfaces for Canadian federal budget, public accounts,
 * fiscal monitor, and departmental plan data.
 *
 * Sources:
 *   - Budget documents:   https://www.budget.canada.ca (HTML + PDFs)
 *   - Public accounts:    https://www.tpsgc-pwgsc.gc.ca/recgen/txt/72-eng.html (CSV + PDF)
 *   - Fiscal monitor:     https://www.fin.gc.ca/fm-mf/index-eng.asp
 *   - Departmental plans: https://www.canada.ca/en/government/system/departmental-plans.html
 *
 * Cross-reference opportunities:
 *   - Crown corporations: match budget allocations to crown corp funding
 *   - Oversight: OAG audits of public accounts, PBO analysis of budget
 *   - Procurement: track budget vs. actual spending on contracts
 *   - Influence: government funding flows to tracked actors
 */

/** Type of budget/fiscal record */
export type BudgetRecordType =
  | 'budget'              // Federal budget (Budget Plan, Budget in Brief, etc.)
  | 'public_accounts'     // Public Accounts of Canada (annual audited financials)
  | 'fiscal_monitor'      // Fiscal Monitor (monthly fiscal updates)
  | 'departmental_plan'   // Departmental Plans and Results Reports
  | 'fiscal_projections'  // Fiscal and economic projections (PBO, Finance Canada)
  | 'supplementary_estimates' // Supplementary Estimates (A, B, C)
  | 'main_estimates'      // Main Estimates
  | 'other';

/** Spending category / classification */
export type BudgetCategory =
  | 'revenue'             // Government revenue (tax, non-tax)
  | 'expense'             // Program expenses
  | 'debt-service'        // Public debt charges
  | 'transfer'            // Transfer payments (to persons, provinces, organizations)
  | 'capital'             // Capital spending
  | 'operating'           // Operating expenses
  | 'defense'             // National Defence
  | 'healthcare'          // Health transfers / spending
  | 'social'              // Social spending (EI, OAS, GIS, etc.)
  | 'education'           // Education & training
  | 'infrastructure'      // Infrastructure spending
  | 'indigenous'          // Indigenous programs
  | 'climate'             // Climate & environment
  | 'innovation'          // Innovation & economic development
  | 'immigration'         // Immigration & settlement
  | 'public-safety'       // Public safety & emergency management
  | 'culture'             // Heritage, arts, culture
  | 'pension'             // Pension obligations
  | 'other-revenue'       // Other revenue sources
  | 'other-expense'       // Other expense categories
  | 'total'               // Aggregate totals (total revenue, total expenses)
  | 'deficit'             // Budgetary balance (deficit/surplus)
  | 'debt'                // Federal debt (accumulated deficit)
  | 'gdp'                 // Gross Domestic Product (for projections)
  | 'unallocated';        // Uncategorized / contingency

/**
 * A single federal budget record — the unified schema covering budget
 * documents, public accounts, fiscal monitor updates, and departmental plans.
 */
export interface BudgetRecord {
  /** SHA-256 hash of the record content (primary key) */
  id: string;

  /** Fiscal year (e.g. "2024", "2024-25", "2025-26") */
  fiscalYear: string;

  /** Type of budget/fiscal record */
  recordType: BudgetRecordType;

  /** Government department or ministry (for departmental plans) */
  department: string | null;

  /** Department acronym (e.g. "FIN", "PSPC", "ISED") */
  departmentAcronym: string | null;

  /** Spending/revenue category */
  category: BudgetCategory;

  /** Amount in CAD (revenue positive, expense negative, deficit negative) */
  amount: number | null;

  /** Currency (default: CAD) */
  currency: string;

  /** Description of the line item / record */
  description: string | null;

  /** Title of the document or line item */
  title: string | null;

  /** Published date (ISO-8601) */
  publishedDate: string | null;

  /** Fiscal quarter (Q1-Q4 or "annual") */
  fiscalQuarter: string | null;

  /** Source URL where the record was originally retrieved */
  sourceUrl: string;

  /** Source system name (e.g. 'budget-canada', 'public-accounts-csv', 'fiscal-monitor') */
  sourceSystem: string;

  /** CKAN package ID if sourced from open.canada.ca */
  ckanPackageId: string | null;

  /** CKAN resource ID if sourced from a specific resource */
  ckanResourceId: string | null;

  /** Language of the source document ('en', 'fr', or null) */
  language: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * Ingestion options for federal budget data.
 */
export interface BudgetIngestionOptions {
  /** Specific fiscal years to fetch */
  fiscalYears?: string[];

  /** Record types to include (default: all) */
  recordTypes?: BudgetRecordType[];

  /** Specific departments to fetch (default: all) */
  departments?: string[];

  /** Start date for fetching records (ISO-8601) */
  dateFrom?: string;

  /** End date for fetching records (ISO-8601) */
  dateTo?: string;

  /** Max records to process (default: 1000) */
  maxRecords?: number;

  /** Progress callback */
  onProgress?: (msg: string) => void;

  /** Force re-ingest already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
}

/**
 * Result of a budget ingestion run.
 */
export interface BudgetIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perSource: Record<string, {
    recordsFound: number;
    recordsIngested: number;
    newRecords: number;
    errors: string[];
  }>;
  durationMs: number;
}

/**
 * CKAN package search response from open.canada.ca.
 */
export interface CKANPackageResponse {
  help: string;
  result: {
    count: number;
    sort: string;
    results: CKANPackage[];
  };
}

/**
 * CKAN package metadata.
 */
export interface CKANPackage {
  id: string;
  name: string;
  title: string;
  notes: string;
  organization: {
    name: string;
    title: string;
  } | null;
  resources: CKANResource[];
  metadata_created: string;
  metadata_modified: string;
}

/**
 * CKAN resource (file within a package).
 */
export interface CKANResource {
  id: string;
  package_id: string;
  name: string;
  format: string;
  url: string;
  created: string;
  last_modified: string | null;
  size: number | null;
}

/**
 * Raw CSV row from public accounts data.
 * The Public Accounts CSV schema varies by year and department.
 */
export interface RawPublicAccountsRow {
  /** Department name or ministry */
  Department?: string;
  /** Department acronym */
  'Department Acronym'?: string;
  /** Fiscal year */
  'Fiscal Year'?: string;
  /** Spending category */
  Category?: string;
  /** Amount in CAD */
  Amount?: string | number;
  /** Description of the item */
  Description?: string;
  /** Vote number (statutory vs voted) */
  Vote?: string;
  /** Type of appropriation */
  'Appropriation Type'?: string;
  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/**
 * Raw CSV row from fiscal monitor data.
 */
export interface RawFiscalMonitorRow {
  /** Month/year of the report */
  Period?: string;
  /** Fiscal year */
  'Fiscal Year'?: string;
  /** Category of revenue/expense */
  Category?: string;
  /** Amount in CAD (millions or billions) */
  Amount?: string | number;
  /** Whether this is budgetary, non-budgetary, or total */
  Type?: string;
  /** Description */
  Description?: string;
  /** Catch-all */
  [key: string]: unknown;
}

/**
 * Departmental plan / results report metadata.
 */
export interface RawDepartmentalPlanRow {
  /** Department name */
  Organization?: string;
  /** Fiscal year of the plan */
  'Fiscal Year'?: string;
  /** Type: Departmental Plan or Departmental Results Report */
  'Document Type'?: string;
  /** Title of the document */
  Title?: string;
  /** URL to the PDF/HTML document */
  URL?: string;
  /** Publication date */
  'Published Date'?: string;
  /** Catch-all */
  [key: string]: unknown;
}
