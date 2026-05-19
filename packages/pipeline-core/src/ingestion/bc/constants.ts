export const BC_USER_AGENT = 'MapleSpike-BC/1.0';
export const BC_TIMEOUT_MS = 15_000;
export const BC_CKAN_ENDPOINT = 'https://catalogue.data.gov.bc.ca/api/3/action';
export const BC_MAX_DATASETS_PER_SECTOR = 30;
export const BC_SECTOR_KEYWORDS = [
  'health', 'education', 'social', 'employment', 'environment',
  'energy', 'agriculture', 'transport', 'justice', 'housing',
  'forestry', 'mining', 'fisheries', 'tourism', 'economic development',
];
export const BC_DATA_SOURCES = [
  { name: 'BC Open Data CKAN', endpoint: BC_CKAN_ENDPOINT, format: 'CKAN' },
  { name: 'BC Data Catalogue', endpoint: 'https://catalogue.data.gov.bc.ca', format: 'HTML' },
  { name: 'BC Stats', endpoint: 'https://www2.gov.bc.ca/gov/content/data/statistics', format: 'HTML' },
];
