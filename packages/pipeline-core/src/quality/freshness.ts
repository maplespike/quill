// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Freshness Scoring — Quill
 *
 * Computes how recent data is by comparing last-ingestion timestamps
 * against each source's expected update cadence. Used as one axis
 * of the three-axis Data Quality Scoring model.
 *
 * Scores:
 *   0.95–1.0  excellent — ingested within 10% of stale threshold
 *   0.80–0.94 good     — within 50% of stale threshold
 *   0.60–0.79 fair     — approaching stale threshold
 *   0.30–0.59 poor     — past stale threshold
 *   < 0.30   unknown   — never ingested or very stale
 */

import type {
  FreshnessScore,
  QualityLevel,
  UpdateCadence,
} from './types.js';
import {
  CADENCE_STALE_SECONDS,
  scoreToLevel,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Ingestion Record Store (in-memory with DB fallback)               */
/* ------------------------------------------------------------------ */

export interface IngestionRecord {
  source: string;
  lastIngestedAt: number; // epoch ms
}

/** Default in-memory store — can be replaced with DB-backed */
const ingestionStore = new Map<string, IngestionRecord>();

/**
 * Record that a source was just ingested.
 */
export function recordIngestion(source: string, timestamp?: number): void {
  ingestionStore.set(source, {
    source,
    lastIngestedAt: timestamp ?? Date.now(),
  });
}

/**
 * Get the last-ingested timestamp for a source.
 */
export function getLastIngested(source: string): number | undefined {
  return ingestionStore.get(source)?.lastIngestedAt;
}

/**
 * Check if a source has ever been ingested.
 */
export function hasIngestion(source: string): boolean {
  return ingestionStore.has(source);
}

/**
 * Get the internal ingestion store (for inspection / testing).
 */
export function getIngestionStore(): Map<string, IngestionRecord> {
  return ingestionStore;
}

/**
 * Clear the ingestion store (testing).
 */
export function clearIngestionStore(): void {
  ingestionStore.clear();
}

/**
 * Seed ingestion records with known values.
 */
export function seedIngestionRecords(
  records: Array<{ source: string; ageSeconds: number }>,
): void {
  const now = Date.now();
  for (const r of records) {
    ingestionStore.set(r.source, {
      source: r.source,
      lastIngestedAt: now - r.ageSeconds * 1000,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Freshness Scoring                                                  */
/* ------------------------------------------------------------------ */

/**
 * Compute the age in seconds for a source.
 * Returns Infinity if source has never been ingested.
 */
export function computeAgeSeconds(source: string): number {
  const record = ingestionStore.get(source);
  if (!record) return Infinity;
  return Math.floor((Date.now() - record.lastIngestedAt) / 1000);
}

/**
 * Decode a cadence string into a canonical UpdateCadence.
 */
export function parseCadence(cadence: string): UpdateCadence {
  const key = cadence.toLowerCase().replace(/[-\s]/g, '-') as UpdateCadence;
  if (key in CADENCE_STALE_SECONDS) return key;
  return 'unknown';
}

/**
 * Compute a freshness score for a single source.
 *
 * Scoring formula:
 *   ratio = ageSeconds / staleThreshold
 *   score = 1.0 - min(ratio, 2.0) * 0.5
 *
 * This means:
 *   - At age 0:                        score = 1.0
 *   - At stale threshold:              score = 0.5
 *   - At 2× stale threshold (or more): score = 0.0
 */
export function scoreFreshness(
  source: string,
  cadence?: string,
  lastIngestedAt?: number,
): FreshnessScore {
  const ageSeconds = lastIngestedAt !== undefined
    ? Math.floor((Date.now() - lastIngestedAt) / 1000)
    : computeAgeSeconds(source);

  const expectedCadence = cadence ? parseCadence(cadence) : 'unknown';
  const staleThreshold = CADENCE_STALE_SECONDS[expectedCadence];

  let score: number;
  if (ageSeconds === Infinity) {
    score = 0;
  } else if (staleThreshold === Infinity) {
    // Event-driven sources: score based on absolute age
    // < 30 days = 1.0, otherwise decays slowly
    score = Math.max(0, 1.0 - ageSeconds / (365 * 86_400));
  } else {
    const ratio = ageSeconds / staleThreshold;
    score = Math.max(0, 1.0 - Math.min(ratio, 2.0) * 0.5);
  }

  // Round to 3 decimal places
  score = Math.round(score * 1000) / 1000;

  return {
    score,
    level: scoreToLevel(score),
    ageSeconds,
    expectedCadence,
    staleThresholdSeconds: staleThreshold,
    source,
    lastIngestedAt: lastIngestedAt !== undefined
      ? new Date(lastIngestedAt).toISOString()
      : ingestionStore.get(source)?.lastIngestedAt
        ? new Date(ingestionStore.get(source)!.lastIngestedAt).toISOString()
        : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Scoring                                                      */
/* ------------------------------------------------------------------ */

/**
 * Score freshness for multiple sources at once.
 */
export function scoreFreshnessBatch(
  sources: Array<{ source: string; cadence?: string }>,
): FreshnessScore[] {
  return sources.map((s) => scoreFreshness(s.source, s.cadence));
}
