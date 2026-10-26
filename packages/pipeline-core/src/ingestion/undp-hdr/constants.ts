// SPDX-License-Identifier: AGPL-3.0-only

export const UNDP_API_BASE = 'https://hdr.undp.org/data-center/api';

export const UNDP_TIMEOUT_MS = 30_000;

export const UNDP_HDR_INDICATORS: { code: string; name: string; description: string }[] = [
  {
    code: 'HDI',
    name: 'Human Development Index',
    description: 'Composite index measuring average achievement in three basic dimensions of human development: a long and healthy life, knowledge, and a decent standard of living.',
  },
  {
    code: 'IHDI',
    name: 'Inequality-adjusted Human Development Index',
    description: 'Human Development Index adjusted for inequalities in the three basic dimensions of human development.',
  },
  {
    code: 'GDI',
    name: 'Gender Development Index',
    description: 'Ratio of female to male HDI values, reflecting gender disparities in human development achievements.',
  },
  {
    code: 'GII',
    name: 'Gender Inequality Index',
    description: 'Composite measure reflecting inequality in achievements between women and men in reproductive health, empowerment, and the labor market.',
  },
  {
    code: 'PHDI',
    name: 'Planetary pressures-adjusted Human Development Index',
    description: 'Human Development Index adjusted for planetary pressures including carbon emissions, material footprint, and ecological footprint.',
  },
  {
    code: 'MPI',
    name: 'Multidimensional Poverty Index',
    description: 'International measure of acute poverty covering over 100 developing countries, reflecting deprivations in health, education, and living standards.',
  },
];

export const DEFAULT_COUNTRIES = [
  'CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'NZL',
  'MEX', 'BRA', 'IND', 'CHN', 'ZAF', 'NOR', 'SWE', 'CHE',
];