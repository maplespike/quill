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
    id: '31226205-3654-4462-b50a-10ba53d7f362',
    title: 'AAFC Crops Production Data',
    description: 'Crop production data from Agriculture and Agri-Food Canada including area, yield, and production by commodity and province.',
  },
  LIVESTOCK: {
    id: '6adaeb1f-438b-4d74-b72b-d1b554f3a316',
    title: 'AAFC Livestock Production Data',
    description: 'Livestock and poultry production data including inventory, slaughter, and meat production.',
  },
  FARM_INCOME: {
    id: '4add5f7d-ec19-411a-aa00-4289f40521a9',
    title: 'AAFC Farm Income Statistics',
    description: 'Farm cash receipts, realized net income, and government payments by province.',
  },
};

export const DAIRY_POULTRY_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  DAIRY_PRODUCTION: {
    id: '076f6c6a-72cf-43f5-a661-b0c0d9e0c387',
    title: 'Dairy Production and Statistics',
    description: 'Canadian dairy production, milk shipments, butter and cheese production from the Canadian Dairy Commission.',
  },
  POULTRY: {
    id: 'c64bf9ec-d142-4b7f-930a-a41ad9451bb4',
    title: 'Poultry and Egg Production',
    description: 'Poultry and egg production data including supply-managed commodities.',
  },
};

export const CFIA_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  FOOD_RECALLS: {
    id: 'a36ff706-d43f-46d6-9475-c4b468de86e6',
    title: 'CFIA Food Recall List',
    description: 'Complete list of food recall warnings issued by the Canadian Food Inspection Agency.',
  },
  IMPORTED_FOOD: {
    id: '0ba773f6-ab7c-4c93-8de8-d2154209ab35',
    title: 'CFIA Imported Food Data',
    description: 'Data on imported food products inspected by the Canadian Food Inspection Agency.',
  },
};

export const GRAIN_DATASETS: Record<string, { id: string; title: string; description: string }> = {
  GRAIN_EXPORTS: {
    id: 'f8ef10d3-24ca-402b-aa46-7ce8839bad1c',
    title: 'Canadian Grain Exports',
    description: 'Grain export data from the Canadian Grain Commission including volumes and destinations.',
  },
  GRAIN_PRODUCTION: {
    id: '133e4473-5d60-40a1-a3de-0e4ad4a7fd41',
    title: 'Canadian Grain Production',
    description: 'Canadian grain production statistics by type and province.',
  },
};

/* ------------------------------------------------------------------ */
/* Canadian Dairy Commission / Poultry */
/* ------------------------------------------------------------------ */

export const DAIRY_POULTRY_QUERIES = {
  DAIRY: 'canadian+dairy+commission+poultry',
  POULTRY: 'poultry+supply+management+canada',
  QUOTA: 'dairy+poultry+quota+canada',
} as const;

/* ------------------------------------------------------------------ */
/* CFIA — Canadian Food Inspection Agency */
/* ------------------------------------------------------------------ */

export const CFIA_QUERIES = {
  FOOD_RECALLS: 'cfia+food+recalls+imports',
  IMPORTS: 'cfia+food+import+inspection',
  ALLERGENS: 'cfia+allergen+recalls',
} as const;

/* ------------------------------------------------------------------ */
/* Canadian Grain Commission */
/* ------------------------------------------------------------------ */

export const GRAIN_QUERIES = {
  EXPORTS: 'grain+commission+exports',
  PRODUCTION: 'grain+production+canada',
  QUALITY: 'grain+quality+survey+canada',
} as const;

/* ------------------------------------------------------------------ */
/* Farm Credit Canada */
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
