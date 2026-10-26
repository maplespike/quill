export interface NgoRssConfig {
  name: string;
  url: string;
  category: NgoCategory;
  description: string;
  enabled: boolean;
  narrativeTags: string[];
}

export type NgoCategory =
  | 'think-tank'
  | 'ngo'
  | 'un-international'
  | 'government-rss'
  | 'corporate-regulatory'
  | 'wef-alternative';

export interface NgoRssItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: string;
  category: NgoCategory;
  narrativeTags: string[];
  hash: string;
}

export interface NgoSourceOutcome {
  source: string;
  status: 'ok' | 'empty' | 'error';
  records: number;
  error: string | null;
  skipReason?: string;
}

export interface NgoRssIngestionResult {
  items: NgoRssItem[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: { source: string; error: string }[];
  /** Per-feed verdicts. A dead feed is `error`, not a quiet success. */
  sources: NgoSourceOutcome[];
  durationMs: number;
}

/** 5GW narrative classification flags */
export type NarrativeFlag =
  | 'wef-alignment'
  | 'foreign-influence'
  | 'corporate-capture'
  | 'policy-echo'
  | 'astroturf'
  | 'coordinated-amplification'
  | 'think-tank-funding-chain'
  | 'un-alignment'
  | 'none';
