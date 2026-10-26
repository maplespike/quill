// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Data Quality Scoring Types — Quill
 *
 * Three-axis quality model:
 *   1. Freshness — how recent the data is vs expected update cadence
 *   2. Completeness — field presence, null ratios, schema compliance
 *   3. Provenance — source trustworthiness, citation chain, hash verification
 *
 * Each axis yields a score (0.0 – 1.0) and a qualitative level.
 * A composite DataQualityScore combines all three.
 */

/* ------------------------------------------------------------------ */
/*  Score levels                                                       */
/* ------------------------------------------------------------------ */

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export function scoreToLevel(score: number): QualityLevel {
  if (score >= 0.95) return 'excellent';
  if (score >= 0.80) return 'good';
  if (score >= 0.60) return 'fair';
  if (score >= 0.30) return 'poor';
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Freshness                                                          */
/* ------------------------------------------------------------------ */

/** Expected update cadence for a data source */
export type UpdateCadence =
  | 'realtime'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'event-driven'
  | 'unknown';

/** Convert a cadence string to a canonical UpdateCadence */
export const UPDATE_CADENCE_MAP: Record<string, UpdateCadence> = {
  realtime: 'realtime',
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
  'event-driven': 'event-driven',
  unknown: 'unknown',
};

/** Threshold in seconds for each cadence that constitutes "stale" */
export const CADENCE_STALE_SECONDS: Record<UpdateCadence, number> = {
  realtime: 300,          // 5 minutes
  daily: 86_400,          // 24 hours
  weekly: 604_800,        // 7 days
  monthly: 2_592_000,     // 30 days
  quarterly: 7_776_000,   // 90 days
  yearly: 31_536_000,     // 365 days
  'event-driven': Infinity,
  unknown: 604_800,       // default to weekly-like
};

/** Freshness score for a single source/module */
export interface FreshnessScore {
  /** How fresh the data is (0.0 = very stale, 1.0 = just ingested) */
  score: number;
  level: QualityLevel;
  /** Seconds since last successful ingestion */
  ageSeconds: number;
  /** Expected update cadence for this source */
  expectedCadence: UpdateCadence;
  /** Threshold at which this source is considered stale (seconds) */
  staleThresholdSeconds: number;
  /** Source name */
  source: string;
  /** ISO timestamp of last ingestion, if known */
  lastIngestedAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Completeness                                                       */
/* ------------------------------------------------------------------ */

/** Record-level completeness analysis */
export interface CompletenessScore {
  /** Overall completeness (0.0 – 1.0) */
  score: number;
  level: QualityLevel;
  /** Total fields expected */
  totalFields: number;
  /** Present fields (non-null, non-empty for strings) */
  presentFields: number;
  /** Fields that are missing / null */
  missingFields: string[];
  /** Fields that failed validation (type mismatch, out-of-range, etc.) */
  invalidFields: string[];
  /** Record count analyzed */
  recordCount: number;
  /** Module / source name */
  source: string;
}

/* ------------------------------------------------------------------ */
/*  Provenance                                                         */
/* ------------------------------------------------------------------ */

export interface ProvenanceScore {
  /** Overall provenance trustworthiness (0.0 – 1.0) */
  score: number;
  level: QualityLevel;
  /** Source domain trust score (from curation/scoring) */
  sourceTrustScore: number;
  /** Whether citations are present and chain is intact */
  citationVerified: boolean;
  /** Whether the Merkle-tree hash chain was verified */
  hashChainVerified: boolean;
  /** Whether the Ed25519 signature was verified */
  signatureVerified: boolean;
  /** Whether attestation is present */
  hasAttestation: boolean;
  /** Source name */
  source: string;
}

/* ------------------------------------------------------------------ */
/*  Composite                                                          */
/* ------------------------------------------------------------------ */

export interface DataQualityScore {
  /** Composite score (0.0 – 1.0), weighted average of three axes */
  composite: number;
  level: QualityLevel;
  freshness: FreshnessScore;
  completeness: CompletenessScore;
  provenance: ProvenanceScore;
  /** Module / source name */
  source: string;
  /** ISO timestamp when this score was computed */
  scoredAt: string;
}

/* ------------------------------------------------------------------ */
/*  DB Record (for persistence in quality_scores table)               */
/* ------------------------------------------------------------------ */

export interface QualityScoreRecord {
  id: string;
  source: string;
  compositeScore: number;
  compositeLevel: QualityLevel;
  freshnessScore: number;
  freshnessLevel: QualityLevel;
  completenessScore: number;
  completenessLevel: QualityLevel;
  provenanceScore: number;
  provenanceLevel: QualityLevel;
  recordCount: number;
  /** JSON-serialized details for debugging / visualization */
  details: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Scoring weights                                                    */
/* ------------------------------------------------------------------ */

export interface QualityWeights {
  freshness: number;
  completeness: number;
  provenance: number;
}

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  freshness: 0.30,
  completeness: 0.35,
  provenance: 0.35,
};
