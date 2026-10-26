// SPDX-License-Identifier: AGPL-3.0-only

export const FAO_API_BASE = 'https://fenixservices.fao.org/faostat/api/v1/en';

/** FAO domain codes mapped to human-readable names */
export const FAO_DOMAINS: Record<string, string> = {
  QCL: 'Crops and livestock products',
  QV: 'Crops and livestock products (value)',
  QI: 'Crops and livestock products (indices)',
  TCL: 'Trade: crops and livestock products',
  TV: 'Trade: crops and livestock products (value)',
  TI: 'Trade: crops and livestock products (indices)',
  RL: 'Livestock primary',
  RF: 'Livestock primary (flag)',
  FBS: 'Food balances',
  FBSH: 'Food balances (historic)',
  FS: 'Food security indicators',
  ES: 'Emissions shares',
  EI: 'Emissions intensities',
  ET: 'Emissions totals',
  GN: 'Fertilizers by nutrient',
  GA: 'Fertilizers by product',
  GB: 'Fertilizers by nutrient (flag)',
  RP: 'Pesticides',
  LU: 'Land use',
  IC: 'Investment',
  PE: 'Population estimates',
  MK: 'Food price indices',
  FI: 'Fisheries and aquaculture: production',
  FT: 'Fisheries and aquaculture: trade',
  FO: 'Forestry: production',
  FT_FO: 'Forestry: trade',
};

/** Key FAO domain codes for structured ingestion */
export const KEY_DOMAINS = ['QCL', 'TCL', 'RL', 'FBS', 'FS', 'ET', 'GN', 'LU', 'PE'];

/** Common country codes (ISO3) for focused queries */
export const COMMON_COUNTRIES: Record<string, string> = {
  CAN: 'Canada',
  USA: 'United States',
  MEX: 'Mexico',
  DEU: 'Germany',
  FRA: 'France',
  CHN: 'China',
  JPN: 'Japan',
  GBR: 'United Kingdom',
  IND: 'India',
  BRA: 'Brazil',
  AUS: 'Australia',
  NZL: 'New Zealand',
};
