// SPDX-License-Identifier: AGPL-3.0-only
export interface UtilityRecord {
  id: string;
  name: string;
  province: string;
  type: string;
  serviceArea: string;
  url: string;
  outageUrl?: string;
  ratesUrl?: string;
}

export interface UtilityIngestionResult {
  providers: UtilityRecord[];
  errors: string[];
  durationMs: number;
}

export type UtilityType = 'hydro' | 'gas' | 'telecom' | 'water';

export interface HydroRecord {
  id: string;
  name: string;
  province: string;
  customerCount: number | null;
  generationCapacityMW: number | null;
  rateType: string | null;
  averageRate: number | null;
  sourceUrl: string;
  utilityType: 'hydro';
  ingestedAt: string;
}

export interface GasRecord {
  id: string;
  name: string;
  province: string;
  customerCount: number | null;
  distributionVolume: number | null;
  rateType: string | null;
  averageRate: number | null;
  sourceUrl: string;
  utilityType: 'gas';
  ingestedAt: string;
}

export type UtilityParsedRecord = HydroRecord | GasRecord;

export interface UtilityParserOptions {
  sourceUrl?: string;
  fiscalYear?: string;
}
