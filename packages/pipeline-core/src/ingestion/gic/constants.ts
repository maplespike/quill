// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GIC Appointment Constants — Quill
 *
 * Source metadata and URL patterns for Governor-in-Council appointment data.
 *
 * Primary source: GC InfoBase (Government of Canada's central data portal
 * for federal appointments data).
 *
 * Secondary source: Canada Gazette Orders in Council publications on
 * open.canada.ca (CKAN).
 *
 * The GIC appointments data covers ~1,500+ positions across boards,
 * tribunals, commissions, agencies, and courts.
 */


export const GIC_SOURCES = {
  /** GC InfoBase — primary source for GIC appointment data */
  INFOBASE: {
    BASE: 'https://www.infobasegc.ca',
    /** API endpoint for GIC appointments query */
    API: 'https://www.infobasegc.ca/api/v1',
    /** PCO GIC Appointments portal */
    PORTAL: 'https://www.canada.ca/en/privy-council/services/governor-council-appointments.html',
    /** GIC appointments data URL */
    GIC_DATA: 'https://www.infobasegc.ca/gic-appointments',
  },

  /** Canada Gazette Orders in Council — CKAN on open.canada.ca */
  CANADA_GAZETTE_OIC: {
    /** CKAN package ID for Canada Gazette Orders in Council (2020) */
    CKAN_PACKAGE_ID_2020: 'd63a5c6d-fd93-4442-ac28-561f4dac90c6',
    /** CKAN package ID for Canada Gazette Orders in Council (2022) */
    CKAN_PACKAGE_ID_2022: '1691db07-7620-4535-9cb0-e5a0512ba35d',
    /** Portal base */
    PORTAL: 'https://open.canada.ca/data/en',
    /** CKAN API base */
    CKAN_BASE: 'https://open.canada.ca/data',
  },

  /** CKAN search templates */
  CKAN: {
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    /** Query for GIC appointment datasets */
    GIC_QUERY: 'governor+in+council+appointments',
    /** Query for Orders in Council datasets */
    OIC_QUERY: 'orders+in+council',
  },
} as const;


/**
 * Known CKAN package IDs on open.canada.ca that contain GIC-related data.
 *
 * These were discovered by searching open.canada.ca for:
 * - "Governor in Council appointments"
 * - "Orders in Council"
 * - "GIC appointments"
 *
 * The Canada Gazette Orders in Council datasets include GIC appointment
 * notices published in Part I of the Canada Gazette.
 */
export const GIC_CKAN_PACKAGE_IDS = {
  /** Canada Gazette: ORDERS IN COUNCIL - 2020 */
  CANADA_GAZETTE_OIC_2020: 'd63a5c6d-fd93-4442-ac28-561f4dac90c6',
  /** Canada Gazette: ORDERS IN COUNCIL - 2022 */
  CANADA_GAZETTE_OIC_2022: '1691db07-7620-4535-9cb0-e5a0512ba35d',
} as const;

export type GICCkanPackageId = keyof typeof GIC_CKAN_PACKAGE_IDS;


export interface GICSourceConfig {
  name: string;
  description: string;
  ckanPackageId?: string;
  baseUrl: string;
  priority: number; // lower = higher priority
}

export const GIC_SOURCE_CONFIGS: GICSourceConfig[] = [
  {
    name: 'gc-infobase',
    description: 'GC InfoBase — Government of Canada central appointments data',
    baseUrl: GIC_SOURCES.INFOBASE.BASE,
    priority: 1,
  },
  {
    name: 'canada-gazette-2020',
    description: 'Canada Gazette Orders in Council — 2020',
    ckanPackageId: GIC_CKAN_PACKAGE_IDS.CANADA_GAZETTE_OIC_2020,
    baseUrl: GIC_SOURCES.CANADA_GAZETTE_OIC.PORTAL,
    priority: 2,
  },
  {
    name: 'canada-gazette-2022',
    description: 'Canada Gazette Orders in Council — 2022',
    ckanPackageId: GIC_CKAN_PACKAGE_IDS.CANADA_GAZETTE_OIC_2022,
    baseUrl: GIC_SOURCES.CANADA_GAZETTE_OIC.PORTAL,
    priority: 3,
  },
];


/**
 * Build a CKAN package_show URL for a given package ID.
 */
export function ckanPackageUrl(packageId: string): string {
  return `${GIC_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;
}

/**
 * Build a CKAN package_search URL for GIC appointments.
 */
export function ckanSearchUrl(query: string = GIC_SOURCES.CKAN.GIC_QUERY, rows: number = 20): string {
  return `${GIC_SOURCES.CKAN.SEARCH}?q=${query}&rows=${rows}`;
}

/**
 * Build a GC InfoBase API URL for a specific endpoint.
 */
export function infobaseApiUrl(endpoint: string): string {
  return `${GIC_SOURCES.INFOBASE.API}/${endpoint.replace(/^\//, '')}`;
}
