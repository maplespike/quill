// SPDX-License-Identifier: AGPL-3.0-only

export type LibraryPortalType = 'ckan' | 'socrata' | 'arcgis' | 'custom' | 'none';

export interface LibraryPortal {
  city: string;
  province: string;
  url: string;
  portalType: LibraryPortalType;
  datasetId: string;
  name: string;
}

export const LIBRARY_PORTALS: Record<string, LibraryPortal> = {
  'toronto': {
    city: 'Toronto', province: 'ON',
    url: 'https://open.toronto.ca',
    portalType: 'ckan',
    datasetId: 'toronto-public-library-branch-locations',
    name: 'Toronto Public Library',
  },
  'ottawa': {
    city: 'Ottawa', province: 'ON',
    url: 'https://open.ottawa.ca',
    portalType: 'ckan',
    datasetId: 'ottawa-public-library-branches',
    name: 'Ottawa Public Library',
  },
  'montreal': {
    city: 'Montreal', province: 'QC',
    url: 'https://donnees.montreal.ca',
    portalType: 'ckan',
    datasetId: 'bibliotheques',
    name: 'Montreal Libraries',
  },
  'vancouver': {
    city: 'Vancouver', province: 'BC',
    url: 'https://opendata.vancouver.ca',
    portalType: 'socrata',
    datasetId: 'vancouver-public-library-branches',
    name: 'Vancouver Public Library',
  },
  'calgary': {
    city: 'Calgary', province: 'AB',
    url: 'https://data.calgary.ca',
    portalType: 'socrata',
    datasetId: 'calgary-public-library-branches',
    name: 'Calgary Public Library',
  },
  'edmonton': {
    city: 'Edmonton', province: 'AB',
    url: 'https://data.edmonton.ca',
    portalType: 'socrata',
    datasetId: 'edmonton-public-library-branches',
    name: 'Edmonton Public Library',
  },
  'winnipeg': {
    city: 'Winnipeg', province: 'MB',
    url: 'https://data.winnipeg.ca',
    portalType: 'socrata',
    datasetId: 'winnipeg-public-library-branches',
    name: 'Winnipeg Public Library',
  },
  'hamilton': {
    city: 'Hamilton', province: 'ON',
    url: 'https://open.hamilton.ca',
    portalType: 'ckan',
    datasetId: 'hamilton-public-library-branches',
    name: 'Hamilton Public Library',
  },
  'mississauga': {
    city: 'Mississauga', province: 'ON',
    url: 'https://data.mississauga.ca',
    portalType: 'ckan',
    datasetId: 'mississauga-library-system',
    name: 'Mississauga Library System',
  },
  'brampton': {
    city: 'Brampton', province: 'ON',
    url: 'https://geohub.brampton.ca',
    portalType: 'ckan',
    datasetId: 'brampton-library-locations',
    name: 'Brampton Library',
  },
  'surrey': {
    city: 'Surrey', province: 'BC',
    url: 'https://data.surrey.ca',
    portalType: 'ckan',
    datasetId: 'surrey-libraries',
    name: 'Surrey Libraries',
  },
  'burnaby': {
    city: 'Burnaby', province: 'BC',
    url: 'https://data.burnaby.ca',
    portalType: 'arcgis',
    datasetId: 'burnaby-public-library',
    name: 'Burnaby Public Library',
  },
  'kitchener': {
    city: 'Kitchener', province: 'ON',
    url: 'https://open.kitchener.ca',
    portalType: 'ckan',
    datasetId: 'kitchener-public-library-branches',
    name: 'Kitchener Public Library',
  },
  'london': {
    city: 'London', province: 'ON',
    url: 'https://data.london.ca',
    portalType: 'socrata',
    datasetId: 'london-public-library-branches',
    name: 'London Public Library',
  },
  'halifax': {
    city: 'Halifax', province: 'NS',
    url: 'https://catalogue.hrm.ca',
    portalType: 'ckan',
    datasetId: 'halifax-public-libraries',
    name: 'Halifax Public Libraries',
  },
};

export const LIBRARY_TIMEOUT_MS = 10_000;
export const LIBRARY_USER_AGENT = 'MapleSpike-Library/1.0';
