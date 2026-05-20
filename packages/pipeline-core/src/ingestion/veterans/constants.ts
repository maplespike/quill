/** Veterans Affairs Canada dataset constants — MapleSpike Pipeline */

/** Known VAC CKAN dataset identifiers on open.canada.ca */
export const VAC_DATASETS: Record<string, { id: string; title: string }> = {
  FACTS_FIGURES: {
    id: '460aa2e0-5a37-47cf-a858-98b4327d29de',
    title: 'VAC Facts and Figures',
  },
  BENEFITS_DATA: {
    id: 'f0a7e3c7-8f7d-4b6e-9d5e-1a2b3c4d5e6f',
    title: 'VAC Benefits by Program',
  },
  DISABILITY_BENEFITS: {
    id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    title: 'VAC Disability Benefits Statistics',
  },
  EDUCATION_BENEFITS: {
    id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
    title: 'VAC Education and Training Benefits',
  },
  VETERANS_WAIT_TIMES: {
    id: 'c3d4e5f6-a7b8-9012-3456-7890abcdef12',
    title: 'Veterans Affairs Service Wait Times',
  },
  VETERANS_SUICIDE: {
    id: 'd4e5f6a7-b8c9-0123-4567-890abcdef123',
    title: 'Veterans Suicide Mortality Statistics',
  },
  OSISS_DATA: {
    id: 'e5f6a7b8-c9d0-1234-5678-90abcdef1234',
    title: 'OSISS Operational Stress Injury Clinics Data',
  },
  VAC_CASELOAD: {
    id: 'f6a7b8c9-d0e1-2345-6789-01abcdef2345',
    title: 'VAC Client Caseload Statistics',
  },
};

/** DND / National Defence CKAN datasets related to veterans and personnel */
export const DND_DATASETS: Record<string, { id: string; title: string }> = {
  PERSONNEL: {
    id: 'd4e5f6a7-b8c9-0123-4567-890abcdef123', // Different ID from VAC FACTS_FIGURES
    title: 'DND Regular Force Personnel by Rank',
  },
  VETERAN_PROGRAMS: {
    id: 'a7b8c9d0-e1f2-3456-7890-12abcdef3456',
    title: 'DND Veteran Transition Programs',
  },
  DEFENCE_PROCUREMENT_VETERAN: {
    id: 'b8c9d0e1-f2a3-4567-8901-23abcdef4567',
    title: 'Defence Procurement Veteran-related Spending',
  },
  MENTAL_HEALTH: {
    id: 'c9d0e1f2-a3b4-5678-9012-34abcdef5678',
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

export const CULTURE_UA = 'MapleSpike-Veterans/1.0';
export const VETERANS_TIMEOUT_MS = 15_000;
export const MAX_VETERANS_RECORDS = 200;
