/**
 * UN Data Constants — Quill
 *
 * SDMX REST API URLs, database code mappings, and helper functions
 * for the UNdata statistical databases.
 *
 * API Docs: http://data.un.org/Host.aspx?Content=API
 * Terms: Consult UNdata and agency-specific terms; do not infer permission from API access.
 */

import type { UnDataCategory } from './types.js';

/* ------------------------------------------------------------------ */
/* API Configuration */
/* ------------------------------------------------------------------ */

export const UN_API_BASE = 'http://data.un.org/ws/rest';

export const UN_DEFAULT_TIMEOUT_MS = 60_000;

/** SDMX REST format — JSON preferred for ease of parsing. */
export const UN_FORMAT_JSON = 'format=json';

/* ------------------------------------------------------------------ */
/* Top UN Databases by Category */
/* ------------------------------------------------------------------ */

/**
 * Curated list of the most-used UN databases accessible via SDMX REST.
 * These cover all major statistical domains and are the most commonly
 * referenced in research and policy analysis.
 *
 * Database codes come from the UNdata dataflow registry.
 * See: http://data.un.org/ws/rest/dataflow/
 */
export const UN_DATABASES = {
  // ── Population & Demographics ──
  /** World Population Prospects */
  POP: 'UNSD/DF_POP',
  /** Population and Vital Statistics */
  POP_VITAL: 'UNSD/DF_POP_VITAL',

  // ── Trade ──
  /** UN Comtrade International Trade */
  TRADE: 'UNSD/DF_TRADE',
  /** Trade in Services */
  TRADE_SERVICES: 'UNSD/DF_TRADE_SERVICES',
  /** UNCTAD FDI Statistics */
  UNCTAD_FDI: 'UNCTAD/DF_FDI',

  // ── Development & Economy ──
  /** National Accounts Main Aggregates */
  NATIONAL_ACCOUNTS: 'UNSD/DF_NAMAIN',
  /** Development Indicators */
  DEVELOPMENT: 'UNSD/DF_DEVIND',

  // ── Environment & Energy ──
  /** Environment Statistics */
  ENVIRONMENT: 'UNSD/DF_ENV',
  /** Energy Statistics */
  ENERGY: 'UNSD/DF_ENERGY',

  // ── Education ──
  /** Education Statistics (UIS) */
  EDUCATION: 'UNSD/DF_EDULIT',

  // ── Health ──
  /** Health Statistics (WHO/UN) */
  HEALTH: 'UNSD/DF_HEALTH',
} as const;

/** Type for UN database keys */
export type UnDatabaseKey = keyof typeof UN_DATABASES;

/** Database key-to-category mapping */
export const UN_DATABASE_CATEGORIES: Record<string, UnDataCategory> = {
  [UN_DATABASES.POP]: 'population',
  [UN_DATABASES.POP_VITAL]: 'population',
  [UN_DATABASES.TRADE]: 'trade',
  [UN_DATABASES.TRADE_SERVICES]: 'trade',
  [UN_DATABASES.UNCTAD_FDI]: 'trade',
  [UN_DATABASES.NATIONAL_ACCOUNTS]: 'finance',
  [UN_DATABASES.DEVELOPMENT]: 'development',
  [UN_DATABASES.ENVIRONMENT]: 'environment',
  [UN_DATABASES.ENERGY]: 'energy',
  [UN_DATABASES.EDUCATION]: 'education',
  [UN_DATABASES.HEALTH]: 'health',
};

/** Human-readable names for database codes */
export const UN_DATABASE_NAMES: Record<string, string> = {
  [UN_DATABASES.POP]: 'World Population Prospects',
  [UN_DATABASES.POP_VITAL]: 'Population and Vital Statistics',
  [UN_DATABASES.TRADE]: 'International Trade (Comtrade)',
  [UN_DATABASES.TRADE_SERVICES]: 'Trade in Services',
  [UN_DATABASES.UNCTAD_FDI]: 'UNCTAD FDI Statistics',
  [UN_DATABASES.NATIONAL_ACCOUNTS]: 'National Accounts Main Aggregates',
  [UN_DATABASES.DEVELOPMENT]: 'Development Indicators',
  [UN_DATABASES.ENVIRONMENT]: 'Environment Statistics',
  [UN_DATABASES.ENERGY]: 'Energy Statistics',
  [UN_DATABASES.EDUCATION]: 'Education Statistics (UIS)',
  [UN_DATABASES.HEALTH]: 'Health Statistics (WHO/UN)',
};

/** Grouped database codes by category for batch fetching */
export const UN_DATABASES_BY_CATEGORY: Record<UnDataCategory, string[]> = {
  population: [UN_DATABASES.POP, UN_DATABASES.POP_VITAL],
  trade: [UN_DATABASES.TRADE, UN_DATABASES.TRADE_SERVICES, UN_DATABASES.UNCTAD_FDI],
  development: [UN_DATABASES.DEVELOPMENT],
  environment: [UN_DATABASES.ENVIRONMENT],
  health: [UN_DATABASES.HEALTH],
  education: [UN_DATABASES.EDUCATION],
  labour: [],
  energy: [UN_DATABASES.ENERGY],
  crime: [],
  gender: [],
  tourism: [],
  finance: [UN_DATABASES.NATIONAL_ACCOUNTS],
};

/** All 10 top database codes as an array */
export const UN_TOP_DATABASES: string[] = Object.values(UN_DATABASES);

/* ------------------------------------------------------------------ */
/* Common SDMX Dimension Codes */
/* ------------------------------------------------------------------ */

/** Common REF_AREA (country) codes for filtering */
export const UN_COUNTRY_CODES = {
  CANADA: '124',
  USA: '842',
  MEXICO: '484',
  UK: '826',
  FRANCE: '250',
  GERMANY: '276',
  JAPAN: '392',
  CHINA: '156',
  INDIA: '356',
  BRAZIL: '076',
  AUSTRALIA: '036',
  WORLD: '900',
} as const;

/* ------------------------------------------------------------------ */
/* URL Builders */
/* ------------------------------------------------------------------ */

/**
 * Build a UN SDMX REST API URL.
 * Pattern: {base}/{artifact}/{agency}:{artifactId}(/{version})
 *
 * @param path - REST path after the base URL
 * @param params - Query string parameters
 */
export function unUrl(
  path: string,
  params: Record<string, string> = {},
): string {
  const searchParams = new URLSearchParams(params);
  const paramStr = searchParams.toString();
  return `${UN_API_BASE}${path}${paramStr ? '?' + paramStr : ''}`;
}

/**
 * Build URL for fetching a data structure definition (DSD).
 * GET /datastructure/{agency}/{structureId}
 */
export function unDataStructureUrl(
  agency: string,
  structureId: string,
): string {
  return unUrl(`/datastructure/${agency}/${structureId}`, {
    format: 'json',
    references: 'none',
  });
}

/**
 * Build URL for fetching data from a specific dataflow.
 * GET /data/{agency},{dataflowId},{version}/{key}/{startTime}/{endTime}
 *
 * @param dataflowId - Full dataflow ID (e.g. "UNSD/DF_POP")
 * @param options - Filter options (key, time range)
 */
export function unDataUrl(
  dataflowId: string,
  options: {
    key?: string;
    startTime?: string;
    endTime?: string;
    detail?: string;
  } = {},
): string {
  // Parse dataflow ID: "AGENCY/DF_CODE" → "AGENCY,DF_CODE,latest"
  const [agency, code] = dataflowId.includes('/')
    ? dataflowId.split('/')
    : ['UNSD', dataflowId];

  const version = 'latest';
  const key = options.key ?? 'all';
  const parts = [`${agency},${code},${version}`, key];

  if (options.startTime && options.endTime) {
    parts.push(options.startTime, options.endTime);
  }

  const detail = options.detail ?? 'dataonly';
  return unUrl(`/data/${parts.join('/')}`, {
    format: 'json',
    detail,
  });
}

/**
 * Build URL for listing available dataflows.
 * GET /dataflow/
 */
export function unDataflowUrl(): string {
  return unUrl('/dataflow', { format: 'json', references: 'none' });
}

/**
 * Build the UNdata explorer URL for a given database.
 */
export function unDataExplorerUrl(databaseCode: string): string {
  return `http://data.un.org/Data.aspx?d=${encodeURIComponent(databaseCode)}`;
}

/**
 * Human-readable name for a database code.
 */
export function unDatabaseName(code: string): string {
  return UN_DATABASE_NAMES[code] ?? code;
}
