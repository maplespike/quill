/**
 * Fisheries Constants — MapleSpike Pipeline
 *
 * CKAN dataset IDs, search URLs, and configuration for Canadian
 * fisheries and oceans data sources.
 *
 * Sources:
 *   - Fisheries & Oceans Canada (DFO) fish stocks
 *   - DFO salmon fishery catch data
 *   - Aquaculture licensing and production
 *   - Canadian Coast Guard incidents and icebreaking
 *   - Marine protected areas
 */

/* ------------------------------------------------------------------ */
/*  CKAN Action API Base                                              */
/* ------------------------------------------------------------------ */

export const CKAN_API = {
  SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
  SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
} as const;

/* ------------------------------------------------------------------ */
/*  DFO — Fisheries & Oceans Canada                                    */
/* ------------------------------------------------------------------ */

export const DFO_SEARCH_QUERIES = {
  FISH_STOCKS: 'fisheries+oceans+stock+status+fish',
  SALMON: 'salmon+fishery+catch',
  GROUNDFISH: 'groundfish+fishery+canada',
  SHELLFISH: 'shellfish+fishery+canada',
} as const;

export const DFO_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  FISH_STOCKS: {
    id: 'e4f5a6b7-8c9d-0e1f-2a3b-4c5d6e7f8a9b',
    title: 'DFO Fish Stock Status',
    description: 'Fisheries and Oceans Canada fish stock status reports and assessments.',
  },
  SALMON_CATCH: {
    id: 'f5a6b7c8-9d0e-1f2a-3b4c-5d6e7f8a9b0c',
    title: 'DFO Salmon Fishery Catch Data',
    description: 'Salmon fishery catch data by species, region, and year from Fisheries and Oceans Canada.',
  },
  GROUNDFISH: {
    id: 'a6b7c8d9-0e1f-2a3b-4c5d-6e7f8a9b0c1d',
    title: 'DFO Groundfish Fishery Data',
    description: 'Groundfish fishery data including catch, effort, and landings.',
  },
  SHELLFISH: {
    id: 'b7c8d9e0-1f2a-3b4c-5d6e-7f8a9b0c1d2e',
    title: 'DFO Shellfish Fishery Data',
    description: 'Shellfish fishery data including lobster, crab, and shrimp landings.',
  },
};

/* ------------------------------------------------------------------ */
/*  Aquaculture                                                        */
/* ------------------------------------------------------------------ */

export const AQUACULTURE_QUERIES = {
  LICENCES: 'aquaculture+licence+production',
  PRODUCTION: 'aquaculture+production+canada',
  FINFISH: 'aquaculture+finfish+canada',
} as const;

export const AQUACULTURE_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  LICENCES: {
    id: 'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
    title: 'Aquaculture Licences and Production',
    description: 'Aquaculture licence and production data from Fisheries and Oceans Canada.',
  },
  PRODUCTION: {
    id: 'd9e0f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a',
    title: 'Canadian Aquaculture Production',
    description: 'Canadian aquaculture production statistics by species and province.',
  },
};

/* ------------------------------------------------------------------ */
/*  Canadian Coast Guard                                               */
/* ------------------------------------------------------------------ */

export const COAST_GUARD_QUERIES = {
  INCIDENTS: 'coast+guard+incidents+icebreaking',
  SEARCH_RESCUE: 'coast+guard+search+rescue+canada',
  ICEBREAKING: 'coast+guard+icebreaking+operations',
} as const;

export const COAST_GUARD_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  INCIDENTS: {
    id: 'e0f1a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
    title: 'Canadian Coast Guard Incidents',
    description: 'Canadian Coast Guard incident response and icebreaking data.',
  },
  SEARCH_RESCUE: {
    id: 'f1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    title: 'CCG Search and Rescue Data',
    description: 'Canadian Coast Guard search and rescue statistics and operations.',
  },
};

/* ------------------------------------------------------------------ */
/*  Marine Protected Areas                                             */
/* ------------------------------------------------------------------ */

export const MPA_QUERIES = {
  MARINE_PROTECTED: 'marine+protected+area+ocean',
  OCEANS: 'oceans+conservation+canada',
} as const;

export const MPA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  MARINE_AREAS: {
    id: 'a2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    title: 'Marine Protected Areas',
    description: 'Marine protected area boundaries and designations in Canadian waters.',
  },
  OCEANS_SITES: {
    id: 'b3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e',
    title: 'Oceans Act Marine Protected Areas',
    description: 'Marine protected areas designated under the Oceans Act.',
  },
};

/* ------------------------------------------------------------------ */
/*  Source Names                                                       */
/* ------------------------------------------------------------------ */

export const FISHERIES_SOURCE_NAMES = {
  DFO_FISH_STOCKS: 'dfo-fish-stocks',
  DFO_SALMON: 'dfo-salmon-catch',
  DFO_GROUNDFISH: 'dfo-groundfish',
  DFO_SHELLFISH: 'dfo-shellfish',
  AQUACULTURE: 'aquaculture',
  COAST_GUARD: 'coast-guard-incidents',
  MARINE_PROTECTED_AREAS: 'marine-protected-areas',
} as const;

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;
export const CKAN_SEARCH_LIMIT = 50;
export const REQUEST_TIMEOUT_MS = 30_000;
