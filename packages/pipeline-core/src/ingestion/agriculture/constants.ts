/**
 * Agriculture Constants — Quill
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
    id: '43d578b6-e30f-4b9c-a92f-b58d3cc21485',
    title: 'Selected Crops, Census of Agriculture Historical Data',
    description: 'Crop production data from Agriculture and Agri-Food Canada including area, yield, and production by commodity and province.',
  },
  LIVESTOCK: {
    id: 'df3c2023-2d3d-4cce-a9ca-20b679ad989a',
    title: 'Crop Residue, Census of Agriculture',
    description: 'Agricultural data including livestock and poultry production from Census of Agriculture.',
  },
  FARM_INCOME: {
    id: 'b671472b-78bc-4466-bfb1-63042918edf1',
    title: 'Field Crops and Hay, Census of Agriculture',
    description: 'Agricultural field crop and hay data including farm income statistics by province.',
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
    id: '076f6c6a-72cf-43f5-a661-b0c0d9e0c387',
    title: 'Domestic Disappearance of Dairy Products',
    description: 'Canadian dairy production, milk shipments, butter and cheese production from the Canadian Dairy Commission.',
  },
  POULTRY: {
    id: 'aede304e-71cf-441e-afad-35a3c4e0ed40',
    title: 'Supply and Disposition of Poultry Meat and Eggs',
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
    id: 'a36ff706-d43f-46d6-9475-c4b468de86e6',
    title: 'CFIA Class I Recalls with Public Warnings',
    description: 'Complete list of food recall warnings issued by the Canadian Food Inspection Agency.',
  },
  IMPORTED_FOOD: {
    id: '3fcee41c-1165-427a-b1de-3351423209ec',
    title: 'CFIA Open Government Implementation Plan',
    description: 'CFIA open data including imported food product inspections.',
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
    id: 'f8ef10d3-24ca-402b-aa46-7ce8839bad1c',
    title: 'Canadian Grain Exports',
    description: 'Grain export data from the Canadian Grain Commission including volumes and destinations.',
  },
  GRAIN_PRODUCTION: {
    id: '4c513dab-cdd0-471d-80f8-7da9f06fa654',
    title: 'Grain Statistics Weekly',
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
