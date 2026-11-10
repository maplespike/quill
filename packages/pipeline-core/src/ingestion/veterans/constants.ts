// SPDX-License-Identifier: AGPL-3.0-only
/** Veterans Affairs Canada dataset constants — Quill */

/** Known VAC CKAN dataset identifiers on open.canada.ca */
export const VAC_DATASETS: Record<string, { id: string; title: string }> = {
  FACTS_FIGURES: {
    id: '460aa2e0-5a37-47cf-a858-98b4327d29de',
    title: 'VAC Facts and Figures',
  },
  BENEFITS_DATA: {
    id: '9d7e0e0a-79df-46ba-ac34-127c398903bc',
    title: 'VAC Evaluation of Disability Benefits',
  },
  DISABILITY_BENEFITS: {
    id: '9d7e0e0a-79df-46ba-ac34-127c398903bc',
    title: 'VAC Disability Benefits Evaluation',
  },
  EDUCATION_BENEFITS: {
    id: 'fb0ea072-7b6c-4bea-8e16-e4b6d75b7b17',
    title: 'VAC Education and Training Benefit Policy',
  },
  VETERANS_WAIT_TIMES: {
    id: '8f810399-6380-4cd1-9ad1-0465a8c2a5ac',
    title: 'VAC Wait Time Tool',
  },
  VETERANS_SUICIDE: {
    id: 'fb739176-4bca-4a24-9046-5bb164041e15',
    title: 'CAF Suicide Standardized Mortality Ratios',
  },
  OSISS_DATA: {
    id: '6122e674-58a4-424c-8801-dadcc30dd5c7',
    title: 'VAC OSI Treatment Clinic Evaluation',
  },
  VAC_CASELOAD: {
    id: 'bbc93ab8-3a92-44bd-a7e4-cb9cc40edeb3',
    title: 'VAC Facts and Figures — Client Statistics',
  },
};

/** DND / National Defence CKAN datasets related to veterans and personnel */
export const DND_DATASETS: Record<string, { id: string; title: string }> = {
  PERSONNEL: {
    id: 'fa39335d-9524-4592-9ce7-88845d1c896e',
    title: 'DND Military Personnel Seasonally Adjusted',
  },
  VETERAN_PROGRAMS: {
    id: '7f59c976-3bd5-48f4-93b6-6f1853be8e16',
    title: 'DND Transition Material 2019',
  },
  DEFENCE_PROCUREMENT_VETERAN: {
    id: 'd25c25c4-4964-489a-9dff-9f9a26c759b6',
    title: 'DND Supplementary Estimates (C) Binder',
  },
  MENTAL_HEALTH: {
    id: '73b4caf6-5b0a-46c0-ba8b-1ed878074e5a',
    title: 'Injury in Review — Traumatic Brain Injuries Across the Life Course',
  },
};

/** OSISS — Operational Stress Injury clinics */
export const OSISS_BASE_URL = 'https://www.veterans.gc.ca/eng/health-support/mental-health-and-wellness';
export const OSISS_CLINICS_URL = 'https://www.veterans.gc.ca/eng/health-support/mental-health-and-wellness/operational-stress-injury-clinics';

/** Veterans suicide prevention — VAC research */
export const VETERANS_SUICIDE_BASE = 'https://www.veterans.gc.ca/eng/about-vac/research';
export const VETERANS_SUICIDE_STATS_URL = 'https://www.veterans.gc.ca/eng/about-vac/research/suicide-mortality-study';

/** VAC benefits web page */
export const VAC_BENEFITS_URL = 'https://www.veterans.gc.ca/eng/financial-support';
export const VAC_DISABILITY_URL = 'https://www.veterans.gc.ca/eng/financial-support/disability-benefits';

/** DND transition programs */
export const DND_TRANSITION_URL = 'https://www.canada.ca/en/department-national-defence/services/benefits-military.html';
export const DND_PROCUREMENT_URL = 'https://www.tpsgc-pwgsc.gc.ca/ci-if/contracting-eng.html';

/** VAC search by program category */
export const VAC_PROGRAM_CATEGORIES = [
  'Disability Benefits',
  'Education and Training',
  'Career Transition Services',
  'Health and Wellness',
  'Financial Support',
  'Veterans Independence Program',
  'Long Term Care',
  'Mental Health Services',
  'OSISS Clinics',
  'Family Support',
  'Bereavement Benefits',
  'Veterans Emergency Fund',
];

export const VETERANS_SOURCE = {
  name: 'Veterans Affairs Canada',
  baseUrl: 'https://open.canada.ca/data/api/3/action/package_show',
  ckanDataset: 'vac-benefits',
};

export const CULTURE_UA = 'MapleSpike-Veterans/1.0';
export const VETERANS_TIMEOUT_MS = 15_000;
export const MAX_VETERANS_RECORDS = 200;
