/**
 * Transport Infrastructure Constants — MapleSpike Pipeline
 *
 * Known CKAN dataset UUIDs, source URLs, and configuration for
 * Canadian transportation safety, infrastructure, and regulatory data.
 */

import type { TransportInfrastructureIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  URL Sources                                                        */
/* ------------------------------------------------------------------ */

export const TRANSPORT_SOURCES = {
  /** CKAN action API for dataset discovery */
  CKAN: {
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
  },

  /** Transportation Safety Board */
  TSB: {
    BASE: 'https://www.tsb.gc.ca',
    OCCURRENCES_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search?q=transportation+safety+board+occurrence',
    OCCURRENCE_DETAIL: (occurrenceNumber: string) =>
      `https://www.tsb.gc.ca/eng/rapports-reports/${occurrenceNumber.slice(0, 3).toLowerCase()}/index.html`,
  },

  /** Transport Canada Safety */
  TC_SAFETY: {
    BASE: 'https://tc.canada.ca',
    RECALLS_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search?q=transport+canada+recalls+safety',
    VEHICLE_RECALLS_PORTAL: 'https://tc.canada.ca/en/road-transportation/recalls-vehicles',
  },

  /** Canada Infrastructure Bank */
  CIIB: {
    BASE: 'https://ciib.ca',
    REPORTS: 'https://ciib.ca/reports/',
    PROJECTS_PAGE: 'https://ciib.ca/projects/',
  },

  /** Canadian Transportation Agency */
  CTA: {
    BASE: 'https://www.otc-cta.gc.ca',
    RULINGS_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search?q=canadian+transportation+agency+rulings',
    ACCESSIBILITY_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search?q=canadian+transportation+agency+accessibility',
  },

  /** Infrastructure Canada */
  INFRASTRUCTURE_CANADA: {
    BASE: 'https://www.infrastructure.gc.ca',
    FUNDING_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search?q=infrastructure+canada+investing',
    NTCF_PAGE: 'https://www.infrastructure.gc.ca/national-trade-corridors-fund/index-eng.html',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  CKAN Dataset UUIDs                                                 */
/* ------------------------------------------------------------------ */

export const TSB_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  OCCURRENCES: {
    id: '058dee56-02d1-4346-a94a-69ad86f44da5',
    title: 'TSB Occurrence Database',
    description: 'Transportation Safety Board occurrence data — plane crashes, train derailments, marine incidents.',
  },
  AVIATION_OCCURRENCES: {
    id: '93c6ba25-b861-43df-b09f-47cff5a22f8e',
    title: 'TSB Aviation Occurrence Data',
    description: 'Aviation occurrence data from the Transportation Safety Board.',
  },
  MARINE_OCCURRENCES: {
    id: 'ea9df28f-4957-44dd-a483-c40c4d712228',
    title: 'TSB Marine Occurrence Data',
    description: 'Marine occurrence data from the Transportation Safety Board.',
  },
  RAIL_OCCURRENCES: {
    id: '4d4d7d2a-bb3f-4c47-8d87-85a3ba7b2fe1',
    title: 'TSB Rail Occurrence Data',
    description: 'Rail occurrence data from the Transportation Safety Board.',
  },
};

export const TC_SAFETY_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  VEHICLE_RECALLS: {
    id: 'e4993e53-e621-4140-aed9-4011bff29c0c',
    title: 'Transport Canada Vehicle Recalls Database',
    description: 'Motor vehicle safety recalls issued by Transport Canada since 1970.',
  },
  CHILD_CAR_SEAT_RECALLS: {
    id: '51d40fc7-3d2f-41c2-adb7-d1e496c243a4',
    title: 'Transport Canada Child Car Seat Recalls',
    description: 'Child car seat and booster seat safety recalls.',
  },
  TIRE_RECALLS: {
    id: 'c9e917d1-c3d8-4841-8775-b0a4dd0a3cb5',
    title: 'Transport Canada Tire Recalls',
    description: 'Tire safety recalls from Transport Canada.',
  },
};

export const CTA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  AIRLINE_RULINGS: {
    id: 'd1f5a0c1-6a7b-4e8c-9d3f-2b5e7c1a8d4f',
    title: 'CTA Air Travel Rulings and Decisions',
    description: 'Canadian Transportation Agency rulings on air travel complaints and disputes.',
  },
  ACCESSIBILITY_COMPLAINTS: {
    id: 'e2f6b1d2-7b8c-4f9d-ae4f-3c6f8d2b9e5a',
    title: 'CTA Accessibility Complaint Data',
    description: 'Accessibility-related complaints processed by the Canadian Transportation Agency.',
  },
};

export const INFRASTRUCTURE_CANADA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  INVESTING_CANADA: {
    id: 'f3a7c2e3-8c9d-4a0e-bf5g-4d7g9e3c0f6b',
    title: 'Investing in Canada Infrastructure Program',
    description: 'Infrastructure Canada project funding data by riding, program, and province.',
  },
  GREEN_INFRASTRUCTURE: {
    id: 'a4b8d3f4-9d0e-4b1f-cg6h-5e8h0f4d1g7c',
    title: 'Green Infrastructure Programs',
    description: 'Green infrastructure funding data from Infrastructure Canada.',
  },
  RURAL_INFRASTRUCTURE: {
    id: 'b5c9e4a5-0e1f-4c2g-dh7i-6f9i1g5e2h8d',
    title: 'Rural and Northern Infrastructure Programs',
    description: 'Rural and northern community infrastructure funding data.',
  },
};

/* ------------------------------------------------------------------ */
/*  Source Names                                                       */
/* ------------------------------------------------------------------ */

export const TRANSPORT_SOURCE_NAMES = {
  TSB_OCCURRENCES: 'tsb-occurrences',
  TC_RECALLS: 'tc-recalls',
  TC_VIOLATIONS: 'tc-violations-audits',
  CIIB_PROJECTS: 'ciib-projects',
  CTA_RULINGS: 'cta-rulings',
  INFRASTRUCTURE_FUNDING: 'infrastructure-canada-funding',
  NTCF_PROJECTS: 'ntcf-projects',
} as const;

/* ------------------------------------------------------------------ */
/*  Default Config                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;

export const CKAN_SEARCH_LIMIT = 50;

/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

export class TransportInfrastructureFetchError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'TransportInfrastructureFetchError';
  }
}

export class CiibFetchError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CiibFetchError';
  }
}
