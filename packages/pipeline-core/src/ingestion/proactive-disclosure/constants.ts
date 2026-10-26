/**
 * Proactive Disclosure Constants — Quill
 *
 * CKAN search URLs, department metadata, and configuration for
 * federal proactive disclosure data sources.
 *
 * Sources:
 *   - open.canada.ca CKAN aggregate Solr search
 *   - Individual department CKAN packages (via open.canada.ca/data)
 *   - Each department publishes proactive disclosure datasets
 *     that vary in schema — we normalize them in the parser.
 */

import type { DepartmentInfo } from './types.js';

/* ------------------------------------------------------------------ */
/*  CKAN Aggregate Search                                              */
/* ------------------------------------------------------------------ */

/**
 * Base URL for the open.canada.ca CKAN Solr-powered search API.
 * This is the primary way to discover proactive disclosure datasets
 * across all federal departments.
 *
 * Parameters:
 *   q  - Query string (e.g. "proactive disclosure contracts")
 *   fq - Filter query (e.g. "owner_org:gc" for Government of Canada)
 *   rows - Results per page
 *   start - Page offset for pagination
 *   wt  - Response format (json, xml)
 *   sort - Sort field and direction
 */
export const CKAN_SOLR_SEARCH_URL = 'https://search.open.canada.ca/api/select';

/**
 * Base URL for the CKAN API on open.canada.ca/data.
 * Used for package_show and resource_show endpoints to get
 * detailed metadata about specific datasets.
 */
export const CKAN_API_BASE = 'https://open.canada.ca/data/api/3/action';

/**
 * Default search query for proactive disclosure contracts.
 * Broad enough to capture most department datasets.
 */
export const DEFAULT_SEARCH_QUERY = 'proactive disclosure contracts';

/**
 * Default number of results per page (CKAN Solr max is typically 500).
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Maximum allowed page size for the CKAN Solr API.
 */
export const MAX_PAGE_SIZE = 500;

/**
 * Default headers for CKAN API requests.
 */
export const CKAN_HEADERS: Record<string, string> = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Department Metadata                                                */
/* ------------------------------------------------------------------ */

/**
 * Major Canadian federal departments and agencies that publish proactive
 * disclosure data. Start with the 20 most significant departments for
 * government accountability journalism.
 *
 * Each entry includes:
 *   - Full English/French name
 *   - Standard acronym
 *   - CKAN owner_org value (from the government of Canada CKAN instance)
 */
export const MAJOR_DEPARTMENTS: DepartmentInfo[] = [
  { nameEn: 'Public Services and Procurement Canada', nameFr: 'Services publics et Approvisionnement Canada', acronym: 'PSPC', ownerOrg: 'pspc-spac' },
  { nameEn: 'National Defence', nameFr: 'Défense nationale', acronym: 'DND', ownerOrg: 'dnd-mdn' },
  { nameEn: 'Health Canada', nameFr: 'Santé Canada', acronym: 'HC', ownerOrg: 'hc-sc' },
  { nameEn: 'Environment and Climate Change Canada', nameFr: 'Environnement et Changement climatique Canada', acronym: 'ECCC', ownerOrg: 'ec' },
  { nameEn: 'Department of Finance Canada', nameFr: 'Ministère des Finances Canada', acronym: 'FIN', ownerOrg: 'fin' },
  { nameEn: 'Innovation, Science and Economic Development Canada', nameFr: 'Innovation, Sciences et Développement économique Canada', acronym: 'ISED', ownerOrg: 'ised-isde' },
  { nameEn: 'Global Affairs Canada', nameFr: 'Affaires mondiales Canada', acronym: 'GAC', ownerOrg: 'gac-amc' },
  { nameEn: 'Department of Justice Canada', nameFr: 'Ministère de la Justice Canada', acronym: 'JUS', ownerOrg: 'jus' },
  { nameEn: 'Employment and Social Development Canada', nameFr: 'Emploi et Développement social Canada', acronym: 'ESDC', ownerOrg: 'esdc-edsc' },
  { nameEn: 'Royal Canadian Mounted Police', nameFr: 'Gendarmerie royale du Canada', acronym: 'RCMP', ownerOrg: 'rcmp-grc' },
  { nameEn: 'Canada Revenue Agency', nameFr: "Agence du revenu du Canada", acronym: 'CRA', ownerOrg: 'cra-arc' },
  { nameEn: 'Immigration, Refugees and Citizenship Canada', nameFr: 'Immigration, Réfugiés et Citoyenneté Canada', acronym: 'IRCC', ownerOrg: 'ircc' },
  { nameEn: 'Transport Canada', nameFr: 'Transports Canada', acronym: 'TC', ownerOrg: 'tc' },
  { nameEn: 'Natural Resources Canada', nameFr: 'Ressources naturelles Canada', acronym: 'NRCan', ownerOrg: 'nrcan-rncan' },
  { nameEn: 'Agriculture and Agri-Food Canada', nameFr: 'Agriculture et Agroalimentaire Canada', acronym: 'AAFC', ownerOrg: 'aafc-aac' },
  { nameEn: 'Fisheries and Oceans Canada', nameFr: 'Pêches et Océans Canada', acronym: 'DFO', ownerOrg: 'dfo-mpo' },
  { nameEn: 'Canadian Heritage', nameFr: 'Patrimoine canadien', acronym: 'PCH', ownerOrg: 'pch' },
  { nameEn: 'Indigenous Services Canada', nameFr: 'Services aux Autochtones Canada', acronym: 'ISC', ownerOrg: 'isc-sac' },
  { nameEn: 'Crown-Indigenous Relations and Northern Affairs Canada', nameFr: 'Relations Couronne-Autochtones et Affaires du Nord Canada', acronym: 'CIRNAC', ownerOrg: 'crown-indigenous' },
  { nameEn: 'Public Safety Canada', nameFr: 'Sécurité publique Canada', acronym: 'PS', ownerOrg: 'ps-sp' },
];

/**
 * Map of department acronyms to their owner_org values for CKAN filtering.
 */
export const DEPARTMENT_ACRONYM_MAP: Record<string, string> = {};
for (const dept of MAJOR_DEPARTMENTS) {
  DEPARTMENT_ACRONYM_MAP[dept.acronym] = dept.ownerOrg ?? dept.acronym.toLowerCase();
}

/**
 * Map of owner_org values to department acronyms (reverse lookup).
 */
export const OWNER_ORG_ACRONYM_MAP: Record<string, string> = {};
for (const dept of MAJOR_DEPARTMENTS) {
  if (dept.ownerOrg) {
    OWNER_ORG_ACRONYM_MAP[dept.ownerOrg] = dept.acronym;
  }
}

/* ------------------------------------------------------------------ */
/*  Known CKAN Package Patterns                                        */
/* ------------------------------------------------------------------ */

/**
 * Known CKAN package ID prefixes and patterns for proactive disclosure
 * datasets. These help identify which datasets are proactive disclosure
 * vs other types of government data.
 *
 * Proactive disclosure datasets on open.canada.ca typically have
 * titles like:
 *   "Proactive Disclosure - Contracts - {Department Name}"
 *   "Proactive Disclosure - Travel Expenses - {Department Name}"
 *   "Proactive Disclosure - Hospitality Expenses - {Department Name}"
 *   "Proactive Disclosure - Reclassification - {Department Name}"
 */
export const PROACTIVE_DISCLOSURE_TYPE_KEYWORDS = [
  'proactive disclosure',
  'contracts',
  'travel expenses',
  'hospitality expenses',
  'reclassification',
];

/**
 * Search query filter for proactive disclosure on CKAN.
 * Narrow matches using SOLR fq parameter for better precision.
 */
export const PROACTIVE_DISCLOSURE_FQ = [
  'owner_org:gc',
  'proactive_disclosure:true',
];

/* ------------------------------------------------------------------ */
/*  Date Formats                                                       */
/* ------------------------------------------------------------------ */

/**
 * Known date formats used across department proactive disclosure datasets.
 * Used by the parser to normalize dates to ISO-8601.
 */
export const DATE_FORMAT_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,               // ISO-8601
  /^\d{4}\/\d{2}\/\d{2}/,             // YYYY/MM/DD
  /^\d{2}\/\d{2}\/\d{4}/,             // MM/DD/YYYY
  /^[A-Z][a-z]+ \d{1,2},? \d{4}/,    // Month Day, Year
  /^\d{2}-[A-Z][a-z]{2}-\d{4}/,       // DD-Mon-YYYY
];

/* ------------------------------------------------------------------ */
/*  Value Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Regular expression to detect and extract currency amounts.
 * Matches: $1,234,567.89, 1234567.89, 1,234,567, etc.
 */
export const CURRENCY_VALUE_PATTERN = /^\$?\s*([0-9,]+(?:\.[0-9]+)?)/;

/* ------------------------------------------------------------------ */
/*  Error Types                                                        */
/* ------------------------------------------------------------------ */

export class PDError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PD_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PDError';
  }
}
