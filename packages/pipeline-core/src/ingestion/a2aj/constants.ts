// SPDX-License-Identifier: AGPL-3.0-only
export const A2AJ_BASE = 'https://api.a2aj.ca';
export const A2AJ_TIMEOUT_MS = 30_000;
export const A2AJ_USER_AGENT = 'MapleSpike-A2AJ/1.0 (+https://github.com/reverb256/quill)';
export const A2AJ_MAX_SEARCH_RESULTS = 50;
export const A2AJ_RATE_LIMIT_PER_HOUR = 1000;

export const A2AJ_ENDPOINTS = {
  coverage: `${A2AJ_BASE}/coverage`,
  fetch: `${A2AJ_BASE}/fetch`,
  search: `${A2AJ_BASE}/search`,
} as const;

/** Key court/tribunal datasets for government accountability tracking */
export const TRACKED_DATASETS = [
  'SCC',     'FCA',    'FC',      'TCC',
  'ONCA',    'ONSC',   'ONSC-DC',
  'BCCA',    'BCSC',
  'ABCA',    'ABKB',
  'QCCA',    'QCCS',
  'RAD',     'RPD',
  'SST',     'CITT',   'CHRT',    'FED',
];
