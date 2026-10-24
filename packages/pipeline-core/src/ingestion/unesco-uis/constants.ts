// SPDX-License-Identifier: AGPL-3.0-only

import type { UnescoDataset } from './types.js';

export const UNESCO_UIS_BASE_URL = 'https://api.uis.unesco.org/api/public';
export const UNESCO_SDMX_BASE_URL = 'https://api.uis.unesco.org/api/public/sdmx';

export const UNESCO_TIMEOUT_MS = 45_000;
export const UNESCO_USER_AGENT = 'MapleSpike-UNESCO/1.0';

export const TOPIC_EDUCATION = 'EDUCATION';
export const TOPIC_SCIENCE = 'SCIENCE';
export const TOPIC_CULTURE = 'CULTURE';

export const DEFAULT_DATASETS = ['EDULIT_DS', 'SCN_DS'];

export const UNESCO_DATASETS: UnescoDataset[] = [
  {
    id: 'EDULIT_DS',
    name: 'Education Literacy',
    description: 'Literacy rates, enrolment ratios, completion rates, out-of-school populations by country',
    updateFrequency: 'annual',
    sdmxUrlTemplate: `${UNESCO_SDMX_BASE_URL}/data/UNESCO,EDULIT_DS,1.0`,
  },
  {
    id: 'SCN_DS',
    name: 'Science, Technology and Innovation',
    description: 'R&D expenditure, researchers, patents, and STI indicators by country',
    updateFrequency: 'annual',
    sdmxUrlTemplate: `${UNESCO_SDMX_BASE_URL}/data/UNESCO,SCN_DS,1.0`,
  },
  {
    id: 'CLT_DS',
    name: 'Culture and Communication',
    description: 'Cultural employment, cultural goods trade, film production, internet access by country',
    updateFrequency: 'annual',
    sdmxUrlTemplate: `${UNESCO_SDMX_BASE_URL}/data/UNESCO,CLT_DS,1.0`,
  },
];

export const UNESCO_TOPICS = {
  [TOPIC_EDUCATION]: {
    code: TOPIC_EDUCATION,
    name: 'Education',
    datasets: ['EDULIT_DS'],
    description: 'Literacy, enrolment, completion, and out-of-school indicators',
  },
  [TOPIC_SCIENCE]: {
    code: TOPIC_SCIENCE,
    name: 'Science, Technology and Innovation',
    datasets: ['SCN_DS'],
    description: 'R&D expenditure, researchers, patents, and innovation indicators',
  },
  [TOPIC_CULTURE]: {
    code: TOPIC_CULTURE,
    name: 'Culture and Communication',
    datasets: ['CLT_DS'],
    description: 'Cultural employment, film production, internet access indicators',
  },
} as const;

export function buildDatasetUrl(
  datasetId: string,
  format: 'json' | 'csv' = 'json',
  countryCode?: string,
): string {
  const dataset = UNESCO_DATASETS.find((d) => d.id === datasetId);
  if (!dataset) {
    throw new Error(`Unknown dataset: ${datasetId}`);
  }
  let url = `${dataset.sdmxUrlTemplate}?format=${format}`;
  if (countryCode) {
    url += `&filter[REF_AREA]=${countryCode}`;
  }
  return url;
}

export function validateDatasetId(datasetId: string): boolean {
  return UNESCO_DATASETS.some((d) => d.id === datasetId);
}
