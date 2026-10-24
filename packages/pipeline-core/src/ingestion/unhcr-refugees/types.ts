// SPDX-License-Identifier: AGPL-3.0-only

export interface RefugeeRecord {
  id: string;
  countryCode: string;
  year: number;
  populationType: 'refugees' | 'asylum-seekers' | 'idps' | 'stateless' | 'ooc' | 'returnees';
  value: number;
  source: string;
}

export interface RefugeeIngestionResult {
  countryCode: string;
  year: number;
  records: RefugeeRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}

export interface UnhcrPopulationRecord {
  iso3: string;
  year: number;
  population_type: string;
  population_value: number;
  population_category: string;
}
