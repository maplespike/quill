/** Veterans Affairs Canada data types */

export interface VeteransRecord {
  id: string;
  year: number;
  category: string;
  program?: string;
  value: number;
  description?: string;
  region?: string;
  demographic?: string;
  sourceUrl?: string;
  ingestedAt?: string;
}

export interface VeteransIngestionResult {
  records: VeteransRecord[];
  errors: string[];
  durationMs: number;
}
