// SPDX-License-Identifier: AGPL-3.0-only

export interface CiaRawProfile {
  country_code: string;
  country_name: string;
  region: string;
  fields: Record<string, {
    value: string | number | null;
    rank?: number;
    date?: string;
    comparison_date?: string;
  }>;
  last_updated: string;
}

export interface CiaFactRecord {
  id: string;
  countryCode: string;
  countryName: string;
  field: string;
  fieldName: string;
  category: string;
  value: string | number | null;
  rank: number | null;
  year: string | null;
}

export interface CiaCountryComparison {
  field: string;
  fieldName: string;
  entries: Array<{
    countryCode: string;
    countryName: string;
    value: string | number | null;
    rank: number | null;
  }>;
  lastUpdated: string;
}

export interface CiaIngestionResult {
  countryCode: string;
  records: CiaFactRecord[];
  fieldsAttempted: number;
  fieldsSucceeded: number;
  errors: string[];
  durationMs: number;
}
