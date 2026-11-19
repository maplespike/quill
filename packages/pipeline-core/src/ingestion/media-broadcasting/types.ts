export type MediaSource =
  | 'crtc-market-reports'
  | 'crtc-ownership'
  | 'canada-media-fund'
  | 'telefilm'
  | 'online-news-act'
  | 'cbc-financials';

export interface MediaRecord {
  source: MediaSource;
  title: string;
  url: string;
  year: number;
  value?: number;
  entity?: string;
  category?: string;
  hash: string;
  ingestedAt: string;
}

export interface MediaIngestionResult {
  records: MediaRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: { source: string; error: string }[];
  durationMs: number;
}
