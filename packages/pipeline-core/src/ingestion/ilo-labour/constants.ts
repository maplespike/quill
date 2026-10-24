// SPDX-License-Identifier: AGPL-3.0-only

import type { IloIndicator } from './types.js';

export const ILO_API_BASE = 'https://www.ilo.org/ilostat-api-dev/api';
export const ILO_TIMEOUT_MS = 30_000;
export const ILO_USER_AGENT = 'MapleSpike-ILO/1.0';

export const ILO_INDICATORS: IloIndicator[] = [
  {
    id: 'EMP_TEMP_SEX_AGE_RT_A',
    name: 'Employment by sex and age',
    topic: 'employment',
    description: 'Employment-to-population ratio by sex and age group',
    unit: 'percentage',
  },
  {
    id: 'UNE_TPOP_RT_A',
    name: 'Total unemployment rate',
    topic: 'unemployment',
    description: 'Total unemployment rate as percentage of labour force',
    unit: 'percentage',
  },
  {
    id: 'UNE_SEX_RT_A',
    name: 'Unemployment rate by sex',
    topic: 'unemployment',
    description: 'Unemployment rate by sex as percentage of labour force',
    unit: 'percentage',
  },
  {
    id: 'EMP_2EMP_SEX_AGE_NB_A',
    name: 'Employment by sex and age (modelled estimates)',
    topic: 'employment',
    description: 'ILO modelled employment estimates by sex and age',
    unit: 'thousands',
  },
  {
    id: 'RMTNE_EMPL_ZS',
    name: 'Wage and salaried workers',
    topic: 'wages',
    description: 'Wage and salaried workers as percentage of total employment',
    unit: 'percentage',
  },
  {
    id: 'EAP_SEX_RT_A',
    name: 'Employment-to-population ratio by sex',
    topic: 'labour-force',
    description: 'Employment-to-population ratio by sex',
    unit: 'percentage',
  },
  {
    id: 'EAP_TE_SEX_RT_A',
    name: 'Employment-to-population ratio (15+, by sex)',
    topic: 'labour-force',
    description: 'Employment-to-population ratio for ages 15+ by sex',
    unit: 'percentage',
  },
  {
    id: 'LF_2EMP_SEX_AGE_NB_A',
    name: 'Labour force by sex and age',
    topic: 'labour-force',
    description: 'Labour force estimates by sex and age group',
    unit: 'thousands',
  },
  {
    id: 'EMP_TEMP_SEX_AGE_RT_A',
    name: 'Employment to population ratio (detailed)',
    topic: 'employment',
    description: 'Detailed employment-to-population ratio by sex and age',
    unit: 'percentage',
  },
];

export const ILO_TOPICS = {
  employment: {
    code: 'employment',
    name: 'Employment',
    description: 'Employment rates, ratios, and labour market participation',
    indicators: ['EMP_TEMP_SEX_AGE_RT_A', 'EMP_2EMP_SEX_AGE_NB_A'],
  },
  unemployment: {
    code: 'unemployment',
    name: 'Unemployment',
    description: 'Unemployment rates and labour market slack',
    indicators: ['UNE_TPOP_RT_A', 'UNE_SEX_RT_A'],
  },
  'labour-force': {
    code: 'labour-force',
    name: 'Labour Force',
    description: 'Labour force participation and composition',
    indicators: ['EAP_SEX_RT_A', 'EAP_TE_SEX_RT_A', 'LF_2EMP_SEX_AGE_NB_A'],
  },
  wages: {
    code: 'wages',
    name: 'Wages and Earnings',
    description: 'Wage and salaried employment indicators',
    indicators: ['RMTNE_EMPL_ZS'],
  },
} as const;

export function buildIndicatorUrl(indicatorId: string, country?: string): string {
  const base = `${ILO_API_BASE}/data/indicator/${indicatorId}`;
  if (country) return `${base}?countries=${country}`;
  return `${base}?countries=CAN`;
}
