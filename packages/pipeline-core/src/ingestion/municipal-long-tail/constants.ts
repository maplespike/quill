// SPDX-License-Identifier: AGPL-3.0-only
export const CRAWLER_USER_AGENT = 'MapleSpike-MunicipalLongTail/1.0';
export const CRAWLER_TIMEOUT_MS = 15_000;
export const MUNICIPAL_KEYWORDS = ['council', 'meeting', 'budget', 'permit', 'zoning', 'transit', 'procurement', 'property', 'tax', 'water', 'waste', 'parks', 'roads'];
export const PROVINCIAL_CKAN_PATHS: Record<string, string> = {
  ON: 'https://data.ontario.ca/api/3/action', BC: 'https://catalogue.data.gov.bc.ca/api/3/action',
  AB: 'https://open.alberta.ca/api/3/action', QC: 'https://donneesquebec.ca/api/3/action',
  SK: 'https://catalogue.saskatchewan.ca/api/3/action', MB: 'https://web2.gov.mb.ca/api/3/action',
  NS: 'https://data.novascotia.ca', NB: 'https://gnb.socrata.com',
  NL: 'https://opendata.gov.nl.ca/api/3/action', PE: 'https://data.princeedwardisland.ca',
  YT: 'https://open.yukon.ca/api/3/action', NT: 'https://opendata.gov.nt.ca/api/3/action',
  NU: 'https://open.canada.ca/data/api/3/action',
};
export const MAX_DATASETS_PER_PORTAL = 100;
