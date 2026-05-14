/** Union source configuration */
export interface UnionSource {
  name: string;
  url: string;
  province: string | 'national';
  category: UnionCategory;
  description: string;
  enabled: boolean;
  narrativeTags: string[];
  fetchType: 'html' | 'ckan' | 'statcan';
}

export type UnionCategory =
  | 'labour-central'
  | 'private-sector'
  | 'public-sector'
  | 'education'
  | 'healthcare'
  | 'transport'
  | 'postal'
  | 'government'
  | 'statistics';

/** A single union coverage / labour data record */
export interface UnionRecord {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: string;
  category: UnionCategory;
  province: string | 'national';
  narrativeTags: string[];
  hash: string;
  recordType: 'news' | 'report' | 'dataset' | 'coverage-stat';
  metadata?: Record<string, unknown>;
}

/** Result of a union ingestion run */
export interface UnionIngestionResult {
  records: UnionRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: { source: string; error: string }[];
  durationMs: number;
}
