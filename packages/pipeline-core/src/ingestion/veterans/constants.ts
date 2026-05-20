/** Veterans Affairs Canada dataset constants — MapleSpike Pipeline */

/** Known VAC CKAN dataset identifiers on open.canada.ca */
export const VAC_DATASETS: Record<string, { id: string; title: string }> = {
  FACTS_FIGURES: {
    id: 'bbc93ab8-3a92-44bd-a7e4-cb9cc40edeb3',
    title: 'VAC Facts and Figures',
  },
  BENEFITS_DATA: {
    id: 'a1450d35-2816-4a2c-8bac-ee1ee74a9738',
    title: 'VAC Benefits by Program',
  },
  DISABILITY_BENEFITS: {
    id: '9d7e0e0a-79df-46ba-ac34-127c398903bc',
    title: 'VAC Disability Benefits Statistics',
  },
  EDUCATION_BENEFITS: {
    id: 'fb0ea072-7b6c-4bea-8e16-e4b6d75b7b17',
    title: 'VAC Education and Training Benefits',
  },
  VETERANS_WAIT_TIMES: {
    id: '8f810399-6380-4cd1-9ad1-0465a8c2a5ac',
    title: 'Veterans Affairs Service Wait Times',
  },
  VETERANS_SUICIDE: {
    id: 'ca32aebb-7d67-4637-a539-4106c2044696',
    title: 'Veterans Suicide Mortality Statistics',
  },
  OSISS_DATA: {
    id: 'ca32aebb-7d67-4637-a539-4106c2044696',
    title: 'OSISS Operational Stress Injury Clinics Data',
  },
  VAC_CASELOAD: {
    id: 'bbc93ab8-3a92-44bd-a7e4-cb9cc40edeb3',
    title: 'VAC Client Caseload Statistics',
  },
};

/** DND / National Defence CKAN datasets related to veterans and personnel */
export const DND_DATASETS: Record<string, { id: string; title: string }> = {
  PERSONNEL: {
    id: '9139319a-9cef-4584-ab4e-6b5f4393ed15',
    title: 'DND Regular Force Personnel by Rank',
  },
  VETERAN_PROGRAMS: {
    id: '12452104-a55c-44a5-b946-718e99f9b7d7',
    title: 'DND Veteran Transition Programs',
  },
  DEFENCE_PROCUREMENT_VETERAN: {
    id: '97518eae-43fe-4c45-ba84-4fae742b2313',
    title: 'Defence Procurement Veteran-related Spending',
  },
  MENTAL_HEALTH: {
    id: 'c6c0a4cd-ff43-406d-b87a-685af02a6815',
    title: 'CAF Mental Health and Wellness Programs',
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

export const CKAN_BASE = 'https://open.canada.ca/data/api/3/action';
export const VETERANS_UA = 'MapleSpike-Veterans/1.0';
export const CULTURE_UA = 'MapleSpike-Veterans/1.0';
export const VETERANS_TIMEOUT_MS = 15_000;
export const MAX_VETERANS_RECORDS = 200;
