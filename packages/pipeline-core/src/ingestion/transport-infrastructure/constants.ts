// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Transport Infrastructure Constants — Quill
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
    id: '3f273148-3aaf-4194-b846-04fbf524e476',
    title: 'Pipeline Transportation Occurrence Data',
    description: 'Transportation Safety Board occurrence data — plane crashes, train derailments, marine incidents.',
  },
  AVIATION_OCCURRENCES: {
    id: 'a376864b-18f2-49d8-9b98-1b7268ffb3c0',
    title: 'Air Occurrence Data from January 1995',
    description: 'Aviation occurrence data from the Transportation Safety Board.',
  },
  MARINE_OCCURRENCES: {
    id: '3bd6b4ac-0050-4cb3-b427-020813a5a8b0',
    title: 'Annual Marine Transportation Occurrences Statistics',
    description: 'Marine occurrence data from the Transportation Safety Board.',
  },
  RAIL_OCCURRENCES: {
    id: '3fe9e5ce-12ab-432e-b74a-aa3c5f82b402',
    title: 'Annual Rail Transportation Occurrences Statistics',
    description: 'Rail occurrence data from the Transportation Safety Board.',
  },
};

export const TC_SAFETY_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  VEHICLE_RECALLS: {
    id: '1ec92326-47ef-4110-b7ca-959fab03f96d',
    title: 'Vehicle Recalls Database',
    description: 'Motor vehicle safety recalls issued by Transport Canada since 1970.',
  },
  CHILD_CAR_SEAT_RECALLS: {
    id: '1991fef6-9dfe-40e2-a0c6-19c60ddf4a02',
    title: 'Vehicle Recalls — Last 60 Days',
    description: 'Child car seat and booster seat safety recalls.',
  },
  TIRE_RECALLS: {
    id: '4901aeb7-1924-4999-aba6-a34666d12f9c',
    title: 'Advisories and Recalls — MedEffect Canada',
    description: 'Tire safety recalls from Transport Canada.',
  },
};

export const CTA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  AIRLINE_RULINGS: {
    id: '44fe9b0d-d730-43cf-ba7e-d952d55f88f2',
    title: 'Algorithmic Impact Assessment — CBSA CARM',
    description: 'Canadian Transportation Agency rulings on air travel complaints and disputes.',
  },
  ACCESSIBILITY_COMPLAINTS: {
    id: '1f93cf5e-07e9-468e-b841-998a66527342',
    title: 'Briefing Package for Standing Committee on Human Resources',
    description: 'Accessibility-related complaints processed by the Canadian Transportation Agency.',
  },
};

export const INFRASTRUCTURE_CANADA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  INVESTING_CANADA: {
    id: '9401f5c7-0787-4261-a99d-ac78c970b73e',
    title: 'Infrastructure Canada Transfer Program Allocations',
    description: 'Infrastructure Canada project funding data by riding, program, and province.',
  },
  GREEN_INFRASTRUCTURE: {
    id: 'e48333e9-aab6-4164-8a7a-8f19c6ae4d38',
    title: 'Systems under Development Audit of Infrastructure Program Projects',
    description: 'Green infrastructure funding data from Infrastructure Canada.',
  },
  RURAL_INFRASTRUCTURE: {
    id: 'a0a5b4f7-611a-4d2a-b201-61ee9b554ffd',
    title: 'Municipal Ownership of Core Infrastructure Assets by Urban and Rural',
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
