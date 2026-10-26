// SPDX-License-Identifier: AGPL-3.0-only

/**
 * US CIA World Factbook - Constants
 */

export const CIA_BASE_URL = 'https://www.cia.gov/api/factbook';

export const CIA_TIMEOUT_MS = 15_000;

export const CIA_THROTTLE = { maxTokens: 1, refillPerSecond: 0.5 };

export const CIA_USER_AGENT = 'MapleSpike-CIA/1.0';

export const DEFAULT_COUNTRIES = [
  'CA', 'US', 'GB', 'AU', 'NZ',
  'FR', 'DE', 'JP', 'CN', 'IN', 'BR', 'ZA',
];

export const CORE_FIELDS: { apiField: string; name: string; category: string }[] = [
  { apiField: 'population', name: 'Population', category: 'demographics' },
  { apiField: 'gdp', name: 'GDP (PPP)', category: 'economy' },
  { apiField: 'gdp_per_capita', name: 'GDP per capita (PPP)', category: 'economy' },
  { apiField: 'unemployment_rate', name: 'Unemployment rate', category: 'economy' },
  { apiField: 'inflation_rate', name: 'Inflation rate', category: 'economy' },
  { apiField: 'life_expectancy', name: 'Life expectancy at birth', category: 'health' },
  { apiField: 'birth_rate', name: 'Birth rate', category: 'demographics' },
  { apiField: 'death_rate', name: 'Death rate', category: 'demographics' },
  { apiField: 'migration_rate', name: 'Net migration rate', category: 'demographics' },
  { apiField: 'military_expenditure', name: 'Military expenditure (% of GDP)', category: 'defence' },
  { apiField: 'internet_users', name: 'Internet users', category: 'infrastructure' },
  { apiField: 'exports', name: 'Exports', category: 'economy' },
  { apiField: 'imports', name: 'Imports', category: 'economy' },
  { apiField: 'public_debt', name: 'Public debt (% of GDP)', category: 'economy' },
  { apiField: 'budget_revenues', name: 'Budget revenues', category: 'economy' },
  { apiField: 'budget_expenditures', name: 'Budget expenditures', category: 'economy' },
];

export const TOPIC_FIELDS: Record<string, { name: string; fields: string[] }> = {
  demographics: { name: 'Demographics', fields: ['population', 'birth_rate', 'death_rate', 'migration_rate'] },
  economy: { name: 'Economy', fields: ['gdp', 'gdp_per_capita', 'unemployment_rate', 'inflation_rate', 'exports', 'imports', 'public_debt', 'budget_revenues', 'budget_expenditures'] },
  health: { name: 'Health', fields: ['life_expectancy'] },
  defence: { name: 'Defence', fields: ['military_expenditure'] },
  infrastructure: { name: 'Infrastructure', fields: ['internet_users'] },
};
