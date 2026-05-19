// SPDX-License-Identifier: AGPL-3.0-or-later
export const PD_USER_AGENT = 'MapleSpike-ProvincialDeep/1.0';
export const PD_TIMEOUT_MS = 15_000;
export const MAX_DATASETS_PER_SECTOR = 30;
export const LARGER_PROVINCES = ['ON', 'QC', 'BC', 'AB'];
export const SECTOR_KEYWORDS = ['health', 'education', 'social', 'employment', 'environment', 'energy', 'agriculture', 'transport', 'justice', 'housing'];
export const PROVINCIAL_CKAN: Record<string, string> = {
  ON: 'https://data.ontario.ca/api/3/action',
  QC: 'https://donneesquebec.ca/api/3/action',
  BC: 'https://catalogue.data.gov.bc.ca/api/3/action',
  AB: 'https://open.alberta.ca/api/3/action',
};