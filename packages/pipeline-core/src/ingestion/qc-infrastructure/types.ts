// SPDX-License-Identifier: AGPL-3.0-only

export interface QcInfrastructureRecord {
  id: string;
  recordType: string;
  category: string | null;
  subcategory: string | null;
  value: number | null;
  unit: string | null;
  period: string | null;
  fiscalYear: string | null;
  region: string | null;
  status: string | null;
  description: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawQcInfrastructureRecord {
  category?: string;
  subcategory?: string;
  value?: number | string;
  unit?: string;
  period?: string;
  fiscal_year?: string;
  region?: string;
  status?: string;
  description?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface QcInfrastructureIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface QcInfrastructureIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
