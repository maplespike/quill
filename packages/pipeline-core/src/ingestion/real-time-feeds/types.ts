export type RealtimeSource =
  | 'eccc-weather-alerts'
  | 'cbsa-border-wait-times'
  | 'alert-ready'
  | 'parole-board-decisions'
  | 'eccc-weather-observations';

export interface RealtimeRecord {
  source: RealtimeSource;
  title: string;
  url: string;
  publishedAt: string;
  region?: string;
  severity?: string;
  summary: string;
  hash: string;
  ingestedAt: string;
}

export interface RealtimeIngestionResult {
  records: RealtimeRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: { source: string; error: string }[];
  durationMs: number;
}
