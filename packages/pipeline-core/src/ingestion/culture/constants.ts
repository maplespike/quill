/**
 * Canadian cultural data source constants — MapleSpike Pipeline
 *
 * Aggregates data from federal and agency-level cultural data portals:
 *   - PCH (Canadian Heritage) grants on open.canada.ca CKAN
 *   - Canada Council for the Arts research data
 *   - Telefilm Canada production funding reports
 *   - Canada Media Fund (CMF) open data portal
 *   - CRTC broadcasting statistics and ownership data
 *   - National Film Board (NFB) data via open.canada.ca CKAN
 *   - CBC/Radio-Canada financial and operational data
 */

export const CULTURE_UA = 'MapleSpike-Culture/1.0';
export const CKAN_BASE = 'https://open.canada.ca/data/api/3/action';
export const CULTURE_TIMEOUT_MS = 15_000;
export const MAX_RECORDS_PER_SOURCE = 100;

/** PCH / Canadian Heritage CKAN datasets */
export const PCH_CKAN_DATASETS: Record<string, { id: string; title: string }> = {
  PCH_GRANTS: {
    id: '0c3c7f3c-5c7d-4c8a-9c8e-9a1c2b3d4e5f',
    title: 'Canadian Heritage Grants and Contributions',
  },
  CANADA_CULTURAL_SPACES: {
    id: 'a5b6c7d8-e9f0-1234-5678-90abcdef1234',
    title: 'Canada Cultural Spaces Fund',
  },
  BUILDING_COMMUNITIES: {
    id: 'b6c7d8e9-f0a1-2345-6789-01abcdef2345',
    title: 'Building Communities Through Arts and Heritage',
  },
  CANADA_ARTS_TRAINING: {
    id: 'c7d8e9f0-a1b2-3456-7890-12abcdef3456',
    title: 'Canada Arts Training Fund',
  },
  CELEBRATE_CANADA: {
    id: 'd8e9f0a1-b2c3-4567-8901-23abcdef4567',
    title: 'Celebrate Canada Program',
  },
  CANADA_MUSEUMS: {
    id: 'e9f0a1b2-c3d4-5678-9012-34abcdef5678',
    title: 'Canada Museums Assistance Program',
  },
};

/** Canada Council for the Arts */
export const CANADA_COUNCIL_URL = 'https://canadacouncil.ca/research/data-tables';
export const CANADA_COUNCIL_API_BASE = 'https://canadacouncil.ca/api/v1';

/** Telefilm Canada */
export const TELEFILM_URL = 'https://telefilm.ca/en/studies-and-reports';
export const TELEFILM_CKAN_ID = 'f0a1b2c3-d4e5-6789-0123-45abcdef6789';

/** Canada Media Fund — separate data portal */
export const CMF_API_BASE = 'https://data.cmf-fmc.ca';
export const CMF_DATA_URL = 'https://data.cmf-fmc.ca/api/v1/data';
export const CMF_ENVELOPES_URL = 'https://data.cmf-fmc.ca/envelopes';
export const CMF_PRODUCTION_URL = 'https://data.cmf-fmc.ca/production';

/** CRTC cultural/broadcasting statistics */
export const CRTC_BROADCASTING_STATS = 'https://crtc.gc.ca/eng/publications/reports/broadcasting/';
export const CRTC_OWNERSHIP_URL = 'https://crtc.gc.ca/ownership/eng/';
export const CRTC_CULTURAL_URL = 'https://crtc.gc.ca/eng/cancon/';
export const CRTC_CKAN_PACKAGE_ID = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';

/** National Film Board */
export const NFB_CKAN_PACKAGE_ID = 'b2c3d4e5-f6a7-8901-2345-67890abcdef1';
export const NFB_BASE_URL = 'https://www.nfb.ca';
export const NFB_API_URL = 'https://www.nfb.ca/api/v1';

/** CBC/Radio-Canada */
export const CBC_CKAN_PACKAGE_ID = 'c3d4e5f6-a7b8-9012-3456-7890abcdef12';

/** Keyword searches for CKAN package_search API */
export const CULTURE_CKAN_QUERIES = [
  'heritage+grants',
  'canadian+heritage+funding',
  'culture+programs',
  'museums+grants',
  'film+funding',
  'arts+council+grants',
  'broadcasting+funding',
  'media+production+funding',
  'music+grants+canada',
  'publishing+grants+canada',
  'cultural+spaces+fund',
  'festivals+funding+canada',
  'indigenous+arts+funding',
  'official+languages+culture',
];

/** Canadian Heritage organization ID on open.canada.ca */
export const PCH_ORG_ID = 'pch';

/** List of known PCH program names for categorization */
export const PCH_PROGRAMS = [
  'Canada Arts Training Fund',
  'Building Communities Through Arts and Heritage',
  'Canada Cultural Spaces Fund',
  'Canada Arts Presentation Fund',
  'Canada Music Fund',
  'Canada Book Fund',
  'Canada Periodical Fund',
  'Canada Cultural Investment Fund',
  'Canada Cultural Online',
  'Canada Interactive Fund',
  'Young Canada Works',
  'Celebrate Canada',
  'Canadian Studies Program',
  'Official Languages Support Programs',
  'Indigenous Languages and Cultures Program',
  'Exchanges Canada',
];

/** Province codes used in culture data */
export const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU',
  'ON', 'PE', 'QC', 'SK', 'YT',
];

/** Genre/media categories used in CMF and Telefilm data */
export const MEDIA_CATEGORIES = [
  'feature-film',
  'documentary',
  'television-series',
  'digital-media',
  'animation',
  'short-film',
  'web-series',
  'interactive',
];
