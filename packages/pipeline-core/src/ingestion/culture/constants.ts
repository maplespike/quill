/**
 * Canadian cultural data source constants — Quill
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
    id: 'eef1a53c-f2c1-4679-b765-27026b31f7ff',
    title: 'Canadian Heritage — Experimentation Plan',
  },
  CANADA_CULTURAL_SPACES: {
    id: '8d7aaf21-0576-4c8f-bb9b-f3142b31257c',
    title: 'Canada Cultural Spaces Fund — Funding Data 2018-2019',
  },
  BUILDING_COMMUNITIES: {
    id: 'e2d041cc-d6e7-4117-bc43-5bd7c3bce0be',
    title: 'Canada Arts Presentation Fund — Funding Data 2018-2019',
  },
  CANADA_ARTS_TRAINING: {
    id: '3b041a9c-9136-4949-bceb-a491a653e262',
    title: 'Canada Council for the Arts — Key Funding Data',
  },
  CELEBRATE_CANADA: {
    id: '360643b2-3edd-4c01-b316-a2edcb44acc5',
    title: 'Canadian Heritage Accessibility Plan 2023-2025',
  },
  CANADA_MUSEUMS: {
    id: 'a8378e1a-47fa-4fea-b87c-d692ad406d9e',
    title: 'Museums Assistance Program — Travelling Exhibition Visitors',
  },
};

/** Canada Council for the Arts */
export const CANADA_COUNCIL_URL = 'https://canadacouncil.ca/research/data-tables';
export const CANADA_COUNCIL_API_BASE = 'https://canadacouncil.ca/api/v1';

/** Telefilm Canada */
export const TELEFILM_URL = 'https://telefilm.ca/en/studies-and-reports';
export const TELEFILM_CKAN_ID = '03e1d69d-8bab-40bf-83c0-8b92d5fa262d';

/** Canada Media Fund — separate data portal */
export const CMF_API_BASE = 'https://data.cmf-fmc.ca';
export const CMF_DATA_URL = 'https://data.cmf-fmc.ca/api/v1/data';
export const CMF_ENVELOPES_URL = 'https://data.cmf-fmc.ca/envelopes';
export const CMF_PRODUCTION_URL = 'https://data.cmf-fmc.ca/production';

/** CRTC cultural/broadcasting statistics */
export const CRTC_BROADCASTING_STATS = 'https://crtc.gc.ca/eng/publications/reports/broadcasting/';
export const CRTC_OWNERSHIP_URL = 'https://crtc.gc.ca/ownership/eng/';
export const CRTC_CULTURAL_URL = 'https://crtc.gc.ca/eng/cancon/';
export const CRTC_CKAN_PACKAGE_ID = '180dfc4c-8c1a-4c31-8e29-84953476bb92';

/** National Film Board */
export const NFB_CKAN_PACKAGE_ID = 'a49fc824-bd5c-4592-85ae-a7ad5cb18e59';
export const NFB_BASE_URL = 'https://www.nfb.ca';
export const NFB_API_URL = 'https://www.nfb.ca/api/v1';

/** CBC/Radio-Canada */
export const CBC_CKAN_PACKAGE_ID = '52fc72ac-bfc4-44cc-bbeb-87d1efe837b9';

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
