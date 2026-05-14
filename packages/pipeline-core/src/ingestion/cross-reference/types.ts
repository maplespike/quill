export interface CrossReferenceResult {
  entity: string;
  entityType: 'person' | 'organization';
  matches: CrossReferenceMatch[];
  totalMatches: number;
  timeline: CrossReferenceTimelineEntry[];
  ingestedAt: string;
}

export interface CrossReferenceMatch {
  module: string;
  sourceUrl: string;
  date: string;
  title: string;
  description: string;
  relevance: 'direct' | 'indirect';
}

export interface CrossReferenceTimelineEntry {
  date: string;
  module: string;
  event: string;
  sourceUrl: string;
}

export type CrossReferenceSearchTarget = 'person' | 'organization' | 'all';

export interface CrossReferenceQuery {
  query: string;
  target?: CrossReferenceSearchTarget;
  modules?: string[];
  limit?: number;
}
