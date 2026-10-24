// SPDX-License-Identifier: AGPL-3.0-only

export interface HDIRecord {
  id: string;
  country: string;
  countryCode: string;
  hdiValue: number;
  rank: number;
  year: number;
  lifeExpectancy?: number;
  expectedYearsSchooling?: number;
  meanYearsSchooling?: number;
  gniPerCapita?: number;
  category: 'very-high' | 'high' | 'medium' | 'low';
}

export interface HDIIngestionResult {
  country: string;
  records: HDIRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}

export interface HDIComponent {
  country: string;
  lifeExpectancy: number;
  expectedSchooling: number;
  meanSchooling: number;
  gniPerCapita: number;
}
