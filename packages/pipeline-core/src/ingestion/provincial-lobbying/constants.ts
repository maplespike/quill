/**
 * Provincial Lobbying Constants — Frostbite Data Pipeline
 *
 * Known URLs and configuration for provincial lobbying registries
 * across Canadian provinces.
 *
 * The Ontario Lobbyists Registry is operated by the Integrity Commissioner
 * of Ontario (OICO) and is the primary target for this module.
 * Other provinces will be added as implementation progresses.
 *
 * Primary source: Ontario Lobbyists Registry
 *   https://lobbyist.oico.on.ca/lobbyistregistry/
 *
 * Secondary source: Ontario Data Catalogue (CKAN)
 *   https://data.ontario.ca
 *   Search for "lobbyists" datasets on data.ontario.ca
 */


export const ONTARIO_LOBBYING = {
  /** Ontario Lobbyists Registry — base URL */
  BASE: 'https://lobbyist.oico.on.ca/lobbyistregistry/',

  /** Search page for active registrations */
  SEARCH: 'https://lobbyist.oico.on.ca/lobbyistregistry/search',

  /** Search API endpoint (if available) */
  SEARCH_API: 'https://lobbyist.oico.on.ca/lobbyistregistry/api/search',

  /** Monthly communication reports page */
  MONTHLY_REPORTS: 'https://lobbyist.oico.on.ca/lobbyistregistry/monthly-reports',

  /** Registration detail page template (replace {id}) */
  REGISTRATION_DETAIL: 'https://lobbyist.oico.on.ca/lobbyistregistry/registration/',

  /** CSV export endpoint (if available) */
  CSV_EXPORT: 'https://lobbyist.oico.on.ca/lobbyistregistry/export/csv',

  /** Annual report of lobbying activities */
  ANNUAL_REPORT: 'https://lobbyist.oico.on.ca/lobbyistregistry/annual-reports',

  /** Lobbyists Registration Act page */
  ABOUT: 'https://lobbyist.oico.on.ca/lobbyistregistry/about',

  /** Commissioner information */
  COMMISSIONER_PAGE: 'https://lobbyist.oico.on.ca/lobbyistregistry/commissioner',
} as const;


export const ONTARIO_CKAN = {
  /** Ontario Data Catalogue base URL */
  BASE: 'https://data.ontario.ca',

  /** CKAN API base */
  API_BASE: 'https://data.ontario.ca/api/3/action',

  /** Package search */
  PACKAGE_SEARCH: 'https://data.ontario.ca/api/3/action/package_search',

  /** Package show (by ID) */
  PACKAGE_SHOW: 'https://data.ontario.ca/api/3/action/package_show',

  /** Dataset search portal */
  DATASET_PORTAL: 'https://data.ontario.ca/dataset',

  /** Search for lobbying-related datasets */
  LOBBYING_CKAN_QUERY: 'lobbyists',

  /** Known CKAN package IDs for Ontario lobbying data (to be discovered) */
  KNOWN_PACKAGE_IDS: [] as string[],
} as const;


export const BC_LOBBYING = {
  /** Lobbyists Registry BC */
  BASE: 'https://lobbyists.bc.ca/',
  SEARCH: 'https://lobbyists.bc.ca/search',
  CSV_EXPORT: 'https://lobbyists.bc.ca/export',
} as const;

export const ALBERTA_LOBBYING = {
  /** Alberta Lobbyist Registry (Office of the Ethics Commissioner) */
  BASE: 'https://www.albertalobbyistregistry.ca/',
  SEARCH: 'https://www.albertalobbyistregistry.ca/apex/f?p=171:SEARCH',
} as const;

export const QUEBEC_LOBBYING = {
  /** Registre des lobbyistes du Quebec */
  BASE: 'https://www.lobbyists.quebec/',
  SEARCH: 'https://www.lobbyists.quebec/recherche',
  /** Quebec publishes open data via their own portal */
  OPEN_DATA: 'https://www.donneesquebec.ca/recherche/',
} as const;


/**
 * Ontario lobbying subject categories as defined by the
 * Integrity Commissioner of Ontario's registry taxonomy.
 */
export const ONTARIO_LOBBYING_SUBJECTS = [
  'Agriculture and Food',
  'Arts and Culture',
  'Budget and Fiscal Policy',
  'Children and Youth Services',
  'Citizenship and Immigration',
  'Colleges and Universities',
  'Consumer Protection',
  'COVID-19 Response',
  'Economic Development',
  'Education',
  'Energy',
  'Environment',
  'Finance',
  'Government Procurement',
  'Health',
  'Housing',
  'Indigenous Relations',
  'Infrastructure',
  'Justice and Public Safety',
  'Labour and Employment',
  'Municipal Affairs',
  'Natural Resources',
  'Privacy and Data Protection',
  'Research and Innovation',
  'Seniors and Accessibility',
  'Small Business',
  'Sports and Recreation',
  'Taxation',
  'Telecommunications',
  'Tourism',
  'Transportation',
] as const;


export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_USER_AGENT = 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';
