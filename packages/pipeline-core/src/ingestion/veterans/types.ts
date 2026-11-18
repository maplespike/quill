// SPDX-License-Identifier: AGPL-3.0-only
/** Veterans Affairs Canada data types — Quill */

export interface VeteransRecord {
  id: string;
  year: number;
  category: string;
  program?: string;
  value: number;
  description?: string;
  region?: string;
  demographic?: string;
  metricType?: string;
  sourceUrl?: string;
  sourceName?: string;
  ingestedAt?: string;
}

export interface VeteransIngestionResult {
  records: VeteransRecord[];
  errors: string[];
  durationMs: number;
}

export interface VacBenefitStat {
  program: string;
  year: number;
  recipients: number;
  expenditure: number;
  category: string;
}

export interface OsissClinicRecord {
  clinic: string;
  province: string;
  year: number;
  patientsServed: number;
  referrals: number;
}

export interface VeteranSuicideStat {
  year: number;
  deaths: number;
  rate: number;
  population: string;
  demographic: string;
}

export interface DndVeteranProgramRecord {
  program: string;
  year: number;
  budget: number;
  description: string;
  department: string;
}
