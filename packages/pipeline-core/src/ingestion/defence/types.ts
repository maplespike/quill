// SPDX-License-Identifier: AGPL-3.0-only
/** National Defence personnel record */
export interface DndPersonnelRecord {
  year: number;
  month: number;
  rank: string;
  component: string;
  gender?: string;
  count: number;
}

/** Defence procurement contract */
export interface DndProcurementRecord {
  year: number;
  vendor: string;
  description: string;
  value: number;
  contractDate?: string;
}

/** Ingestion result */
export interface DefenceIngestionResult {
  source: string;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
