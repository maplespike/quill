// SPDX-License-Identifier: AGPL-3.0-only
export type ParkPortalType = 'ckan' | 'socrata' | 'arcgis' | 'custom' | 'none';

export interface ParkPortal {
  city: string;
  province: string;
  url: string;
  portalType: ParkPortalType;
  datasetId: string;
  name: string;
}

export const PARK_PORTALS: Record<string, ParkPortal> = {
  'toronto': { city: 'Toronto', province: 'ON', url: 'https://open.toronto.ca', portalType: 'ckan', datasetId: 'parks-and-recreation-facilities', name: 'Toronto Parks' },
  'vancouver': { city: 'Vancouver', province: 'BC', url: 'https://opendata.vancouver.ca', portalType: 'socrata', datasetId: 'parks', name: 'Vancouver Parks' },
  'calgary': { city: 'Calgary', province: 'AB', url: 'https://data.calgary.ca', portalType: 'socrata', datasetId: 'parks', name: 'Calgary Parks' },
  'edmonton': { city: 'Edmonton', province: 'AB', url: 'https://data.edmonton.ca', portalType: 'socrata', datasetId: 'parks', name: 'Edmonton Parks' },
  'montreal': { city: 'Montreal', province: 'QC', url: 'https://donnees.montreal.ca', portalType: 'ckan', datasetId: 'parcs', name: 'Montreal Parks' },
  'ottawa': { city: 'Ottawa', province: 'ON', url: 'https://open.ottawa.ca', portalType: 'ckan', datasetId: 'parks-and-recreation', name: 'Ottawa Parks' },
  'winnipeg': { city: 'Winnipeg', province: 'MB', url: 'https://data.winnipeg.ca', portalType: 'socrata', datasetId: 'parks', name: 'Winnipeg Parks' },
  'mississauga': { city: 'Mississauga', province: 'ON', url: 'https://data.mississauga.ca', portalType: 'ckan', datasetId: 'parks-and-trails', name: 'Mississauga Parks' },
  'surrey': { city: 'Surrey', province: 'BC', url: 'https://data.surrey.ca', portalType: 'ckan', datasetId: 'parks', name: 'Surrey Parks' },
  'burnaby': { city: 'Burnaby', province: 'BC', url: 'https://data.burnaby.ca', portalType: 'arcgis', datasetId: 'parks', name: 'Burnaby Parks' },
  'hamilton': { city: 'Hamilton', province: 'ON', url: 'https://open.hamilton.ca', portalType: 'ckan', datasetId: 'parks', name: 'Hamilton Parks' },
  'halifax': { city: 'Halifax', province: 'NS', url: 'https://catalogue.hrm.ca', portalType: 'ckan', datasetId: 'parks', name: 'Halifax Parks' },
};

export const PARK_TIMEOUT_MS = 10_000;
export const PARK_USER_AGENT = 'MapleSpike-Parks/1.0';
