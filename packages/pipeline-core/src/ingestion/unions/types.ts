export interface UnionRecord {
  unionName: string;
  year: number;
  membership?: number;
  revenue?: number;
  assets?: number;
  source: string;
  url: string;
  hash: string;
  ingestedAt: string;
}

export interface UnionsIngestionResult {
  records: UnionRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
