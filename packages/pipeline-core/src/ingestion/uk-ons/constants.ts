// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UK Office for National Statistics - Constants
 *
 * ONS provides data via the ONS API and downloadable datasets.
 * Key series: CPI, GDP, Labour Force, Population, Trade.
 */

export const ONS_BASE_URL = 'https://api.ons.gov.uk/v1';

export const ONS_TIMEOUT_MS = 15_000;

export const ONS_THROTTLE = { maxTokens: 2, refillPerSecond: 1 };

export const ONS_USER_AGENT = 'MapleSpike-ONS/1.0';

export const DEFAULT_TIMESERIES = [
  'CPI',
  'CPIH',
  'GDP',
  'LF24',
  'LF2G',
  'POP',
  'MTKA',
  'MTKI',
  'KOE6',
  'CHAW',
];

export const DEFAULT_DATASETS = [
  'cpih01',
  'gdp',
  'lms',
  'pop',
  'trade',
  'mwgd',
];

export const TOPIC_DATASETS: Record<string, { name: string; datasets: string[]; timeseries: string[] }> = {
  prices: { name: 'Prices', datasets: ['cpih01'], timeseries: ['CPI', 'CPIH'] },
  economy: { name: 'Economy', datasets: ['gdp'], timeseries: ['GDP'] },
  labour: { name: 'Labour', datasets: ['lms', 'mwgd'], timeseries: ['LF24', 'LF2G', 'KOE6'] },
  population: { name: 'Population', datasets: ['pop'], timeseries: ['POP'] },
  trade: { name: 'Trade', datasets: ['trade'], timeseries: ['MTKA', 'MTKI'] },
  housing: { name: 'Housing', datasets: [], timeseries: ['CHAW'] },
};
