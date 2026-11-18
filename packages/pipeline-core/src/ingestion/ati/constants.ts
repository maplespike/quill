// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ATI (Access to Information) Constants — Quill
 *
 * Source URLs, department lists, CKAN search configurations, and
 * default options for tracking completed ATI requests published
 * by Canadian federal departments and institutions.
 *
 * Primary source:
 *   https://open.canada.ca/en/ati — Government of Canada's ATI portal
 *   (CKAN-based open data platform)
 *
 * Individual departments also publish ATI summaries on their websites.
 * The CKAN aggregator is the most comprehensive single source.
 *
 * CKAN API for ATI:
 *   Search:  https://open.canada.ca/data/api/3/action/package_search
 *   Package: https://open.canada.ca/data/api/3/action/package_show
 *
 * Search for ATI packages using: q=ati+OR+"access+to+information"+OR+"completed+access"
 * Filter by organization (department) to narrow results.
 */

import type { AtiDisposition } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const ATI_SOURCES = {
  /** open.canada.ca ATI portal */
  OPEN_CANADA_ATI: {
    BASE: 'https://open.canada.ca/en/ati',
    PORTAL: 'https://open.canada.ca/en/ati',
  },

  /** CKAN API on open.canada.ca */
  CKAN: {
    BASE: 'https://open.canada.ca/data',
    API_BASE: 'https://open.canada.ca/data/api/3/action',
    PACKAGE_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    RESOURCE_SHOW: 'https://open.canada.ca/data/api/3/action/resource_show',
  },

  /** Default search query for ATI packages on CKAN */
  ATI_CKAN_QUERY: '(ati OR "access to information" OR "completed access") AND (complet OR summary OR 202)',

  /** Individual department ATI pages (supplementary) */
  DEPARTMENT_ATI: {
    PSPC: 'https://www.tpsgc-pwgsc.gc.ca/ati-aiprp/index-eng.html',
    HC: 'https://www.canada.ca/en/health-canada/access-information.html',
    DND: 'https://www.canada.ca/en/department-national-defence/access-information.html',
    IRCC: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/access-information.html',
    ESDC: 'https://www.canada.ca/en/employment-social-development/access-information.html',
    GAC: 'https://www.international.gc.ca/gac-amc/access-information-access-information.aspx',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Tracked Federal Departments & Institutions                         */
/* ------------------------------------------------------------------ */

/**
 * Federal departments and institutions that publish ATI completion data.
 * These are the organizations that receive and process ATI requests.
 *
 * The list covers major federal departments. CKAN organization names
 * are used for filtering searches.
 */
export const ATI_DEPARTMENTS: Array<{
  name: string;
  acronym: string;
  ckanOrgName: string;
  portfolio: string;
}> = [
  { name: 'Agriculture and Agri-Food Canada', acronym: 'AAFC', ckanOrgName: 'agriculture-and-agri-food-canada', portfolio: 'Agriculture' },
  { name: 'Canada Border Services Agency', acronym: 'CBSA', ckanOrgName: 'canada-border-services-agency', portfolio: 'Public Safety' },
  { name: 'Canada Revenue Agency', acronym: 'CRA', ckanOrgName: 'canada-revenue-agency', portfolio: 'Revenue' },
  { name: 'Canadian Heritage', acronym: 'PCH', ckanOrgName: 'canadian-heritage', portfolio: 'Heritage' },
  { name: 'Canadian Radio-television and Telecommunications Commission', acronym: 'CRTC', ckanOrgName: 'crtc', portfolio: 'Heritage' },
  { name: 'Department of Finance Canada', acronym: 'FIN', ckanOrgName: 'department-of-finance-canada', portfolio: 'Finance' },
  { name: 'Department of Justice Canada', acronym: 'JUS', ckanOrgName: 'department-of-justice-canada', portfolio: 'Justice' },
  { name: 'Department of National Defence', acronym: 'DND', ckanOrgName: 'department-of-national-defence', portfolio: 'Defence' },
  { name: 'Employment and Social Development Canada', acronym: 'ESDC', ckanOrgName: 'employment-and-social-development-canada', portfolio: 'Social Development' },
  { name: 'Environment and Climate Change Canada', acronym: 'ECCC', ckanOrgName: 'environment-and-climate-change-canada', portfolio: 'Environment' },
  { name: 'Fisheries and Oceans Canada', acronym: 'DFO', ckanOrgName: 'fisheries-and-oceans-canada', portfolio: 'Fisheries' },
  { name: 'Global Affairs Canada', acronym: 'GAC', ckanOrgName: 'global-affairs-canada', portfolio: 'Foreign Affairs' },
  { name: 'Health Canada', acronym: 'HC', ckanOrgName: 'health-canada', portfolio: 'Health' },
  { name: 'Immigration, Refugees and Citizenship Canada', acronym: 'IRCC', ckanOrgName: 'immigration-refugees-and-citizenship-canada', portfolio: 'Immigration' },
  { name: 'Indigenous Services Canada', acronym: 'ISC', ckanOrgName: 'indigenous-services-canada', portfolio: 'Indigenous' },
  { name: 'Innovation, Science and Economic Development Canada', acronym: 'ISED', ckanOrgName: 'innovation-science-and-economic-development-canada', portfolio: 'Innovation' },
  { name: 'Library and Archives Canada', acronym: 'LAC', ckanOrgName: 'library-and-archives-canada', portfolio: 'Heritage' },
  { name: 'National Defence', acronym: 'DND', ckanOrgName: 'national-defence', portfolio: 'Defence' },
  { name: 'Natural Resources Canada', acronym: 'NRCan', ckanOrgName: 'natural-resources-canada', portfolio: 'Natural Resources' },
  { name: 'Privy Council Office', acronym: 'PCO', ckanOrgName: 'privy-council-office', portfolio: 'Central Agency' },
  { name: 'Public Health Agency of Canada', acronym: 'PHAC', ckanOrgName: 'public-health-agency-of-canada', portfolio: 'Health' },
  { name: 'Public Safety Canada', acronym: 'PS', ckanOrgName: 'public-safety-canada', portfolio: 'Public Safety' },
  { name: 'Public Services and Procurement Canada', acronym: 'PSPC', ckanOrgName: 'public-services-and-procurement-canada', portfolio: 'Government Operations' },
  { name: 'Royal Canadian Mounted Police', acronym: 'RCMP', ckanOrgName: 'royal-canadian-mounted-police', portfolio: 'Public Safety' },
  { name: 'Shared Services Canada', acronym: 'SSC', ckanOrgName: 'shared-services-canada', portfolio: 'Government Operations' },
  { name: 'Statistics Canada', acronym: 'StatCan', ckanOrgName: 'statistics-canada', portfolio: 'Innovation' },
  { name: 'Transport Canada', acronym: 'TC', ckanOrgName: 'transport-canada', portfolio: 'Transport' },
  { name: 'Treasury Board of Canada Secretariat', acronym: 'TBS', ckanOrgName: 'treasury-board-of-canada-secretariat', portfolio: 'Central Agency' },
  { name: 'Veterans Affairs Canada', acronym: 'VAC', ckanOrgName: 'veterans-affairs-canada', portfolio: 'Veterans' },
];

/** Map department acronym to full name */
export const ATI_DEPARTMENT_ACRONYM_MAP: Record<string, string> = {};
for (const dept of ATI_DEPARTMENTS) {
  ATI_DEPARTMENT_ACRONYM_MAP[dept.acronym] = dept.name;
}

/** Map CKAN org name to department info */
export const ATI_CKAN_ORG_MAP: Record<string, { name: string; acronym: string }> = {};
for (const dept of ATI_DEPARTMENTS) {
  ATI_CKAN_ORG_MAP[dept.ckanOrgName] = { name: dept.name, acronym: dept.acronym };
}

/* ------------------------------------------------------------------ */
/*  Known CKAN Package IDs for ATI Data                                */
/* ------------------------------------------------------------------ */

/**
 * Known CKAN package IDs on open.canada.ca that contain ATI completion data.
 *
 * These were discovered by searching open.canada.ca for:
 *   - "Access to Information" completions
 *   - "ATI" summaries
 *   - Department-specific ATI packages
 *
 * This is a growing list — new packages should be added as discovered.
 */
export const ATI_CKAN_PACKAGE_IDS: Record<string, string> = {
  /** GC ATI completions — comprehensive multi-department dataset */
  GC_ATI_COMPLETIONS: '0797e893-751e-4695-8229-a5066e4fe43c',
  /** TBS ATI completion statistics */
  TBS_ATI_STATS: '236294e1-bc74-486f-ab97-422227bc8832',
};

/* ------------------------------------------------------------------ */
/*  Disposition Mappings                                               */
/* ------------------------------------------------------------------ */

/**
 * Maps raw disposition text from CKAN/department sources to
 * the normalized AtiDisposition enum.
 */
export const ATI_DISPOSITION_MAP: Record<string, AtiDisposition> = {
  'disclosed': 'disclosed',
  'disclosed in part': 'disclosed-part',
  'partially disclosed': 'disclosed-part',
  'all disclosed': 'disclosed',
  'exempted': 'exempted',
  'exempted in part': 'disclosed-part',
  'exempted (partially)': 'disclosed-part',
  'excluded': 'excluded',
  'no records': 'no-records',
  'no records exist': 'no-records',
  'transferred': 'transferred',
  'abandoned': 'abandoned',
  'pending': 'pending',
  'request abandoned': 'abandoned',
  'request transferred': 'transferred',
};

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

/** Default max records to process per department */
export const DEFAULT_MAX_RECORDS = 1000;

/** Default User-Agent for HTTP requests */
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default request headers */
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/csv,text/html,*/*',
};

/** Recent fiscal years for ATI completions (fed fiscal year runs Apr 1 - Mar 31) */
export const RECENT_FISCAL_YEARS = [
  '2019-20',
  '2020-21',
  '2021-22',
  '2022-23',
  '2023-24',
  '2024-25',
  '2025-26',
];

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class AtiError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ATI_ERROR',
    public readonly department?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AtiError';
  }
}
