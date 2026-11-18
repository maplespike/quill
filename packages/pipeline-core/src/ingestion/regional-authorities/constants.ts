// SPDX-License-Identifier: AGPL-3.0-only
import type { RegionalAuthorityConfig } from './types.js';

export const REGIONAL_AUTHORITIES: RegionalAuthorityConfig[] = [
  // ── Ontario Regional Municipalities ─────────────────────
  {
    code: 'peel-region',
    name: 'Regional Municipality of Peel',
    province: 'ON',
    portalType: 'ckan',
    baseUrl: 'https://opendata.peelregion.ca',
    ckanBase: 'https://opendata.peelregion.ca/api/3/action',
    notes: 'Mississauga, Brampton, Caledon — regional planning, water, waste, transit, budgets, procurement',
    datasets: ['council-meetings', 'regional-budget', 'waste-management', 'water-quality'],
  },
  {
    code: 'york-region',
    name: 'Regional Municipality of York',
    province: 'ON',
    portalType: 'ckan',
    baseUrl: 'https://open.york.ca',
    ckanBase: 'https://open.york.ca/api/3/action',
    notes: 'Markham, Vaughan, Richmond Hill — YRT transit, planning, water, waste',
    datasets: ['yrt-ridership', 'regional-planning', 'water-quality', 'waste-diversion'],
  },
  {
    code: 'durham-region',
    name: 'Regional Municipality of Durham',
    province: 'ON',
    portalType: 'ckan',
    baseUrl: 'https://opendata.durham.ca',
    ckanBase: 'https://opendata.durham.ca/api/3/action',
    notes: 'Oshawa, Pickering, Ajax, Whitby — planning, water, waste, transit, GIS',
    datasets: ['planning-applications', 'water-quality', 'waste-collection', 'transit-routes'],
  },
  {
    code: 'waterloo-region',
    name: 'Regional Municipality of Waterloo',
    province: 'ON',
    portalType: 'ckan',
    baseUrl: 'https://data.regionofwaterloo.ca',
    ckanBase: 'https://data.regionofwaterloo.ca/api/3/action',
    notes: 'Kitchener, Waterloo, Cambridge — Grand River Transit, planning, budgets',
    datasets: ['grt-ridership', 'regional-budget', 'planning-applications'],
  },
  {
    code: 'halton-region',
    name: 'Regional Municipality of Halton',
    province: 'ON',
    portalType: 'ckan',
    baseUrl: 'https://opendata.halton.ca',
    ckanBase: 'https://opendata.halton.ca/api/3/action',
    notes: 'Oakville, Burlington, Milton, Halton Hills — planning, water, waste, GIS',
    datasets: ['planning', 'water-quality', 'waste-management'],
  },
  {
    code: 'niagara-region',
    name: 'Niagara Region',
    province: 'ON',
    portalType: 'ckan',
    baseUrl: 'https://niagararegion.ca/open-data',
    ckanBase: 'https://niagararegion.ca/open-data/api/3/action',
    notes: 'Niagara Falls, St. Catharines, Welland — regional planning, transit, procurement',
    datasets: ['regional-planning', 'transit-ridership', 'procurement'],
  },

  // ── BC Regional Districts ──────────────────────────────
  {
    code: 'metro-vancouver',
    name: 'Metro Vancouver Regional District',
    province: 'BC',
    portalType: 'arcgis-hub',
    baseUrl: 'https://open-data-portal-metrovancouver.hub.arcgis.com',
    arcgisHubBase: 'https://open-data-portal-metrovancouver.hub.arcgis.com',
    notes: 'Greater Vancouver — regional planning, water, waste, air quality, parks',
    datasets: ['air-quality', 'water-consumption', 'solid-waste', 'regional-parks', 'land-use'],
  },
  {
    code: 'crd',
    name: 'Capital Regional District',
    province: 'BC',
    portalType: 'html-scrape',
    baseUrl: 'https://www.crd.bc.ca/about/data',
    notes: 'Victoria area — regional planning, water, parks, GIS downloads',
    datasets: ['water-quality', 'regional-parks', 'waste-management'],
  },
  {
    code: 'nanaimo-rd',
    name: 'Regional District of Nanaimo',
    province: 'BC',
    portalType: 'arcgis-hub',
    baseUrl: 'https://rdn.bc.ca/spatial-data-disclaimer-and-licence',
    arcgisHubBase: 'https://data-rdn.opendata.arcgis.com',
    notes: 'Regional district parcels, zoning, addresses, GIS',
    datasets: ['parcels', 'zoning', 'addresses'],
  },

  // ── Manitoba ───────────────────────────────────────────
  {
    code: 'winnipeg-metro',
    name: 'Winnipeg Metropolitan Region',
    province: 'MB',
    portalType: 'ckan',
    baseUrl: 'https://data.winnipegmetroregion.ca',
    ckanBase: 'https://data.winnipegmetroregion.ca/api/3/action',
    notes: 'Capital Planning Region — bylaws, regional coordination, organization data',
    datasets: ['capital-planning-bylaws', 'regional-organization'],
  },
];

/** Map code -> config for quick lookup */
export const REGIONAL_AUTHORITY_MAP: Record<string, RegionalAuthorityConfig> = {};
for (const ra of REGIONAL_AUTHORITIES) {
  REGIONAL_AUTHORITY_MAP[ra.code] = ra;
}

export const REGIONAL_FETCH_TIMEOUT_MS = 15_000;
export const REGIONAL_USER_AGENT = 'MapleSpike-Regional/1.0 (+https://github.com/reverb256/quill)';
