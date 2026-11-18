// SPDX-License-Identifier: AGPL-3.0-only
export const PD_USER_AGENT = 'MapleSpike-ProvincialDeep/1.0';
export const PD_TIMEOUT_MS = 15_000;
export const MAX_DATASETS_PER_SECTOR = 30;
export const SMALLER_PROVINCES = ['SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
export const SECTOR_KEYWORDS = ['health', 'education', 'social', 'employment', 'environment', 'energy', 'agriculture', 'transport', 'justice', 'housing'];
export const PROVINCIAL_CKAN: Record<string, string> = {
  SK: 'https://dashboard.saskatchewan.ca', MB: 'https://web2.gov.mb.ca/api/3/action',
  NS: 'https://data.novascotia.ca', NB: 'https://gnb.socrata.com',
  NL: 'https://opendata.gov.nl.ca/api/3/action', PE: 'https://data.princeedwardisland.ca',
  YT: 'https://open.yukon.ca/api/3/action', NT: 'https://opendata.gov.nt.ca/api/3/action',
  NU: 'https://open.canada.ca/data/api/3/action',
};
