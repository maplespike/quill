export interface CultureRecord {
  id: string;
  year: number;
  category: string;
  value: number;
  description: string;
  region: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface CultureIngestionResult {
  records: CultureRecord[];
  errors: string[];
  durationMs: number;
}
