// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Federal Budget Constants — Quill
 *
 * Source URLs, department lists, spending categories, CKAN package IDs,
 * and default options for Canadian federal budget data ingestion.
 *
 * Sources:
 *   - Budget documents:   https://www.budget.canada.ca
 *   - Public accounts:    https://www.tpsgc-pwgsc.gc.ca/recgen/txt/72-eng.html
 *   - Fiscal monitor:     https://www.fin.gc.ca/fm-mf/index-eng.asp
 *   - Departmental plans: https://www.canada.ca/en/government/system/departmental-plans.html
 *   - Open Canada CKAN:   https://open.canada.ca/data
 */

import type { BudgetCategory, BudgetRecordType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const BUDGET_SOURCES = {
  /** Budget Canada — federal budget documents */
  BUDGET_CANADA: {
    BASE: 'https://www.budget.canada.ca',
    /** Budget plan landing page */
    BUDGET_PLAN: 'https://www.budget.canada.ca/budget-plan',
    /** Budget in Brief */
    BUDGET_IN_BRIEF: 'https://www.budget.canada.ca/2025/home-accueil-en.html',
    /** Budget documents index */
    DOCUMENTS: 'https://www.budget.canada.ca/budget-documents',
    /** Previous budgets archive */
    ARCHIVE: 'https://www.budget.canada.ca/archives-en.html',
  },

  /** Public Accounts of Canada — Receiver General */
  PUBLIC_ACCOUNTS: {
    BASE: 'https://www.tpsgc-pwgsc.gc.ca/recgen/txt/72-eng.html',
    /** Public Accounts volumes landing page */
    VOLUMES: 'https://www.tpsgc-pwgsc.gc.ca/recgen/cpc-pac/index-eng.html',
    /** CSV data files */
    CSV_DATA: 'https://www.tpsgc-pwgsc.gc.ca/recgen/csv/index-eng.html',
  },

  /** Fiscal Monitor — Department of Finance Canada */
  FISCAL_MONITOR: {
    BASE: 'https://www.fin.gc.ca/fm-mf/index-eng.asp',
    /** Monthly reports */
    MONTHLY: 'https://www.fin.gc.ca/fm-mf/2025/index-eng.asp',
    /** Data tables */
    DATA_TABLES: 'https://www.fin.gc.ca/fm-mf/tables-eng.asp',
  },

  /** Departmental Plans and Results Reports */
  DEPARTMENTAL_PLANS: {
    BASE: 'https://www.canada.ca/en/government/system/departmental-plans.html',
    /** GC InfoBase plans */
    INFOBASE: 'https://www.infobasegc.ca/departmental-plans',
  },

  /** open.canada.ca CKAN */
  CKAN: {
    /** CKAN API base */
    BASE: 'https://open.canada.ca/data',
    /** Package search API */
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    /** Package show API */
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    /** Resource show API */
    RESOURCE_SHOW: 'https://open.canada.ca/data/api/3/action/resource_show',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Known CKAN Package IDs                                             */
/* ------------------------------------------------------------------ */

/**
 * Known CKAN package IDs on open.canada.ca for federal budget/fiscal data.
 *
 * These datasets contain:
 *   - Federal budget documents (HTML/PDF)
 *   - Public Accounts CSV data
 *   - Fiscal Monitor reports
 *   - Departmental plans and results
 */
export const BUDGET_CKAN_PACKAGE_IDS = {
  /** Federal Budget 2023 */
  BUDGET_2023: 'b29d0131-33ac-4499-9fe9-598ccf103217',
  /** Federal Budget 2024 */
  BUDGET_2024: '94ca1f06-d184-4e80-81fe-9c5a5645c11c',
  /** Federal Budget 2025 */
  BUDGET_2025: '74d8b323-6bd8-4fc0-a971-8fbbed2350cf',
  /** Public Accounts of Canada (single CKAN dataset) */
  PUBLIC_ACCOUNTS: '350b4f13-d84a-4e94-b221-1109dc00ab39',
  /** Fiscal Reference Tables (closest CKAN entry — 2010 tables; current FRT published on fin.gc.ca) */
  FISCAL_REFERENCE_TABLES: '6a962654-72c6-4130-ba48-83e65042d66f',
  /** Fiscal Monitor data tables */
  FISCAL_MONITOR_DATA: '7680320b-c837-4b67-b73f-9361c4a9716d',
  /** GC InfoBase — Departmental Plans and Results Reports */
  DEPARTMENTAL_PLANS: 'b15ee8d7-2ac0-4656-8330-6c60d085cda8',
  /** Departmental Results Reports (2017-18) */
  DEPARTMENTAL_RESULTS: '5cbebf5f-ea26-4e43-a764-72e6a668935b',
} as const;

export type BudgetCkanPackageId = keyof typeof BUDGET_CKAN_PACKAGE_IDS;

/* ------------------------------------------------------------------ */
/*  Federal Government Departments (for departmental plans / results)  */
/* ------------------------------------------------------------------ */

/**
 * Major federal government departments and agencies.
 * These are the organizations that publish Departmental Plans and
 * Departmental Results Reports.
 */
export const FEDERAL_DEPARTMENTS: Array<{
  name: string;
  acronym: string;
  portfolio: string;
}> = [
  { name: 'Agriculture and Agri-Food Canada', acronym: 'AAFC', portfolio: 'Agriculture' },
  { name: 'Atlantic Canada Opportunities Agency', acronym: 'ACOA', portfolio: 'Regional Development' },
  { name: 'Canada Border Services Agency', acronym: 'CBSA', portfolio: 'Public Safety' },
  { name: 'Canada Economic Development for Quebec Regions', acronym: 'CED', portfolio: 'Regional Development' },
  { name: 'Canada Revenue Agency', acronym: 'CRA', portfolio: 'Revenue' },
  { name: 'Canadian Food Inspection Agency', acronym: 'CFIA', portfolio: 'Agriculture' },
  { name: 'Canadian Heritage', acronym: 'PCH', portfolio: 'Heritage' },
  { name: 'Canadian Nuclear Safety Commission', acronym: 'CNSC', portfolio: 'Natural Resources' },
  { name: 'Canadian Radio-television and Telecommunications Commission', acronym: 'CRTC', portfolio: 'Heritage' },
  { name: 'Canadian Space Agency', acronym: 'CSA', portfolio: 'Innovation' },
  { name: 'Correctional Service Canada', acronym: 'CSC', portfolio: 'Public Safety' },
  { name: 'Crown-Indigenous Relations and Northern Affairs Canada', acronym: 'CIRNAC', portfolio: 'Indigenous' },
  { name: 'Department of Finance Canada', acronym: 'FIN', portfolio: 'Finance' },
  { name: 'Department of Justice Canada', acronym: 'JUS', portfolio: 'Justice' },
  { name: 'Department of National Defence', acronym: 'DND', portfolio: 'Defence' },
  { name: 'Employment and Social Development Canada', acronym: 'ESDC', portfolio: 'Social Development' },
  { name: 'Environment and Climate Change Canada', acronym: 'ECCC', portfolio: 'Environment' },
  { name: 'Federal Economic Development Agency for Southern Ontario', acronym: 'FedDev Ontario', portfolio: 'Regional Development' },
  { name: 'Fisheries and Oceans Canada', acronym: 'DFO', portfolio: 'Fisheries' },
  { name: 'Global Affairs Canada', acronym: 'GAC', portfolio: 'Foreign Affairs' },
  { name: 'Health Canada', acronym: 'HC', portfolio: 'Health' },
  { name: 'Immigration, Refugees and Citizenship Canada', acronym: 'IRCC', portfolio: 'Immigration' },
  { name: 'Indigenous Services Canada', acronym: 'ISC', portfolio: 'Indigenous' },
  { name: 'Innovation, Science and Economic Development Canada', acronym: 'ISED', portfolio: 'Innovation' },
  { name: 'Library and Archives Canada', acronym: 'LAC', portfolio: 'Heritage' },
  { name: 'National Research Council Canada', acronym: 'NRC', portfolio: 'Innovation' },
  { name: 'Natural Resources Canada', acronym: 'NRCan', portfolio: 'Natural Resources' },
  { name: 'Office of the Auditor General of Canada', acronym: 'OAG', portfolio: 'Oversight' },
  { name: 'Office of the Parliamentary Budget Officer', acronym: 'PBO', portfolio: 'Oversight' },
  { name: 'Parole Board of Canada', acronym: 'PBC', portfolio: 'Public Safety' },
  { name: 'Parks Canada', acronym: 'PC', portfolio: 'Environment' },
  { name: 'Privy Council Office', acronym: 'PCO', portfolio: 'Central Agency' },
  { name: 'Public Health Agency of Canada', acronym: 'PHAC', portfolio: 'Health' },
  { name: 'Public Safety Canada', acronym: 'PS', portfolio: 'Public Safety' },
  { name: 'Public Services and Procurement Canada', acronym: 'PSPC', portfolio: 'Government Operations' },
  { name: 'Royal Canadian Mounted Police', acronym: 'RCMP', portfolio: 'Public Safety' },
  { name: 'Shared Services Canada', acronym: 'SSC', portfolio: 'Government Operations' },
  { name: 'Statistics Canada', acronym: 'StatCan', portfolio: 'Innovation' },
  { name: 'Transport Canada', acronym: 'TC', portfolio: 'Transport' },
  { name: 'Treasury Board of Canada Secretariat', acronym: 'TBS', portfolio: 'Central Agency' },
  { name: 'Veterans Affairs Canada', acronym: 'VAC', portfolio: 'Veterans' },
  { name: 'Women and Gender Equality Canada', acronym: 'WAGE', portfolio: 'Social Development' },
];

/** Map of department acronym to full name */
export const DEPARTMENT_ACRONYM_MAP: Record<string, string> = {};
for (const dept of FEDERAL_DEPARTMENTS) {
  DEPARTMENT_ACRONYM_MAP[dept.acronym] = dept.name;
}

/** Map of department name to acronym */
export const DEPARTMENT_NAME_MAP: Record<string, string> = {};
for (const dept of FEDERAL_DEPARTMENTS) {
  DEPARTMENT_NAME_MAP[dept.name] = dept.acronym;
}

/* ------------------------------------------------------------------ */
/*  Budget Record Types                                                */
/* ------------------------------------------------------------------ */

/** All valid budget record types */
export const ALL_BUDGET_RECORD_TYPES: BudgetRecordType[] = [
  'budget',
  'public_accounts',
  'fiscal_monitor',
  'departmental_plan',
  'fiscal_projections',
  'supplementary_estimates',
  'main_estimates',
  'other',
];

/** Human-readable labels for budget record types */
export const BUDGET_RECORD_TYPE_LABELS: Record<BudgetRecordType, string> = {
  'budget': 'Federal Budget',
  'public_accounts': 'Public Accounts',
  'fiscal_monitor': 'Fiscal Monitor',
  'departmental_plan': 'Departmental Plan / Results Report',
  'fiscal_projections': 'Fiscal & Economic Projections',
  'supplementary_estimates': 'Supplementary Estimates',
  'main_estimates': 'Main Estimates',
  'other': 'Other',
};

/* ------------------------------------------------------------------ */
/*  Spending Categories                                                */
/* ------------------------------------------------------------------ */

/** All valid budget categories */
export const ALL_BUDGET_CATEGORIES: BudgetCategory[] = [
  'revenue',
  'expense',
  'debt-service',
  'transfer',
  'capital',
  'operating',
  'defense',
  'healthcare',
  'social',
  'education',
  'infrastructure',
  'indigenous',
  'climate',
  'innovation',
  'immigration',
  'public-safety',
  'culture',
  'pension',
  'other-revenue',
  'other-expense',
  'total',
  'deficit',
  'debt',
  'gdp',
  'unallocated',
];

/** Human-readable labels for budget categories */
export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  'revenue': 'Government Revenue',
  'expense': 'Program Expenses',
  'debt-service': 'Public Debt Charges',
  'transfer': 'Transfer Payments',
  'capital': 'Capital Spending',
  'operating': 'Operating Expenses',
  'defense': 'National Defence',
  'healthcare': 'Health Care',
  'social': 'Social Spending',
  'education': 'Education & Training',
  'infrastructure': 'Infrastructure',
  'indigenous': 'Indigenous Programs',
  'climate': 'Climate & Environment',
  'innovation': 'Innovation & Economic Development',
  'immigration': 'Immigration & Settlement',
  'public-safety': 'Public Safety',
  'culture': 'Heritage, Arts & Culture',
  'pension': 'Pension Obligations',
  'other-revenue': 'Other Revenue',
  'other-expense': 'Other Expenses',
  'total': 'Total',
  'deficit': 'Budgetary Balance (Deficit/Surplus)',
  'debt': 'Federal Debt (Accumulated Deficit)',
  'gdp': 'Gross Domestic Product',
  'unallocated': 'Uncategorized / Contingency',
};

/* ------------------------------------------------------------------ */
/*  Common Fiscal Year Ranges                                          */
/* ------------------------------------------------------------------ */

/** Recent fiscal years for budget data (fed fiscal year runs Apr 1 - Mar 31) */
export const RECENT_FISCAL_YEARS = [
  '2019-20',
  '2020-21',
  '2021-22',
  '2022-23',
  '2023-24',
  '2024-25',
  '2025-26',
  '2026-27',
];

/** Fiscal years for which budget documents are typically available */
export const AVAILABLE_BUDGET_YEARS = ['2021', '2022', '2023', '2024', '2025'];

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

/** Default max records to process */
export const DEFAULT_MAX_RECORDS = 1000;

/** Default User-Agent for HTTP requests */
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default request headers */
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/json,text/csv,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Types                                                        */
/* ------------------------------------------------------------------ */

export class BudgetError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BUDGET_ERROR',
    public readonly recordType?: BudgetRecordType,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'BudgetError';
  }
}
