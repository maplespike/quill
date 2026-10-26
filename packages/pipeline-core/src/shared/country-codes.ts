// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Country Code Mapping Utilities
 *
 * ISO 3166 country codes for international modules.
 * Provides conversion between ISO 3166-1 alpha-2, alpha-3, and numeric codes.
 *
 * Source: https://en.wikipedia.org/wiki/ISO_3166-1
 */

export type CountryCode2 = 'CA' | 'US' | 'GB' | string; // ISO 3166-1 alpha-2
export type CountryCode3 = 'CAN' | 'USA' | 'GBR' | string; // ISO 3166-1 alpha-3

export interface CountryInfo {
  name: string;
  alpha2: CountryCode2;
  alpha3: CountryCode3;
  numeric: string;
  region: string;
  subregion: string;
}

/**
 * Complete ISO 3166-1 country code mapping
 * Subset for major countries - expand as needed
 */
export const COUNTRIES: Record<CountryCode2, CountryInfo> = {
  // North America
  CA: { name: 'Canada', alpha2: 'CA', alpha3: 'CAN', numeric: '124', region: 'Americas', subregion: 'Northern America' },
  US: { name: 'United States', alpha2: 'US', alpha3: 'USA', numeric: '840', region: 'Americas', subregion: 'Northern America' },
  MX: { name: 'Mexico', alpha2: 'MX', alpha3: 'MEX', numeric: '484', region: 'Americas', subregion: 'Latin America and the Caribbean' },

  // Europe
  GB: { name: 'United Kingdom', alpha2: 'GB', alpha3: 'GBR', numeric: '826', region: 'Europe', subregion: 'Northern Europe' },
  DE: { name: 'Germany', alpha2: 'DE', alpha3: 'DEU', numeric: '276', region: 'Europe', subregion: 'Western Europe' },
  FR: { name: 'France', alpha2: 'FR', alpha3: 'FRA', numeric: '250', region: 'Europe', subregion: 'Western Europe' },
  IT: { name: 'Italy', alpha2: 'IT', alpha3: 'ITA', numeric: '380', region: 'Europe', subregion: 'Southern Europe' },
  ES: { name: 'Spain', alpha2: 'ES', alpha3: 'ESP', numeric: '724', region: 'Europe', subregion: 'Southern Europe' },

  // Asia
  CN: { name: 'China', alpha2: 'CN', alpha3: 'CHN', numeric: '156', region: 'Asia', subregion: 'Eastern Asia' },
  JP: { name: 'Japan', alpha2: 'JP', alpha3: 'JPN', numeric: '392', region: 'Asia', subregion: 'Eastern Asia' },
  IN: { name: 'India', alpha2: 'IN', alpha3: 'IND', numeric: '356', region: 'Asia', subregion: 'Southern Asia' },

  // Oceania
  AU: { name: 'Australia', alpha2: 'AU', alpha3: 'AUS', numeric: '036', region: 'Oceania', subregion: 'Australia and New Zealand' },
  NZ: { name: 'New Zealand', alpha2: 'NZ', alpha3: 'NZL', numeric: '554', region: 'Oceania', subregion: 'Australia and New Zealand' },

  // Africa
  ZA: { name: 'South Africa', alpha2: 'ZA', alpha3: 'ZAF', numeric: '710', region: 'Africa', subregion: 'Sub-Saharan Africa' },
  NG: { name: 'Nigeria', alpha2: 'NG', alpha3: 'NGA', numeric: '566', region: 'Africa', subregion: 'Sub-Saharan Africa' },
  EG: { name: 'Egypt', alpha2: 'EG', alpha3: 'EGY', numeric: '818', region: 'Africa', subregion: 'Northern Africa' },

  // South America
  BR: { name: 'Brazil', alpha2: 'BR', alpha3: 'BRA', numeric: '076', region: 'Americas', subregion: 'Latin America and the Caribbean' },
  AR: { name: 'Argentina', alpha2: 'AR', alpha3: 'ARG', numeric: '032', region: 'Americas', subregion: 'Latin America and the Caribbean' },
};

/**
 * Reverse lookup: alpha3 -> alpha2
 */
export const ALPHA3_TO_ALPHA2: Record<CountryCode3, CountryCode2> = Object.fromEntries(
  Object.values(COUNTRIES).map((c) => [c.alpha3, c.alpha2])
);

/**
 * Reverse lookup: numeric -> alpha2
 */
export const NUMERIC_TO_ALPHA2: Record<string, CountryCode2> = Object.fromEntries(
  Object.values(COUNTRIES).map((c) => [c.numeric, c.alpha2])
);

/**
 * Convert alpha-2 code to country info
 */
export function alpha2ToInfo(alpha2: CountryCode2): CountryInfo | undefined {
  return COUNTRIES[alpha2.toUpperCase() as CountryCode2];
}

/**
 * Convert alpha-3 code to alpha-2
 */
export function alpha3ToAlpha2(alpha3: CountryCode3): CountryCode2 | undefined {
  return ALPHA3_TO_ALPHA2[alpha3.toUpperCase() as CountryCode3];
}

/**
 * Convert numeric code to alpha-2
 */
export function numericToAlpha2(numeric: string): CountryCode2 | undefined {
  return NUMERIC_TO_ALPHA2[numeric];
}

/**
 * Normalize country code to alpha-2
 * Accepts alpha-2, alpha-3, or numeric and returns alpha-2
 */
export function normalizeCountryCode(code: string): CountryCode2 | undefined {
  if (code.length === 2) {
    return COUNTRIES[code.toUpperCase() as CountryCode2]?.alpha2;
  }
  if (code.length === 3) {
    return alpha3ToAlpha2(code.toUpperCase() as CountryCode3);
  }
  return numericToAlpha2(code);
}

/**
 * Get all countries in a region
 */
export function getCountriesByRegion(region: string): CountryInfo[] {
  return Object.values(COUNTRIES).filter((c) => c.region === region);
}

/**
 * Get all countries in a subregion
 */
export function getCountriesBySubregion(subregion: string): CountryInfo[] {
  return Object.values(COUNTRIES).filter((c) => c.subregion === subregion);
}

/**
 * Check if a country code is valid
 */
export function isValidCountryCode(code: string): boolean {
  return normalizeCountryCode(code) !== undefined;
}