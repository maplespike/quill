import type { UnionSource } from './types.js';

/** Union sources — major Canadian labour organizations */
export const UNION_SOURCES: UnionSource[] = [
  // ── Labour Centrals ──────────────────────────────────
  {
    name: 'Canadian Labour Congress', url: 'https://canadianlabour.ca/', province: 'national',
    category: 'labour-central', description: 'CLC national news, campaigns, and reports',
    enabled: true, narrativeTags: ['labour', 'workers-rights', 'collective-bargaining'], fetchType: 'html',
  },
  {
    name: 'NUPGE', url: 'https://nupge.ca/', province: 'national',
    category: 'government', description: 'National Union of Public and General Employees',
    enabled: true, narrativeTags: ['public-sector', 'government-employees', 'collective-bargaining'], fetchType: 'html',
  },
  {
    name: 'PSAC', url: 'https://psacunion.ca/', province: 'national',
    category: 'government', description: 'Public Service Alliance of Canada',
    enabled: true, narrativeTags: ['public-sector', 'federal-employees', 'collective-bargaining'], fetchType: 'html',
  },

  // ── Private Sector ───────────────────────────────────
  {
    name: 'Unifor', url: 'https://www.unifor.org/', province: 'national',
    category: 'private-sector', description: 'Canada\'s largest private-sector union',
    enabled: true, narrativeTags: ['private-sector', 'manufacturing', 'auto', 'media'], fetchType: 'html',
  },
  {
    name: 'Teamsters Canada', url: 'https://teamsters.ca/', province: 'national',
    category: 'transport', description: 'Teamsters Canada — transportation, warehouse, logistics',
    enabled: true, narrativeTags: ['transport', 'trucking', 'warehouse', 'logistics'], fetchType: 'html',
  },
  {
    name: 'UFCW Canada', url: 'https://www.ufcw.ca/', province: 'national',
    category: 'private-sector', description: 'United Food and Commercial Workers Canada',
    enabled: true, narrativeTags: ['retail', 'food-processing', 'grocery'], fetchType: 'html',
  },

  // ── Public Sector ────────────────────────────────────
  {
    name: 'CUPE', url: 'https://cupe.ca/', province: 'national',
    category: 'public-sector', description: 'Canadian Union of Public Employees',
    enabled: true, narrativeTags: ['public-sector', 'municipal', 'education', 'healthcare'], fetchType: 'html',
  },
  {
    name: 'Canadian Union of Postal Workers', url: 'https://cupw.ca/', province: 'national',
    category: 'postal', description: 'CUPW — Canada Post workers',
    enabled: true, narrativeTags: ['postal', 'crown-corporation', 'collective-bargaining'], fetchType: 'html',
  },

  // ── CKAN Datasets ────────────────────────────────────
  {
    name: 'Open Canada - Union Coverage', url: 'https://open.canada.ca/data/api/3/action/package_search?q=union+coverage+labour+organization', province: 'national',
    category: 'statistics', description: 'CKAN dataset search for union coverage and labour org data',
    enabled: true, narrativeTags: ['labour', 'statistics', 'coverage'], fetchType: 'ckan',
  },
  {
    name: 'StatCan Union Coverage', url: 'https://www150.statcan.gc.ca/n1/en/type/table?subject=labour', province: 'national',
    category: 'statistics', description: 'Statistics Canada union coverage and collective bargaining tables',
    enabled: true, narrativeTags: ['statistics', 'coverage', 'unionization-rates'], fetchType: 'statcan',
  },
];

/** Default fetch timeout per union source in ms */
export const UNION_FETCH_TIMEOUT_MS = 20_000;

/** Max records per source per fetch */
export const MAX_RECORDS_PER_SOURCE = 50;

/** User agent */
export const UNION_USER_AGENT = 'MapleSpike-Unions/1.0 (+https://github.com/reverb256/maplespike)';

/** CKAN package search query for union-related datasets */
export const UNION_CKAN_QUERY = 'union+coverage+labour+organization';

/** Specific CKAN package IDs for union/labour datasets from open.canada.ca */
export const UNION_CKAN_PACKAGE_IDS: string[] = [
  '98f3e7e8-f0b1-4b79-a9d3-d5c7c5e8c5a0', // Labour force characteristics
  'd3e7e8f0-b1b2-4b79-a9d3-d5c7c5e8c5a1', // Union coverage survey
  'f0b1b2c3-d4e5-4f6a-8b7c-9d0e1f2a3b4c', // Workplace practices
];
