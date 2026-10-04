/**
 * Fisheries Constants — Quill
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
    id: '1d5c9235-5706-4e8c-a9bf-c6e6a2177117',
    title: 'Status of Major Fish Stocks by Stock Group',
    description: 'Fisheries and Oceans Canada fish stock status reports and assessments.',
  },
  SALMON_CATCH: {
    id: '82c7eaa7-7078-4d38-a880-25d53f00c579',
    title: 'Pacific Region Commercial Salmon Fishery Post-Season Catch Estimates',
    description: 'Salmon fishery catch data by species, region, and year from Fisheries and Oceans Canada.',
  },
  GROUNDFISH: {
    id: 'a278d1af-d567-4964-a109-ae1e84cbd24a',
    title: 'Groundfish Synoptic Bottom Trawl Surveys',
    description: 'Groundfish fishery data including catch, effort, and landings.',
  },
  SHELLFISH: {
    id: '27dfcbf6-d320-4afc-9d0c-3d5df107dbe6',
    title: 'Shellfish and Finfish Transfers to and from BC Aquaculture Sites',
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
    id: '522d1b67-30d8-4a34-9b62-5da99b1035e6',
    title: 'Current Valid BC Aquaculture Licence Holders',
    description: 'Aquaculture licence and production data from Fisheries and Oceans Canada.',
  },
  PRODUCTION: {
    id: '5cfd93bd-b3ee-4b0b-8816-33d388f6811d',
    title: 'DFO Sea Lice Audits of BC Marine Finfish Aquaculture Sites',
    description: 'Canadian aquaculture production and monitoring statistics by species and province.',
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
    id: '90597ca8-b981-4e67-932e-4cac649957a8',
    title: 'Marine Transportation Safety Investigation Reports',
    description: 'Canadian Coast Guard incident response and icebreaking data.',
  },
  SEARCH_RESCUE: {
    id: '0229e2d5-3adc-4305-965e-4ed6d8397cd7',
    title: 'Marine Sectors in Canada — Summaries',
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
    id: 'de446830-8893-11e0-8e61-6cf049291510',
    title: 'Protected Areas',
    description: 'Protected areas including marine protected area boundaries and designations in Canadian waters.',
  },
  OCEANS_SITES: {
    id: '8e8f3aa7-2469-4697-932b-18c6f0b81488',
    title: 'Protected and Conserved Ocean and Coastal Ecosystem Extent',
    description: 'Protected and conserved ocean and coastal ecosystem extent account for Canada.',
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
