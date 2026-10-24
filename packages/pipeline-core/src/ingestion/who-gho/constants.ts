// SPDX-License-Identifier: AGPL-3.0-only

export const WHO_GHO_API_URL = 'https://ghoapi.azureedge.net/api';
export const WHO_GHO_TIMEOUT_MS = 30_000;
export const WHO_GHO_USER_AGENT = 'MapleSpike-WHO-GHO/1.0';

// Key health indicators relevant to Canadian policy analysis
// Full list at https://ghoapi.azureedge.net/api/Indicator
export const DEFAULT_INDICATORS = [
  'WHOSIS_000001', // Life expectancy at birth (years)
  'MDG_0000000002', // Maternal mortality ratio (per 100,000 live births)
  'MDG_0000000020', // Infant mortality rate (per 1,000 live births)
  'WHOSIS_000002', // Current health expenditure (% of GDP)
  'NCD_BMI_30A', // Obesity prevalence among adults (%)
  'NCD_TOBACCO_AGE_STANDARD', // Age-standardized prevalence of tobacco smoking (%)
  'NCD_ALCOHOL_TOTAL', // Alcohol consumption per capita (litres)
  'NCD_BLOOD_GLUCOSE_07', // Diabetes prevalence (%)
  'MDG_0000000026', // Tuberculosis incidence (per 100,000 population)
  'MDG_0000000012', // HIV prevalence among adults aged 15-49 (%)
];

export const DEFAULT_COUNTRIES = [
  'CAN', 'USA', 'GBR', 'DEU', 'FRA', 'AUS', 'JPN', 'SWE', 'NOR',
];

export const DEFAULT_YEARS = [2020, 2021, 2022, 2023];