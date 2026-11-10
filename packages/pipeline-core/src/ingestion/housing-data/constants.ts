// SPDX-License-Identifier: AGPL-3.0-only
export interface HousingDataset {
  id: string;
  name: string;
  provider: string;
  url: string;
  category: 'rental' | 'ownership' | 'vacancy' | 'starts' | 'affordability';
  coverage: string;
}

export const HOUSING_DATASETS: HousingDataset[] = [
  { id: 'cmhc-rental', name: 'CMHC Rental Market Survey', provider: 'CMHC', url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market', category: 'rental', coverage: 'National' },
  { id: 'cmhc-vacancy', name: 'CMHC Vacancy Rates', provider: 'CMHC', url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/vacancy-rates', category: 'vacancy', coverage: 'Major cities' },
  { id: 'cmhc-starts', name: 'CMHC Housing Starts', provider: 'CMHC', url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/housing-starts', category: 'starts', coverage: 'National' },
  { id: 'statcan-cpi-shelter', name: 'StatCan CPI — Shelter', provider: 'Statistics Canada', url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=18100004', category: 'affordability', coverage: 'National' },
  { id: 'statcan-rental', name: 'StatCan Rental Statistics', provider: 'Statistics Canada', url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=34100133', category: 'rental', coverage: 'Provincial' },
  { id: 'cmhc-affordability', name: 'CMHC Housing Affordability', provider: 'CMHC', url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/housing-now', category: 'affordability', coverage: 'Major cities' },
  { id: 'statcan-home-values', name: 'StatCan New Housing Price Index', provider: 'Statistics Canada', url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=18100205', category: 'ownership', coverage: 'Major cities' },
];

export const HOUSING_TIMEOUT_MS = 10_000;

export const METRO_AREA_MAP: Record<string, string> = {
  'toronto': 'Toronto',
  'montreal': 'Montréal',
  'vancouver': 'Vancouver',
  'calgary': 'Calgary',
  'edmonton': 'Edmonton',
  'ottawa': 'Ottawa-Gatineau',
  'ottawa-gatineau': 'Ottawa-Gatineau',
  'gatineau': 'Ottawa-Gatineau',
  'winnipeg': 'Winnipeg',
  'hamilton': 'Hamilton',
  'quebec city': 'Québec City',
  'quebec': 'Québec City',
  'québec': 'Québec City',
  'kitchener': 'Kitchener-Cambridge-Waterloo',
  'kitchener-cambridge-waterloo': 'Kitchener-Cambridge-Waterloo',
  'cambridge': 'Kitchener-Cambridge-Waterloo',
  'waterloo': 'Kitchener-Cambridge-Waterloo',
  'london': 'London',
  'halifax': 'Halifax',
  'victoria': 'Victoria',
  'saskatoon': 'Saskatoon',
  'regina': 'Regina',
  'st. john\'s': 'St. John\'s',
  'st john\'s': 'St. John\'s',
  'kelowna': 'Kelowna',
  'windsor': 'Windsor',
};

export const HOUSING_TYPE_MAP: Record<string, string> = {
  'single detached': 'single-detached',
  'single-detached': 'single-detached',
  'single family': 'single-detached',
  'single-family': 'single-detached',
  'detached': 'single-detached',
  'semi detached': 'semi-detached',
  'semi-detached': 'semi-detached',
  'semi': 'semi-detached',
  'row house': 'row-house',
  'row-house': 'row-house',
  'townhouse': 'townhouse',
  'row': 'row-house',
  'apartment': 'apartment-condo',
  'apartment condo': 'apartment-condo',
  'apartment-condo': 'apartment-condo',
  'condo': 'apartment-condo',
  'condominium': 'apartment-condo',
  'duplex': 'duplex',
  'other': 'other',
};
