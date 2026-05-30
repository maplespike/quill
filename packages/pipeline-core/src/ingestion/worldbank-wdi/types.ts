// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CountryCode2 } from '../../shared/country-codes.js';

export interface IndicatorValue {
  id: string;
  country: CountryCode2;
  indicatorCode: string;
  year: number;
  value: number;
}

export interface WdiCountryProfile {
  country: string;
  indicators: IndicatorValue[];
  lastUpdated: string;
}

export interface WdiComparison {
  indicatorCode: string;
  entries: Array<{ country: string; values: IndicatorValue[] }>;
  lastUpdated: string;
}

export interface WdiApiResponse {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: string | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

export type WdiIndicatorDatum = WdiApiResponse;

export interface Indicator {
  code: string;
  name: string;
}
