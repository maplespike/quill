// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Composite Data Quality Score — Quill
 *
 * Combines freshness, completeness, and provenance scores into a
 * single quality assessment for a module, source, or dataset.
 *
 * Weighted formula (DEFAULT_QUALITY_WEIGHTS):
 *   composite = freshness × 0.30 + completeness × 0.35 + provenance × 0.35
 */

import type {
  DataQualityScore,
  CompletenessScore,
  FreshnessScore,
  ProvenanceScore,
  QualityWeights,
  QualityScoreRecord,
  QualityLevel,
} from './types.js';
import { DEFAULT_QUALITY_WEIGHTS, scoreToLevel } from './types.js';
import { scoreFreshness } from './freshness.js';
import { scoreCompleteness } from './completeness.js';
import { scoreProvenance } from './provenance.js';
import type { ProvenanceInput } from './provenance.js';

/* ------------------------------------------------------------------ */
/*  Composite Score                                                    */
/* ------------------------------------------------------------------ */

export interface QualityInput {
  /** Module / source name */
  source: string;
  /** Records to analyze for completeness */
  records: Array<Record<string, unknown>>;
  /** Expected cadence string (e.g. 'daily', 'monthly') */
  cadence?: string;
  /** Expected fields for completeness checking — inferred if omitted */
  expectedFields?: string[];
  /** Provenance input */
  provenance?: ProvenanceInput;
  /** Custom weights (defaults to DEFAULT_QUALITY_WEIGHTS) */
  weights?: QualityWeights;
  /** Override last-ingested timestamp (epoch ms) */
  lastIngestedAt?: number;
}

/**
 * Compute the full three-axis Data Quality Score.
 */
export function scoreDataQuality(input: QualityInput): DataQualityScore {
  const {
    source,
    records,
    cadence,
    expectedFields,
    provenance,
    weights,
    lastIngestedAt,
  } = input;

  const w = weights ?? DEFAULT_QUALITY_WEIGHTS;

  const freshness = scoreFreshness(source, cadence, lastIngestedAt);
  const completeness = scoreCompleteness(records, source, expectedFields);
  const prov = provenance
    ? scoreProvenance(provenance)
    : scoreProvenance({ source });

  const composite = Math.round(
    Math.min(1, Math.max(0,
      freshness.score * w.freshness +
      completeness.score * w.completeness +
      prov.score * w.provenance,
    )) * 1000,
  ) / 1000;

  return {
    composite,
    level: scoreToLevel(composite),
    freshness,
    completeness,
    provenance: prov,
    source,
    scoredAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  DB Record Helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Convert a DataQualityScore to a DB-serializable record.
 */
export function scoreToDbRecord(
  score: DataQualityScore,
  id: string,
): QualityScoreRecord {
  return {
    id,
    source: score.source,
    compositeScore: score.composite,
    compositeLevel: score.level,
    freshnessScore: score.freshness.score,
    freshnessLevel: score.freshness.level,
    completenessScore: score.completeness.score,
    completenessLevel: score.completeness.level,
    provenanceScore: score.provenance.score,
    provenanceLevel: score.provenance.level,
    recordCount: score.completeness.recordCount,
    details: JSON.stringify(score),
    createdAt: score.scoredAt,
    updatedAt: score.scoredAt,
  };
}

/**
 * Format a DataQualityScore as a concise summary string.
 */
export function formatQualitySummary(score: DataQualityScore): string {
  return [
    `Data Quality for "${score.source}": ${score.level.toUpperCase()} (${score.composite})`,
    `  Freshness:    ${score.freshness.level} (${score.freshness.score}) — ${formatAge(score.freshness.ageSeconds)} old, cadence: ${score.freshness.expectedCadence}`,
    `  Completeness: ${score.completeness.level} (${score.completeness.score}) — ${score.completeness.presentFields}/${score.completeness.totalFields} fields, ${score.completeness.recordCount} records`,
    `  Provenance:   ${score.provenance.level} (${score.provenance.score}) — trust: ${score.provenance.sourceTrustScore}, citations: ${score.provenance.citationVerified}, hash: ${score.provenance.hashChainVerified}`,
  ].join('\n');
}

function formatAge(seconds: number): string {
  if (seconds === Infinity) return 'never ingested';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
