// SPDX-License-Identifier: AGPL-3.0-only
/**
 * UNHCR Refugee Data Types
 */

export interface UNHCRPopulationResponse {
  year: number;
  refugeeStocks: Array<{
    iso3: string;
    countryName: string;
    refugees: number;
    asylumSeekers: number;
  }>;
  total: number;
}

export interface UNHCRAsylumResponse {
  year: number;
  applications: Array<{
    iso3: string;
    countryName: string;
    applications: number;
    decisions: number;
    recognized: number;
  }>;
  total: number;
}

export interface GetCanadaRefugeeDataResult {
  year: number;
  refugeeStocks: number;
  asylumSeekers: number;
  asylumApplications: number;
  asylumDecisions: number;
  asylumRecognized: number;
  country: string;
}

export interface GetGlobalRefugeeStatsResult {
  year: number;
  totalRefugees: number;
  totalAsylumSeekers: number;
  countriesWithData: number;
}

export interface GetRefugeeByCountryResult {
  countryName: string;
  iso3: string;
  year: number;
  refugees: number;
  asylumSeekers: number;
  applications: number;
  decisions: number;
  recognized: number;
}