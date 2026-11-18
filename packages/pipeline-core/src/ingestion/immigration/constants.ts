// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Immigration & Refugee Constants — Quill
 *
 * Known CKAN dataset UUIDs and IRCC open data URLs for
 * immigration, refugee, and border enforcement data.
 *
 * File naming convention:
 *   EN_ODP-{scope}-{category}.{ext}
 *   ODP-{scope}-{detail}.csv  (rounded, not for calculations)
 */

import type { ImmigrationIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  URL Sources                                                        */
/* ------------------------------------------------------------------ */

export const IMMIGRATION_SOURCES = {
  /** IRCC Open Data Portal base */
  IRCC_OPENDATA: {
    BASE: 'https://www.ircc.canada.ca/opendata-donneesouvertes/data/',
    /** CSV pattern — rounded, not for calculations */
    CSV: (name: string) => `https://www.ircc.canada.ca/opendata-donneesouvertes/data/${name}.csv`,
    /** XLSX pattern */
    XLSX: (name: string) => `https://www.ircc.canada.ca/opendata-donneesouvertes/data/${name}.xlsx`,
  },

  /** CKAN action API for dataset discovery */
  CKAN: {
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
  },

  /** IRB decisions portal */
  IRB: {
    BASE: 'https://irb-cisr.gc.ca',
    /** RPD decisions on open.canada.ca */
    RPD_DECISIONS_CKAN: 'https://open.canada.ca/data/en/dataset/6e47f705-71ed-41f0-8fd5-d1a8508a3b63',
    /** IRB main page */
    HOME: 'https://irb-cisr.gc.ca/en/Pages/index.aspx',
  },

  /** CBSA open data */
  CBSA: {
    BASE: 'https://www.cbsa-asfc.gc.ca',
    /** AMPS (Administrative Monetary Penalty System) stats */
    AMPS_DATA: 'https://www.cbsa-asfc.gc.ca/data/amps-rsap-2012-01--2014-06.csv',
    /** Privacy stats */
    PRIVACY_DATA: 'https://www.cbsa-asfc.gc.ca/data/privacy-prp-2016-2017-en.zip',
    /** ATI stats */
    ATI_DATA: 'https://www.cbsa-asfc.gc.ca/data/ati-aai-2016-2017-en.zip',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  CKAN Dataset UUIDs                                                 */
/* ------------------------------------------------------------------ */

export const IRCC_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  /** Permanent resident admissions — monthly updates, 52 resources */
  PERMANENT_RESIDENTS: {
    id: 'f7e5498e-0ad8-4417-85c9-9b8aff9b9eda',
    title: 'Permanent Residents – Monthly IRCC Updates',
    description: 'Permanent resident admissions by province/territory, immigration category, country of citizenship. 52 resource files including CSV and XLSX.',
  },
  /** Express Entry PR — monthly, 20 resources */
  EXPRESS_ENTRY_PR: {
    id: '52e4b14b-597a-4ecf-a184-23a6e69b0d57',
    title: 'Express Entry Permanent Residents – Monthly IRCC Updates',
    description: 'Express Entry admissions by gender, province/territory, program, country. 20+ resources.',
  },
  /** Permanent residents — ad hoc historical datasets */
  PERMANENT_RESIDENTS_ADHOC: {
    id: 'ad975a26-df23-456a-8ada-756191a23695',
    title: 'Permanent Residents – Ad Hoc IRCC (Specialized Datasets)',
    description: 'Historical permanent resident data back to 1980. 47+ resources including admissions by category and country of citizenship.',
  },
  /** Study permit holders — monthly, 30 resources */
  STUDY_PERMIT_HOLDERS: {
    id: '90115b00-f9b8-49e8-afa3-b4cff8facaee',
    title: 'Temporary Residents: Study Permit Holders – Monthly IRCC Updates',
    description: 'Study permit holders by province/territory, country of citizenship, institution type. 30+ resources.',
  },
  /** Work permit holders — TFWP and IMP, monthly, 51 resources */
  WORK_PERMIT_HOLDERS: {
    id: '360024f2-17e9-4558-bfc1-3616485d65b9',
    title: 'Temporary Residents: TFWP and IMP Work Permit Holders – Monthly IRCC Updates',
    description: 'Work permit holders under TFWP and IMP by NOC, province, country. 51 resources.',
  },
  /** Work permit holders — ad hoc specialized */
  WORK_PERMIT_ADHOC: {
    id: '67fd1fae-4950-4018-a491-62e60cbd6974',
    title: 'Temporary Residents: Work Permit Holders – Ad Hoc IRCC',
    description: 'Specialized work permit datasets. 40 resources.',
  },
  /** Temporary to Permanent Residence transition */
  TR_TO_PR: {
    id: '1b026aab-edb3-4d5d-8231-270a09ed4e82',
    title: 'Transition from Temporary Resident to Permanent Resident Status',
    description: 'TR to PR pathway transitions. 12 resources.',
  },
  /** PR card processing */
  PR_CARDS: {
    id: '6bbf2f43-b9d5-49a0-aa8f-71e433340505',
    title: 'Permanent Resident Cards – Quarterly IRCC Updates',
    description: 'PR card application volumes, approvals. 2 resources.',
  },
  /** Temporary Resident Visa processing */
  TRV_PROCESSING: {
    id: '6cba99b1-ea2c-4f8a-b954-3843ecd3a7f0',
    title: 'Algorithmic Impact Assessment - TRV Applications',
    description: 'Automated TRV triage AI assessment data.',
  },
  /** Family sponsorship */
  FAMILY_SPONSORSHIP: {
    id: 'f95dbd40-1236-428c-acd1-25b7559686be',
    title: 'Family Class Spouses and Partners Overseas Applications',
    description: 'Spousal sponsorship applications, processing times, volumes.',
  },
};

export const IRB_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  RPD_DECISIONS: {
    id: '6e47f705-71ed-41f0-8fd5-d1a8508a3b63',
    title: 'Refugee Protection Division (RPD) Decisions',
    description: 'Quarterly RPD decisions by country of origin, outcome, language, representation. CSV format quarterly updates.',
  },
  RPD_HISTORICAL: {
    id: 'bf181c11-8c67-4b98-a002-c0f016b2e43c',
    title: 'RPD Decisions 1997-2021 by Outcome and Province',
    description: 'Historical RPD decision data covering 1997-2021 aggregated by outcome and province.',
  },
};

export const CBSA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  AMPS: {
    id: '86d88f96-2a6f-435f-82cd-1c427f7641ff',
    title: 'National Administrative Monetary Penalty System Statistics',
    description: 'CBSA monetary penalties by violation type and year.',
  },
  PRIVACY: {
    id: 'c3578490-56fc-46a2-8f6e-518c09acb69b',
    title: 'CBSA Privacy – Annual Statistics',
    description: 'CBSA privacy-related data requests and actions.',
  },
};

/* ------------------------------------------------------------------ */
/*  IRCC Open Data CSV File Names (BY SCOPE)                           */
/* ------------------------------------------------------------------ */

/**
 * Known IRCC open data CSV patterns.
 * These are the rounded CSV files (not for calculations but fine for trend tracking).
 */
export const IRCC_CSV_FILES = {
  /** Permanent residents by province/territory and immigration category */
  PR_PROV_IMMCAT: 'ODP-PR-PT_IMMCAT',
  /** Permanent residents by country of citizenship */
  PR_PROV_CITIZEN: 'ODP-PR-PT_CITIZ',
  /** Permanent residents by gender and province */
  PR_GENDER_PROV: 'ODP-PR-PT_Gender',
  /** Permanent residents by age and province */
  PR_AGE_PROV: 'ODP-PR-PT_Age',
  /** Express Entry admissions by gender and province */
  EE_GENDER_PROV: 'ODP-EE_admissions-gender',
  /** Express Entry admissions by program and province */
  EE_PROGRAM_PROV: 'ODP-EE_admissions-program',
  /** Study permit holders by province and citizenship */
  STUDY_PROV_CITIZ: 'ODP-TR-Study-PT_CITZ',
  /** Study permit holders by institution and citizenship */
  STUDY_IS_CITIZ: 'ODP-TR-Study-IS_CITZ',
  /** Work permit holders (IMP) by province and NOC */
  WORK_IMP_PROV_NOC: 'ODP-TR-Work-IMP-PT_NOC4',
  /** Work permit holders (TFWP) by province and NOC */
  WORK_TFWP_PROV_NOC: 'ODP-TR-Work-TFWP-PT_NOC4',
  /** TR to PR transition by province and category */
  TR_PR_PROV_CAT: 'ODP-TR_to_PR-PT_IMMCAT',
} as const;

/* ------------------------------------------------------------------ */
/*  IRB CSV Files (per quarter)                                        */
/* ------------------------------------------------------------------ */

/**
 * Build the URL for a quarterly RPD decisions CSV.
 * Pattern: RPD_Decisions_YYYYQ1_EN.csv
 */
export function rpdDecisionsUrl(year: number, quarter: number): string {
  const q = `Q${quarter}`;
  return `https://irb-cisr.gc.ca/en/transparency/rpd-statistics/Documents/RPD_Decisions_${year}${q}_EN.csv`;
}

/* ------------------------------------------------------------------ */
/*  Default Config                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;

export const IMMIGRATION_SOURCE_NAMES = {
  PERMANENT_RESIDENTS: 'ircc-permanent-residents',
  EXPRESS_ENTRY: 'ircc-express-entry',
  STUDY_PERMITS: 'ircc-study-permits',
  WORK_PERMITS: 'ircc-work-permits',
  RPD_DECISIONS: 'irb-rpd-decisions',
  CBSA_AMPS: 'cbsa-amps',
} as const;

/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

export class ImmigrationFetchError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'ImmigrationFetchError';
  }
}
