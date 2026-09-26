import type { SourceOutcome } from '../run-log.js';

export type RealtimeSource =
  | 'eccc-weather-alerts'
  | 'cbsa-border-wait-times'
  | 'alert-ready'
  | 'parole-board-decisions'
  | 'eccc-weather-observations'
  | 'eccc-aqhi'
  | 'water-survey-flood';

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
  /** Per-source outcomes (GH#921) — surfaced into ingest_runs.sources_json. */
  sources: SourceOutcome[];
}
