/**
 * Canadian cultural data types — Quill
 */

export interface CultureRecord {
  id: string;
  year: number;
  category: string;
  subcategory?: string;
  value: number;
  amount?: number;
  description: string;
  region: string;
  program?: string;
  recipient?: string;
  sourceUrl: string;
  sourceName: string;
  ingestedAt: string;
}

export interface CultureIngestionResult {
  records: CultureRecord[];
  errors: string[];
  durationMs: number;
}

export interface CultureGrant {
  program: string;
  recipient: string;
  province: string;
  amount: number;
  year: number;
  description: string;
  url: string;
  hash: string;
  ingestedAt: string;
}

export interface CultureSource {
  name: string;
  baseUrl: string;
  datasetId?: string;
  description: string;
}

export interface CmfProductionData {
  projectId: string;
  title: string;
  company: string;
  category: string;
  year: number;
  amount: number;
  hashtag: string;
  url: string;
}

export interface NfbProductionRecord {
  title: string;
  director: string;
  year: number;
  genre: string;
  format: string;
  duration: number;
  url: string;
}
