// SPDX-License-Identifier: AGPL-3.0-only
import type { TrustScore as TrustScoreResult } from './trust-scoring.js';

export interface CrossReferenceResult {
  entity: string;
  entityType: 'person' | 'organization';
  matches: CrossReferenceMatch[];
  totalMatches: number;
  timeline: CrossReferenceTimelineEntry[];
  trustScore: TrustScoreResult;
  ingestedAt: string;
}

export interface CrossReferenceMatch {
  module: string;
  sourceUrl: string;
  date: string;
  title: string;
  description: string;
  relevance: 'direct' | 'indirect';
  authorityScore?: number;
  citationHash?: string;
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
  minSources?: number;
  highSensitivity?: boolean;
}
