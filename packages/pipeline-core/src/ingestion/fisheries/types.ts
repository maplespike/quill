export interface FisheriesRecord {
  id: string;
  year: number;
  category: string;
  value: number;
  description: string;
  region: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface FisheriesIngestionResult {
  records: FisheriesRecord[];
  errors: string[];
  durationMs: number;
}
