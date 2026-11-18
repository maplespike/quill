// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Data Freshness Tracker
 *
 * Tracks when data was last ingested for each source,
 * computes freshness_seconds, confidence, and certainty_score.
 */

type Confidence = 'high' | 'medium' | 'low';

/** Tracked source entry */
interface IngestionRecord {
  lastIngestedAt: number; // epoch ms
  /** 7-day uptime ratio (0.0 – 1.0) — set via recordUptime */
  uptime7d: number;
}

const ingestionStore = new Map<string, IngestionRecord>();

/**
 * Record that a source was just ingested / fetched.
 */
export function recordIngestion(source: string): void {
  const existing = ingestionStore.get(source);
  ingestionStore.set(source, {
    lastIngestedAt: Date.now(),
    uptime7d: existing?.uptime7d ?? 0.98,
  });
}

/**
 * Record a source uptime reading (e.g. from health checks).
 */
export function recordUptime(source: string, uptime: number): void {
  const existing = ingestionStore.get(source) ?? {
    lastIngestedAt: Date.now(),
    uptime7d: 0.98,
  };
  ingestionStore.set(source, {
    ...existing,
    uptime7d: Math.max(0, Math.min(1, uptime)),
  });
}

/**
 * Get freshness (seconds since last ingestion) for a source.
 * Returns Infinity if source was never ingested.
 */
export function getFreshness(source: string): number {
  const record = ingestionStore.get(source);
  if (!record) return Infinity;
  return Math.floor((Date.now() - record.lastIngestedAt) / 1000);
}

/**
 * Get confidence level based on age of data.
 *
 * Rules:
 *   - < 1 hour: high
 *   - < 24 hours: medium
 *   - >= 24 hours: low
 *   - unknown source: low
 */
export function getConfidence(source: string): Confidence {
  const freshness = getFreshness(source);
  if (freshness === Infinity) return 'low';
  if (freshness < 3600) return 'high';    // < 1 hour
  if (freshness < 86400) return 'medium'; // < 24 hours
  return 'low';
}

/**
 * Get certainty score (0.0 – 1.0) based on freshness and uptime.
 *
 * Score = base (from freshness) * uptime factor
 *   freshness < 1 hour:   base = 0.95
 *   freshness < 24 hours:  base = 0.80
 *   freshness < 7 days:    base = 0.60
 *   older:                base = 0.40
 *   unknown source:       base = 0.30
 */
export function getCertainty(source: string): number {
  const freshness = getFreshness(source);
  const record = ingestionStore.get(source);

  let base: number;
  if (freshness === Infinity) {
    base = 0.30;
  } else if (freshness < 3600) {
    base = 0.95;
  } else if (freshness < 86400) {
    base = 0.80;
  } else if (freshness < 604800) {
    base = 0.60;
  } else {
    base = 0.40;
  }

  const uptime = record?.uptime7d ?? 0.95;
  return Math.round((base * uptime) * 1000) / 1000;
}

/**
 * Record ingestion and uptime for a source in one call.
 */
export function recordSourceStatus(
  source: string,
  uptime?: number,
): void {
  recordIngestion(source);
  if (uptime !== undefined) {
    recordUptime(source, uptime);
  }
}

/**
 * Seed common data sources with realistic initial values.
 */
export function seedFreshness(): void {
  const now = Date.now();
  const sources: Array<{ name: string; ageSeconds: number; uptime: number }> = [
    { name: 'statcan',               ageSeconds: 300,    uptime: 0.99 },
    { name: 'open.canada.ca',        ageSeconds: 600,    uptime: 0.98 },
    { name: 'committees',            ageSeconds: 1800,   uptime: 0.97 },
    { name: 'lobbying',              ageSeconds: 3600,   uptime: 0.96 },
    { name: 'procurement',           ageSeconds: 7200,   uptime: 0.95 },
    { name: 'gazette',               ageSeconds: 900,    uptime: 0.99 },
    { name: 'elections',             ageSeconds: 14400,  uptime: 0.94 },
    { name: 'oversight',             ageSeconds: 43200,  uptime: 0.93 },
    { name: 'canlii',                ageSeconds: 600,    uptime: 0.97 },
  ];

  for (const src of sources) {
    ingestionStore.set(src.name, {
      lastIngestedAt: now - src.ageSeconds * 1000,
      uptime7d: src.uptime,
    });
  }
}

// Seed on import
seedFreshness();
