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
