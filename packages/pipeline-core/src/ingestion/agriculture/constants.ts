/**
 * Agriculture Constants — MapleSpike Pipeline
 *
 * CKAN dataset IDs, search URLs, and configuration for Canadian
 * agriculture data sources.
 *
 * Sources:
 *   - Agriculture & Agri-Food Canada (AAFC)
 *   - Canadian Dairy Commission / Poultry
 *   - CFIA (Canadian Food Inspection Agency)
 *   - Canadian Grain Commission
 *   - Farm Credit Canada (HTML annual reports)
 */

/* ------------------------------------------------------------------ */
/*  CKAN Action API Base                                              */
/* ------------------------------------------------------------------ */

export const CKAN_API = {
  SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
  SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
} as const;

/* ------------------------------------------------------------------ */
/*  AAFC — Agriculture & Agri-Food Canada                              */
/* ------------------------------------------------------------------ */

export const AAFC_SEARCH_QUERIES = {
  CROPS_LIVESTOCK: 'agriculture+agri-food+crops+livestock',
  CROPS: 'aafc+crops+production',
  LIVESTOCK: 'aafc+livestock+production',
  FARM_INCOME: 'aafc+farm+income+statistics',
  PRICES: 'aafc+crop+prices+market',
} as const;

export const AAFC_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  CROPS: {
    id: 'c29e4c8b-4e5f-4b8a-9c1d-7e8f2a3b4c5d',
    title: 'AAFC Crops Production Data',
    description: 'Crop production data from Agriculture and Agri-Food Canada including area, yield, and production by commodity and province.',
  },
  LIVESTOCK: {
    id: 'd3a5d9c-5f6a-4c9b-ad2e-8f9g3b4c5d6e',
    title: 'AAFC Livestock Production Data',
    description: 'Livestock and poultry production data including inventory, slaughter, and meat production.',
  },
  FARM_INCOME: {
    id: 'e4b6e0d-6a7b-4d0a-be3f-9a0h4c5d6e7f',
    title: 'AAFC Farm Income Statistics',
    description: 'Farm cash receipts, realized net income, and government payments by province.',
  },
};

/* ------------------------------------------------------------------ */
/*  Canadian Dairy Commission / Poultry                                */
/* ------------------------------------------------------------------ */

export const DAIRY_POULTRY_QUERIES = {
  DAIRY: 'canadian+dairy+commission+poultry',
  POULTRY: 'poultry+supply+management+canada',
  QUOTA: 'dairy+poultry+quota+canada',
} as const;

export const DAIRY_POULTRY_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  DAIRY_PRODUCTION: {
    id: 'f5c7f1e-7b8c-4e1a-cf4g-0b1i5d6e7f8a',
    title: 'Dairy Production and Statistics',
    description: 'Canadian dairy production, milk shipments, butter and cheese production from the Canadian Dairy Commission.',
  },
  POULTRY: {
    id: 'a6d8a2f-8c9d-4f2a-dg5h-1c2j6e7f8g9b',
    title: 'Poultry and Egg Production',
    description: 'Poultry and egg production data including supply-managed commodities.',
  },
};

/* ------------------------------------------------------------------ */
/*  CFIA — Canadian Food Inspection Agency                             */
/* ------------------------------------------------------------------ */

export const CFIA_QUERIES = {
  FOOD_RECALLS: 'cfia+food+recalls+imports',
  IMPORTS: 'cfia+food+import+inspection',
  ALLERGENS: 'cfia+allergen+recalls',
} as const;

export const CFIA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  FOOD_RECALLS: {
    id: 'b7e9b3g-9d0e-4a3b-eh6i-2d3k7f8g9h0c',
    title: 'CFIA Food Recall List',
    description: 'Complete list of food recall warnings issued by the Canadian Food Inspection Agency.',
  },
  IMPORTED_FOOD: {
    id: 'c8f0c4h-0e1f-4b4c-fi7j-3e4l8g9h0i1d',
    title: 'CFIA Imported Food Data',
    description: 'Data on imported food products inspected by the Canadian Food Inspection Agency.',
  },
};

/* ------------------------------------------------------------------ */
/*  Canadian Grain Commission                                          */
/* ------------------------------------------------------------------ */

export const GRAIN_QUERIES = {
  EXPORTS: 'grain+commission+exports',
  PRODUCTION: 'grain+production+canada',
  QUALITY: 'grain+quality+survey+canada',
} as const;

export const GRAIN_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  GRAIN_EXPORTS: {
    id: 'd9g1d5i-1f2g-4c5d-gj8k-4f5m9h0i1j2e',
    title: 'Canadian Grain Exports',
    description: 'Grain export data from the Canadian Grain Commission including volumes and destinations.',
  },
  GRAIN_PRODUCTION: {
    id: 'e0h2e6j-2g3h-4d6e-hk9l-5g6n0i1j2k3f',
    title: 'Canadian Grain Production',
    description: 'Canadian grain production statistics by type and province.',
  },
};

/* ------------------------------------------------------------------ */
/*  Farm Credit Canada                                                 */
/* ------------------------------------------------------------------ */

export const FCC = {
  BASE_URL: 'https://www.fcc-fac.ca',
  ANNUAL_REPORTS: 'https://www.fcc-fac.ca/en/about-fcc/corporate-governance/annual-reports.html',
  FINANCIAL_HIGHLIGHTS: 'https://www.fcc-fac.ca/en/our-business/investor-relations/financial-results.html',
} as const;

/* ------------------------------------------------------------------ */
/*  Source Names                                                       */
/* ------------------------------------------------------------------ */

export const AGRICULTURE_SOURCE_NAMES = {
  AAFC_CROPS: 'aafc-crops',
  AAFC_LIVESTOCK: 'aafc-livestock',
  AAFC_FARM_INCOME: 'aafc-farm-income',
  DAIRY_POULTRY: 'dairy-poultry',
  CFIA_RECALLS: 'cfia-food-recalls',
  GRAIN_EXPORTS: 'grain-exports',
  FARM_CREDIT_CANADA: 'farm-credit-canada',
} as const;

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;
export const CKAN_SEARCH_LIMIT = 50;
export const REQUEST_TIMEOUT_MS = 30_000;
