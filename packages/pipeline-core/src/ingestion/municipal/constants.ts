// SPDX-License-Identifier: AGPL-3.0-only

export type PortalType = 'ckan' | 'socrata' | 'arcgis' | 'custom' | 'none';

export interface MunicipalPortal {
  name: string;
  province: string;
  baseUrl: string;
  portalType: PortalType;
  datasets: string[];
}

export const MUNICIPAL_PORTALS: Record<string, MunicipalPortal> = {
  'victoria': {
    name: 'Victoria',
    province: 'BC',
    baseUrl: 'https://opendata.victoria.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits', 'zoning'],
  },
  'edmonton': {
    name: 'Edmonton',
    province: 'AB',
    baseUrl: 'https://data.edmonton.ca',
    portalType: 'socrata',
    datasets: ['budget', 'building-permits', '311-calls'],
  },
  'regina': {
    name: 'Regina',
    province: 'SK',
    baseUrl: 'https://opendata.regina.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits'],
  },
  'winnipeg': {
    name: 'Winnipeg',
    province: 'MB',
    baseUrl: 'https://data.winnipeg.ca',
    portalType: 'socrata',
    datasets: ['budget', 'permits', '311-calls'],
  },
  'toronto': {
    name: 'Toronto',
    province: 'ON',
    baseUrl: 'https://open.toronto.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits', 'zoning', '311-calls'],
  },
  'quebec-city': {
    name: 'Quebec City',
    province: 'QC',
    baseUrl: 'https://www.ville.quebec.qc.ca/donnees-ouvertes',
    portalType: 'custom',
    datasets: ['budget', 'permits'],
  },
  'fredericton': {
    name: 'Fredericton',
    province: 'NB',
    baseUrl: 'https://www.fredericton.ca/en/business/opendata',
    portalType: 'custom',
    datasets: ['budget'],
  },
  'halifax': {
    name: 'Halifax',
    province: 'NS',
    baseUrl: 'https://catalogue.hrm.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits'],
  },
  'charlottetown': {
    name: 'Charlottetown',
    province: 'PE',
    baseUrl: 'https://www.charlottetown.ca/en/opendata',
    portalType: 'custom',
    datasets: ['budget'],
  },
  'st-johns': {
    name: "St. John's",
    province: 'NL',
    baseUrl: 'https://www.stjohns.ca/city-services/data-and-maps/open-data',
    portalType: 'custom',
    datasets: ['budget', 'maps'],
  },
  'yellowknife': {
    name: 'Yellowknife',
    province: 'NT',
    baseUrl: 'https://www.yellowknife.ca',
    portalType: 'custom',
    datasets: ['budget'],
  },
  'iqaluit': {
    name: 'Iqaluit',
    province: 'NU',
    baseUrl: 'https://www.iqaluit.ca',
    portalType: 'custom',
    datasets: ['budget'],
  },
  'whitehorse': {
    name: 'Whitehorse',
    province: 'YT',
    baseUrl: 'https://www.whitehorse.ca/departments/it/open-data',
    portalType: 'custom',
    datasets: ['budget'],
  },
  'ottawa': {
    name: 'Ottawa',
    province: 'ON',
    baseUrl: 'https://open.ottawa.ca',
    portalType: 'socrata',
    datasets: ['budget', 'permits', 'zoning', 'transit'],
  },
  'montreal': {
    name: 'Montreal',
    province: 'QC',
    baseUrl: 'https://donnees.montreal.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits', 'transport'],
  },
  'vancouver': {
    name: 'Vancouver',
    province: 'BC',
    baseUrl: 'https://opendata.vancouver.ca',
    portalType: 'socrata',
    datasets: ['budget', 'permits', 'zoning', 'transit'],
  },
  'calgary': {
    name: 'Calgary',
    province: 'AB',
    baseUrl: 'https://data.calgary.ca',
    portalType: 'socrata',
    datasets: ['budget', 'permits', 'transit'],
  },
  'hamilton': {
    name: 'Hamilton',
    province: 'ON',
    baseUrl: 'https://open.hamilton.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits'],
  },
  'kitchener': {
    name: 'Kitchener',
    province: 'ON',
    baseUrl: 'https://open.kitchener.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits'],
  },
  'london': {
    name: 'London',
    province: 'ON',
    baseUrl: 'https://data.london.ca',
    portalType: 'socrata',
    datasets: ['budget', 'transit'],
  },
  'mississauga': {
    name: 'Mississauga',
    province: 'ON',
    baseUrl: 'https://data.mississauga.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits', 'development'],
  },
  'brampton': {
    name: 'Brampton',
    province: 'ON',
    baseUrl: 'https://geohub.brampton.ca',
    portalType: 'ckan',
    datasets: ['budget', 'permits'],
  },
  'surrey': {
    name: 'Surrey',
    province: 'BC',
    baseUrl: 'https://data.surrey.ca',
    portalType: 'arcgis',
    datasets: ['budget', 'development'],
  },
  'burnaby': {
    name: 'Burnaby',
    province: 'BC',
    baseUrl: 'https://data.burnaby.ca',
    portalType: 'arcgis',
    datasets: ['budget', 'development'],
  },
  'richmond': {
    name: 'Richmond',
    province: 'BC',
    baseUrl: 'https://opendata.richmond.ca',
    portalType: 'ckan',
    datasets: ['budget'],
  },
  'markham': {
    name: 'Markham',
    province: 'ON',
    baseUrl: 'https://www.markham.ca/about-city-markham/open-data-markham',
    portalType: 'custom',
    datasets: ['budget', 'development'],
  },
  'vaughan': {
    name: 'Vaughan',
    province: 'ON',
    baseUrl: 'https://www.vaughan.ca/city-hall/data-statistics/open-data',
    portalType: 'custom',
    datasets: ['budget', 'development'],
  },
  'oakville': {
    name: 'Oakville',
    province: 'ON',
    baseUrl: 'https://www.oakville.ca/business-development/oakville-data-hub/',
    portalType: 'custom',
    datasets: ['budget'],
  },
  'laval': {
    name: 'Laval',
    province: 'QC',
    baseUrl: 'https://www.laval.ca/ville-donnees-ouvertes',
    portalType: 'custom',
    datasets: ['budget', 'development'],
  },
  'red-deer': {
    name: 'Red Deer',
    province: 'AB',
    baseUrl: 'https://www.reddeer.ca/data',
    portalType: 'custom',
    datasets: ['budget', 'development'],
  },
  'lethbridge': {
    name: 'Lethbridge',
    province: 'AB',
    baseUrl: 'https://www.lethbridge.ca/data',
    portalType: 'custom',
    datasets: ['budget'],
  },
};

export const MUNICIPAL_TIMEOUT_MS = 10_000;
export const MUNICIPAL_MAX_RECORDS = 1000;
export const MUNICIPAL_USER_AGENT = 'MapleSpike-Municipal/1.0';
