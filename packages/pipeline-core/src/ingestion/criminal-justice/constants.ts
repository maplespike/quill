/**
 * Criminal Justice Constants — MapleSpike Pipeline
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
    id: '3c2fdb37-73f1-41c6-a55b-ede3c35fbf1b',
    title: 'Correctional Service Canada — Offender Population',
    description: 'Institutional and community offender population counts by region, institution, security level, and gender. Updated quarterly.',
  },
  INCIDENTS: {
    id: 'b3a4f5a5-68f4-4d2e-b1c6-3a4e5f6a7b8c',
    title: 'Correctional Service Canada — Institutional Incidents',
    description: 'Institutional incidents including assaults, drug seizures, and escapes. Updated annually.',
  },
  DEATHS: {
    id: 'c4d5e6f7-12a3-4b56-890c-d7e8f9a0b1c2',
    title: 'Correctional Service Canada — Deaths in Custody',
    description: 'Deaths in federal custody by cause, gender, and age. Updated annually.',
  },
  COST_PER_INMATE: {
    id: 'd5e6f7a8-34b5-4c67-890d-e1f2a3b4c5d6',
    title: 'Correctional Service Canada — Cost per Inmate',
    description: 'Average annual cost per inmate by security level and institution type.',
  },
};

export const PAROLE_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  DECISIONS: {
    id: 'e6f7a8b9-56c7-4d89-901e-f2a3b4c5d6e7',
    title: 'Parole Board of Canada — Grant/Deny Rates',
    description: 'Parole decisions by type, offence category, and region. Updated quarterly.',
  },
  PSC_DECISIONS: {
    id: 'f7a8b9c0-78d9-4e01-012f-3a4b5c6d7e8f',
    title: 'Parole Board of Canada — Provincial/Territorial Parole',
    description: 'Provincial and territorial parole board statistics.',
  },
};

export const RCMP_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  HATE_CRIMES: {
    id: 'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    title: 'RCMP — Police-Reported Hate Crime Data',
    description: 'Police-reported hate crime incidents by motivation type and jurisdiction. Updated annually.',
  },
  CRIME_SEVERITY: {
    id: 'b2c3d4e5-6f7a-8901-bcde-f12345678901',
    title: 'RCMP — Crime Severity Index',
    description: 'Crime Severity Index by jurisdiction, including violent and non-violent components.',
  },
  ORGANIZED_CRIME: {
    id: 'c3d4e5f6-7a8b-9012-cdef-123456789012',
    title: 'RCMP — Organized Crime Statistics',
    description: 'Police-reported organized crime incidents by type and jurisdiction.',
  },
};

export const PPSC_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  CASELOADS: {
    id: 'd4e5f6a7-8b9c-0123-defa-234567890123',
    title: 'PPSC — Caseload Statistics',
    description: 'Federal prosecution caseload statistics by court level and file type.',
  },
  OUTCOMES: {
    id: 'e5f6a7b8-9c0d-1234-efab-345678901234',
    title: 'PPSC — Prosecution Outcomes',
    description: 'Outcomes of federal prosecutions including stays, stays by delay (Jordan), convictions, acquittals.',
  },
};

export const YOUTH_JUSTICE_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  COURTS: {
    id: 'f6a7b8c9-0d1e-2345-fabc-456789012345',
    title: 'Youth Criminal Justice — Court Cases',
    description: 'Youth court cases by province, type of decision, and sentence.',
  },
  CORRECTIONS: {
    id: 'a7b8c9d0-1e2f-3456-abcd-567890123456',
    title: 'Youth Corrections — Admissions to Custody and Community Services',
    description: 'Youth admissions to correctional services by province, type, and characteristics.',
  },
};

export const LEGAL_AID_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  FUNDING: {
    id: 'b8c9d0e1-2f3a-4567-bcde-678901234567',
    title: 'Legal Aid — Caseload and Expenditures',
    description: 'Legal aid plan caseload and expenditures by province and case type.',
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
