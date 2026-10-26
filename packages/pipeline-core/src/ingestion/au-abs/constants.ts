// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Australian Bureau of Statistics - Constants
 *
 * ABS Data API (v2) provides Australian economic, demographic,
 * and census data via SDMX-JSON format.
 */

export const ABS_BASE_URL = 'https://api.data.abs.gov.au';

export const ABS_TIMEOUT_MS = 15_000;

export const ABS_THROTTLE = { maxTokens: 2, refillPerSecond: 1 };

export const ABS_USER_AGENT = 'MapleSpike-ABS/1.0';

export const DEFAULT_DATAFLOWS = [
  'ABS_CPI',
  'ABS_GDP',
  'ABS_LABOUR',
  'ABS_POP',
  'ABS_TRADE',
  'ABS_WPI',
  'ABS_RETAIL',
  'ABS_NFBC',
];

export const KEY_DATASTRUCTURES = [
  'ABS_CPI_1',
  'ABS_GDP_2',
  'ABS_LABOUR_1',
  'ABS_POP_1',
];

export const TOPIC_DATAFLOWS: Record<string, { name: string; prefixes: string[] }> = {
  prices: { name: 'Prices', prefixes: ['ABS_CPI', 'ABS_WPI'] },
  economy: { name: 'Economy', prefixes: ['ABS_GDP', 'ABS_NFBC', 'ABS_RETAIL'] },
  labour: { name: 'Labour', prefixes: ['ABS_LABOUR'] },
  population: { name: 'Population', prefixes: ['ABS_POP'] },
  trade: { name: 'Trade', prefixes: ['ABS_TRADE'] },
};
