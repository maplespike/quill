export interface FinRegRecord {
  id: string;
  regulator: string;
  title: string;
  description: string;
  url: string;
  date: string;
  category: string;
  jurisdiction: string;
}

export interface FinRegIngestionResult {
  source: string;
  recordsFound: number;
  records: FinRegRecord[];
  errors: string[];
  durationMs: number;
}
