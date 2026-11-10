// SPDX-License-Identifier: AGPL-3.0-only
export type RegionalAuthorityCode =
  | 'peel-region'
  | 'york-region'
  | 'durham-region'
  | 'waterloo-region'
  | 'halton-region'
  | 'niagara-region'
  | 'metro-vancouver'
  | 'crd'
  | 'winnipeg-metro'
  | 'nanaimo-rd';

export type RegionalPortalType = 'ckan' | 'socrata' | 'arcgis-hub' | 'html-scrape';

export interface RegionalAuthorityConfig {
  code: RegionalAuthorityCode;
  name: string;
  province: string;
  portalType: RegionalPortalType;
  baseUrl: string;
  ckanBase?: string;
  socrataBase?: string;
  arcgisHubBase?: string;
  notes: string;
  datasets: string[];
}

export interface RegionalRecord {
  authority: RegionalAuthorityCode;
  name: string;
  title: string;
  description: string;
  url: string;
  format: string;
  hash: string;
  ingestedAt: string;
}

export interface RegionalIngestionResult {
  records: RegionalRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
