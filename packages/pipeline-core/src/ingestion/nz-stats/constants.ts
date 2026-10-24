// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Statistics New Zealand - Constants
 *
 * Stats NZ provides open data via their OData API and
 * downloadable CSV/JSON datasets.
 */

export const SNZ_BASE_URL = 'https://api.stats.govt.nz/odata/v1';

export const SNZ_CATALOGUE_URL = 'https://www.stats.govt.nz/experimental/dataset-catalogue';

export const SNZ_TIMEOUT_MS = 15_000;

export const SNZ_THROTTLE = { maxTokens: 2, refillPerSecond: 1 };

export const SNZ_USER_AGENT = 'MapleSpike-SNZ/1.0';

export const DEFAULT_DATASETS = [
  'CPI',
  'GDP',
  'HLFs',
  'POP',
  'ITDS',
  'BOP',
  'PPI',
  'ESM',
];

export const TOPIC_DATASETS: Record<string, { name: string; datasets: string[] }> = {
  prices: { name: 'Prices', datasets: ['CPI', 'PPI'] },
  economy: { name: 'Economy', datasets: ['GDP', 'BOP', 'ESM'] },
  labour: { name: 'Labour', datasets: ['HLFs'] },
  population: { name: 'Population', datasets: ['POP'] },
  trade: { name: 'Trade', datasets: ['ITDS'] },
};
