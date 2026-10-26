// SPDX-License-Identifier: AGPL-3.0-only

import type { OecdDataset } from './types.js';

export const OECD_DATA_EXPLORER_BASE_URL = 'https://data-explorer.oecd.org';
export const OECD_CSV_EXPORT_BASE_URL = 'https://sdmx.oecd.org/public/rest/data';

export const OECD_TIMEOUT_MS = 30_000;
export const OECD_USER_AGENT = 'MapleSpike-OECD/1.0';

export const TOPIC_NAAG = 'NAAG';
export const TOPIC_HEALTH = 'HEALTH';
export const TOPIC_EDUCATION = 'EDUCATION';
export const TOPIC_TAX = 'TAX';

export const DEFAULT_DATASETS = ['NAAG', 'HEALTH', 'EDUC', 'TAX'];

export const OECD_DATASETS: OecdDataset[] = [
  {
    id: 'NAAG',
    name: 'National Accounts',
    description: 'National accounts: GDP, GNI, expenditure, consumption by category',
    updateFrequency: 'quarterly',
    csvUrlTemplate: `${OECD_CSV_EXPORT_BASE_URL}/OECD,SNA_TABLE1/1.0/.`,
  },
  {
    id: 'HEALTH',
    name: 'Health Statistics',
    description: 'Health expenditure, resources, outcomes by country',
    updateFrequency: 'annual',
    csvUrlTemplate: `${OECD_CSV_EXPORT_BASE_URL}/OECD,HEALTH_STAT/1.0/.`,
  },
  {
    id: 'EDUC',
    name: 'Education at a Glance',
    description: 'Educational attainment, expenditure, outcomes',
    updateFrequency: 'annual',
    csvUrlTemplate: `${OECD_CSV_EXPORT_BASE_URL}/OECD.EDU.IMEP,DSD_EAG_LSO_EA@DF_LSO_NEAC_ALL/1.0/.`,
  },
  {
    id: 'TAX',
    name: 'Tax Database',
    description: 'Tax revenue, structures, and policies by tax type',
    updateFrequency: 'annual',
    csvUrlTemplate: `${OECD_CSV_EXPORT_BASE_URL}/OECD.TAX,TAXBASE/1.0/.`,
  },
];

export const OECD_TOPICS = {
  [TOPIC_NAAG]: {
    code: TOPIC_NAAG,
    name: 'National Accounts',
    datasets: ['NAAG'],
    description: 'GDP, GNI, government expenditure, consumption by category',
  },
  [TOPIC_HEALTH]: {
    code: TOPIC_HEALTH,
    name: 'Health Statistics',
    datasets: ['HEALTH'],
    description: 'Health expenditure, workforce, outcomes by country',
  },
  [TOPIC_EDUCATION]: {
    code: TOPIC_EDUCATION,
    name: 'Education',
    datasets: ['EDUC'],
    description: 'Educational attainment, labour market outcomes, and education indicators',
  },
  [TOPIC_TAX]: {
    code: TOPIC_TAX,
    name: 'Tax',
    datasets: ['TAX'],
    description: 'Tax revenue, structures, and policies by tax type',
  },
} as const;

export function buildDatasetUrl(datasetId: string, format: 'csv' | 'json' = 'csv'): string {
  const dataset = OECD_DATASETS.find((d) => d.id === datasetId);
  if (!dataset) {
    throw new Error(`Unknown dataset: ${datasetId}`);
  }
  return `${dataset.csvUrlTemplate}?format=${format}&startPeriod=2000&endPeriod=2025`;
}

export function validateDatasetId(datasetId: string): boolean {
  return OECD_DATASETS.some((d) => d.id === datasetId);
}