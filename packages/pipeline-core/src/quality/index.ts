// SPDX-License-Identifier: AGPL-3.0-only
/**
 * @maplespike/pipeline-core — Data Quality Scoring Module
 *
 * Three-axis quality model: freshness, completeness, provenance.
 * Each axis yields a score (0.0 – 1.0) and a qualitative level.
 * Use scoreDataQuality() for a full assessment, or the individual
 * scoring functions for targeted checks.
 */

export { scoreDataQuality, scoreToDbRecord, formatQualitySummary } from './scorer.js';
export type { QualityInput } from './scorer.js';

export {
  scoreFreshness,
  scoreFreshnessBatch,
  recordIngestion,
  getLastIngested,
  hasIngestion,
  clearIngestionStore,
  seedIngestionRecords,
  computeAgeSeconds,
  parseCadence,
} from './freshness.js';

export {
  scoreCompleteness,
  scoreRecordCompleteness,
  analyzeRecord,
  analyzeBatchCompleteness,
  isFieldPresent,
  inferExpectedFields,
} from './completeness.js';
export type { RecordAnalysis } from './completeness.js';

export {
  scoreProvenance,
  scoreSourceProvenance,
  computeSourceTrust,
  analyzeCitation,
  scoreCitationChain,
} from './provenance.js';
export type { ProvenanceInput, CitationInfo } from './provenance.js';

export type {
  DataQualityScore,
  FreshnessScore,
  CompletenessScore,
  ProvenanceScore,
  QualityScoreRecord,
  QualityLevel,
  QualityWeights,
  UpdateCadence,
} from './types.js';

export {
  scoreToLevel,
  DEFAULT_QUALITY_WEIGHTS,
  CADENCE_STALE_SECONDS,
  UPDATE_CADENCE_MAP,
} from './types.js';
