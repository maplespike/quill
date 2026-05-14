export interface AgricultureRecord {
  id: string;
  year: number;
  category: string;
  value: number;
  description: string;
  region: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface AgricultureIngestionResult {
  records: AgricultureRecord[];
  errors: string[];
  durationMs: number;
}
