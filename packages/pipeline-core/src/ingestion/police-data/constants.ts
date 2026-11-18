// SPDX-License-Identifier: AGPL-3.0-only
export type PolicePortalType = 'ckan' | 'socrata' | 'custom' | 'none';

export interface PoliceAgency {
  city: string;
  province: string;
  url: string;
  portalType: PolicePortalType;
  name: string;
  datasetId: string;
}

export const POLICE_AGENCIES: PoliceAgency[] = [
  { city: 'Toronto', province: 'ON', url: 'https://open.toronto.ca', portalType: 'ckan', name: 'Toronto Police Service', datasetId: 'police-incidents' },
  { city: 'Ottawa', province: 'ON', url: 'https://open.ottawa.ca', portalType: 'ckan', name: 'Ottawa Police Service', datasetId: 'police-data' },
  { city: 'Peel Region', province: 'ON', url: 'https://data.peelregion.ca', portalType: 'socrata', name: 'Peel Regional Police', datasetId: 'police' },
  { city: 'Durham Region', province: 'ON', url: 'https://opendata.durham.ca', portalType: 'ckan', name: 'Durham Regional Police', datasetId: 'police' },
  { city: 'York Region', province: 'ON', url: 'https://www.york.ca', portalType: 'custom', name: 'York Regional Police', datasetId: 'police' },
  { city: 'Hamilton', province: 'ON', url: 'https://open.hamilton.ca', portalType: 'ckan', name: 'Hamilton Police Service', datasetId: 'police' },
  { city: 'London', province: 'ON', url: 'https://data.london.ca', portalType: 'socrata', name: 'London Police Service', datasetId: 'police' },
  { city: 'Edmonton', province: 'AB', url: 'https://data.edmonton.ca', portalType: 'socrata', name: 'Edmonton Police Service', datasetId: 'police-incidents' },
  { city: 'Calgary', province: 'AB', url: 'https://data.calgary.ca', portalType: 'socrata', name: 'Calgary Police Service', datasetId: 'police-calls' },
  { city: 'Vancouver', province: 'BC', url: 'https://opendata.vancouver.ca', portalType: 'socrata', name: 'Vancouver Police Department', datasetId: 'police-data' },
  { city: 'Surrey', province: 'BC', url: 'https://data.surrey.ca', portalType: 'ckan', name: 'Surrey RCMP', datasetId: 'police' },
  { city: 'Montreal', province: 'QC', url: 'https://donnees.montreal.ca', portalType: 'ckan', name: 'Service de police de Montréal', datasetId: 'interventions-policieres' },
  { city: 'Quebec City', province: 'QC', url: 'https://www.ville.quebec.qc.ca/donnees-ouvertes', portalType: 'custom', name: 'Service de police de Québec', datasetId: 'police' },
  { city: 'Winnipeg', province: 'MB', url: 'https://data.winnipeg.ca', portalType: 'socrata', name: 'Winnipeg Police Service', datasetId: 'police' },
  { city: 'Halifax', province: 'NS', url: 'https://catalogue.hrm.ca', portalType: 'ckan', name: 'Halifax Regional Police', datasetId: 'police' },
  { city: 'Sherbrooke', province: 'QC', url: 'https://www.donneesquebec.ca', portalType: 'ckan', name: 'Service de police de Sherbrooke', datasetId: 'police' },
];

export const POLICE_TIMEOUT_MS = 15_000;
export const POLICE_USER_AGENT = 'MapleSpike-Police/2.0';
