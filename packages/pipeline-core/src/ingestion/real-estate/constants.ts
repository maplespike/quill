// SPDX-License-Identifier: AGPL-3.0-only
// CKAN endpoints for CMHC and provincial housing data
export const CMHC_CKAN = 'https://open.canada.ca/data/api/3/action/package_search';

// Known CMHC dataset IDs for targeted queries
export const CMHC_RENTAL_SURVEY_ID = 'cmhc-rental-market-survey';
export const CMHC_HOUSING_STARTS_ID = 'cmhc-housing-starts';
export const CMHC_NHPI_ID = 'new-housing-price-index';

// Provincial assessment portals (via CKAN where available)
export const BC_ASSESSMENT_SEARCH = 'bc assessment property parcel values';
export const ON_MPAC_SEARCH = 'mpac ontario property assessment';
export const AB_ASSESSMENT_SEARCH = 'alberta property assessment municipal';

export const RE_TIMEOUT_MS = 15_000;
export const RE_UA = 'MapleSpike-RealEstate/1.0';
