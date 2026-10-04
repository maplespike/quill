/**
 * Criminal Justice Constants — Quill
 *
 * Known CKAN dataset UUIDs, open data URLs, and StatCan table identifiers
 * for Canadian criminal justice data sources:
 *   - CSC (Correctional Service Canada)
 *   - Parole Board of Canada
 *   - RCMP crime statistics
 *   - PPSC (Public Prosecution Service of Canada)
 *   - Youth criminal justice (StatCan)
 *   - Legal aid (StatCan / open.canada.ca)
 *
 * File naming convention for CSC open data:
 *   CSC_XXX_EN (CSV patterns vary by year)
 */

import type { CriminalJusticeIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  URL Sources                                                        */
/* ------------------------------------------------------------------ */

export const CRIMINAL_JUSTICE_SOURCES = {
  /** CKAN action API */
  CKAN: {
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
  },

  /** CSC Open Data */
  CSC: {
    BASE: 'https://www.csc-scc.gc.ca',
    /** Population data (institutional) */
    POPULATION: 'https://www.csc-scc.gc.ca/opendata/opendata-population-en.shtml',
    /** Incidents data */
    INCIDENTS: 'https://www.csc-scc.gc.ca/opendata/opendata-incidents-en.shtml',
    /** Deaths in custody */
    DEATHS: 'https://www.csc-scc.gc.ca/opendata/opendata-deaths-en.shtml',
    /** Costs per inmate */
    COSTS: 'https://www.csc-scc.gc.ca/opendata/opendata-costs-en.shtml',
    /** CSC CKAN base for package search */
    CKAN_PACKAGE_PREFIX: 'correctional-service-canada',
  },

  /** Parole Board of Canada */
  PAROLE: {
    BASE: 'https://www.canada.ca/en/parole-board.html',
    /** CKAN dataset for parole decisions */
    DECISIONS_CKAN: 'https://open.canada.ca/data/en/dataset/parole-board-canada-decisions',
  },

  /** RCMP */
  RCMP: {
    BASE: 'https://www.rcmp-grc.gc.ca',
    /** Hate crimes data */
    HATE_CRIMES: 'https://www.rcmp-grc.gc.ca/opendata/od-index-en.shtml',
    /** Organized crime */
    ORGANIZED_CRIME: 'https://www.rcmp-grc.gc.ca/opendata/od-index-en.shtml',
  },

  /** PPSC */
  PPSC: {
    BASE: 'https://www.ppsc-sppc.gc.ca',
    /** Annual reports page */
    ANNUAL_REPORTS: 'https://www.ppsc-sppc.gc.ca/eng/pub/ar-ra/',
  },

  /** StatCan — accessed via WDS (Web Data Service) */
  STATCAN_WDS: {
    /** WDS base URL */
    BASE: 'https://www150.statcan.gc.ca/t1/wds/rest',
    /** Get data from a specific table by PID */
    GET_DATA: 'https://www150.statcan.gc.ca/t1/wds/rest/getData',
    /** Search cubes */
    SEARCH: 'https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV',
  },

  /** StatCan tables directly accessible */
  STATCAN: {
    /** Legal aid — Table 35-10-0076-01 (Legal aid plan caseload and expenditures) */
    LEGAL_AID_CASELOAD: '35-10-0076-01',
    /** Youth courts — Table 35-10-0023-01 (Youth courts, cases by type of decision) */
    YOUTH_COURTS: '35-10-0023-01',
    /** Adult custody and community supervision — Table 35-10-0002-01 */
    ADULT_CUSTODY: '35-10-0002-01',
    /** Crime severity index — Table 35-10-0026-01 */
    CRIME_SEVERITY: '35-10-0026-01',
    /** Hate crime — Table 35-10-0170-01 */
    HATE_CRIME: '35-10-0170-01',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  CKAN Dataset UUIDs                                                 */
/* ------------------------------------------------------------------ */

export const CSC_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  POPULATION: {
    id: 'e29f7b5d-f550-4516-9b43-ce8b794fefda',
    title: 'Correctional Service Canada — Quarterly Financial Reports',
    description: 'CSC quarterly financial reports covering institutional and community operations. Updated quarterly.',
  },
  INCIDENTS: {
    id: '9c6efa61-50ae-479f-9d32-6bbe2ba33d64',
    title: 'Correctional Service Canada — Departmental Plan 2026-2027',
    description: 'CSC departmental plan including operational priorities and statistical indicators. Updated annually.',
  },
  DEATHS: {
    id: 'bd085e2c-81d8-4d2f-a203-90d5662209a1',
    title: 'Deaths in Custody',
    description: 'Deaths in federal custody by cause, gender, and age. Updated annually.',
  },
  COST_PER_INMATE: {
    id: '94886f32-f287-478d-b344-34f76751f45f',
    title: 'Correctional Service Canada — Departmental Results Report 2024-2025',
    description: 'CSC departmental results including cost per inmate by security level and institution type.',
  },
};

export const PAROLE_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  DECISIONS: {
    id: '4a89da75-ebd6-4c17-b993-46891b256b8a',
    title: 'Parole Board of Canada — Open Government Implementation Plan',
    description: 'Parole Board open government plan including decision statistics and reporting commitments.',
  },
  PSC_DECISIONS: {
    id: '196e8604-fbf6-4282-8831-1665c61e32fd',
    title: 'Parole Board of Canada — Annual Report on the Privacy Act',
    description: 'Annual report to Parliament covering Privacy Act administration and data handling.',
  },
};

export const RCMP_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  HATE_CRIMES: {
    id: 'c330ddb1-4589-45c1-9ce4-40e026054803',
    title: 'Police-Reported Hate Crime by Police Service',
    description: 'Police-reported hate crime incidents by motivation type and jurisdiction. Updated annually.',
  },
  CRIME_SEVERITY: {
    id: '1b92c723-a415-4230-b73a-712fa273ff16',
    title: 'Crime Severity Index and Weighted Clearance Rates',
    description: 'Crime Severity Index by jurisdiction, including violent and non-violent components.',
  },
  ORGANIZED_CRIME: {
    id: 'cb47e6fe-434c-46d6-831f-7bbdc393dd97',
    title: 'Police-Reported Crime Statistics',
    description: 'Police-reported crime data including homicide and organized crime indicators.',
  },
};

export const PPSC_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  CASELOADS: {
    id: 'f034c9d0-cca8-4dee-b555-c2074f342f9a',
    title: 'PPSC — Annual Report',
    description: 'Federal prosecution caseload statistics by court level and file type.',
  },
  OUTCOMES: {
    id: '4b35e5ab-34b9-4437-8b62-fb0197dae2e2',
    title: 'PPSC — Departmental Results Report',
    description: 'Outcomes of federal prosecutions including stays, stays by delay (Jordan), convictions, acquittals.',
  },
};

export const YOUTH_JUSTICE_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  COURTS: {
    id: '1df8b66e-b773-425e-9551-62eba71bab28',
    title: 'Youth Courts — Cases by Type of Decision',
    description: 'Youth court cases by province, type of decision, and sentence.',
  },
  CORRECTIONS: {
    id: 'c70a73e6-e42d-4e2a-91e3-6c0d41568952',
    title: 'Youth Admissions to Correctional Services',
    description: 'Youth admissions to correctional services by province, type, and characteristics.',
  },
};

export const LEGAL_AID_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  FUNDING: {
    id: '5dbf8583-cda4-4bb4-8419-3793311af3a2',
    title: 'Legal Aid — Plan Expenditures by Type',
    description: 'Legal aid plan expenditures by type of expenditure, province and case type.',
  },
};

/* ------------------------------------------------------------------ */
/*  StatCan PID References (for WDS-based fetchers)                    */
/* ------------------------------------------------------------------ */

export const STATCAN_PIDS: Record<string, string> = {
  ADULT_CUSTODY: '3510000201',
  YOUTH_COURTS: '3510002301',
  CRIME_SEVERITY_INDEX: '3510002601',
  HATE_CRIME: '3510017001',
  LEGAL_AID: '3510007601',
};

/* ------------------------------------------------------------------ */
/*  Default Config                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;

export const CRIMINAL_JUSTICE_SOURCE_NAMES = {
  CSC_POPULATION: 'csc-population',
  CSC_INCIDENTS: 'csc-incidents',
  CSC_DEATHS: 'csc-deaths',
  CSC_COSTS: 'csc-costs',
  PAROLE_DECISIONS: 'parole-decisions',
  RCMP_HATE_CRIMES: 'rcmp-hate-crimes',
  RCMP_CRIME_SEVERITY: 'rcmp-crime-severity',
  RCMP_ORGANIZED_CRIME: 'rcmp-organized-crime',
  PPSC_CASELOADS: 'ppsc-caseloads',
  PPSC_OUTCOMES: 'ppsc-outcomes',
  YOUTH_JUSTICE: 'youth-justice',
  LEGAL_AID_FUNDING: 'legal-aid-funding',
} as const;

/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

export class CriminalJusticeFetchError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CriminalJusticeFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a CKAN package search URL for criminal justice datasets */
export function ckanSearchUrl(query: string, rows = 100): string {
  return `${CRIMINAL_JUSTICE_SOURCES.CKAN.SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}`;
}

/** Build a CKAN package show URL */
export function ckanPackageUrl(packageId: string): string {
  return `${CRIMINAL_JUSTICE_SOURCES.CKAN.SHOW}?id=${packageId}`;
}
