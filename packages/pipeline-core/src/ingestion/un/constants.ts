// SPDX-License-Identifier: AGPL-3.0-or-later

export const UN_SDMX_API_BASE = 'http://data.un.org/ws/rest';

export const UN_TIMEOUT_MS = 30000;

export const UN_USER_AGENT = 'MapleSpike-UN-Client/1.0 (+https://github.com/reverb256/maplespike)';

export const UN_MAX_RECORDS = 1000;

export const UN_ACCEPT_FORMATS = ['json', 'xml', 'csv'] as const;

export const UN_DEFAULT_FORMAT = 'json' as const;

export type UnAcceptFormat = (typeof UN_ACCEPT_FORMATS)[number];

/**
 * Top 10 UN databases with dataset codes
 * Source: UN Data Portal (data.un.org)
 */
export const UN_DATABASES: Record<string, { code: string; name: string; description: string; agency: string }> = {
  UNCTAD: {
    code: 'UNCTAD',
    name: 'UNCTAD Statistics',
    description: 'UNCTADstat database with trade, FDI, and development indicators',
    agency: 'UNCTAD',
  },
  UNCTADstat: {
    code: 'UNCTADstat',
    name: 'UNCTADstat',
    description: 'UNCTAD database with annual statistics on trade, FDI, development indicators',
    agency: 'UNCTAD',
  },
  UNData: {
    code: 'UNData',
    name: 'UN Data Portal',
    description: 'United Nations data portal with cross-agency statistics and indicators',
    agency: 'UNSD',
  },
  UNIDO: {
    code: 'UNIDO',
    name: 'UNIDO Statistics',
    description: 'UNIDO industrial development and manufacturing statistics',
    agency: 'UNIDO',
  },
  UNComtrade: {
    code: 'UNComtrade',
    name: 'UN Comtrade',
    description: 'International merchandise trade statistics',
    agency: 'UNSD',
  },
  ILO: {
    code: 'ILO',
    name: 'ILOSTAT',
    description: 'International Labour Organization statistics on labour markets',
    agency: 'ILO',
  },
  WHO: {
    code: 'WHO',
    name: 'WHO Data',
    description: 'World Health Organization global health statistics',
    agency: 'WHO',
  },
  UNESCO: {
    code: 'UNESCO',
    name: 'UNESCO UIS',
    description: 'UNESCO Institute for Statistics education and culture data',
    agency: 'UNESCO',
  },
  FAO: {
    code: 'FAO',
    name: 'FAOSTAT',
    description: 'Food and Agriculture Organization agricultural statistics',
    agency: 'FAO',
  },
  UNDP: {
    code: 'UNDP',
    name: 'UNDP Data',
    description: 'UN development indicators and Human Development Index',
    agency: 'UNDP',
  },
} as const;

export const UN_DATASETS: Record<string, { code: string; description: string }> = {
  TRADE: { code: 'trade', description: 'Merchandise trade statistics by country and commodity' },
  FDI: { code: 'fdi', description: 'Foreign direct investment flows' },
  DEVELOPMENT: { code: 'dev', description: 'Development indicators' },
  HEALTH: { code: 'health', description: 'Health indicators' },
  EDUCATION: { code: 'education', description: 'Education statistics' },
  ENVIRONMENT: { code: 'env', description: 'Environmental indicators' },
  POPULATION: { code: 'pop', description: 'Population statistics' },
  ENERGY: { code: 'energy', description: 'Energy production and consumption' },
  LABOR: { code: 'labor', description: 'Labor market indicators' },
  AGRICULTURE: { code: 'agri', description: 'Agricultural production and trade' },
} as const;

export const UN_DATAFLOW_CONSTANTS = {
  DATASTRUCTURE: 'DF_DATAFLOW',
  DATASTRUCTURES: 'DF_DATASTRUCTURES',
  DATAFLOW: 'DF_DATAFLOW',
  CODELIST: 'CODELIST',
  CODELISTS: 'CODELISTS',
  DATA: 'DATA',
  METADATA: 'METADATA',
} as const;