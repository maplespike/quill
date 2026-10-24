// SPDX-License-Identifier: AGPL-3.0-only
export interface ServiceRecord {
  id: string;
  organization: string;
  name: string;
  province: string;
  url?: string;
  category?: string;
  trust_score: number;
  citation_hash: string;
  _raw?: unknown;
}

export type ParsedServiceRecord = Omit<ServiceRecord, '_raw'>;

export interface ServiceSearchOptions {
  limit?: number;
  province?: string;
  category?: string;
}