-- SPDX-License-Identifier: AGPL-3.0-only
-- Data Quality Scores
-- Persists computed quality scores per module/source so they can be
-- queried without recomputing, and tracked over time for trend analysis.
--
-- Dimensions: freshness (how recent), completeness (field coverage),
-- provenance (source trust + attestation). Composite is a weighted average.
--
-- Convention: the score JSON blob in `details` stores the full axis breakdown
-- for drill-down; the scalar columns support fast filtering and sorting.

CREATE TABLE IF NOT EXISTS quality_scores (
    id              TEXT PRIMARY KEY,
    source          TEXT NOT NULL,
    composite_score REAL NOT NULL CHECK (composite_score >= 0.0 AND composite_score <= 1.0),
    composite_level TEXT NOT NULL CHECK (composite_level IN ('excellent','good','fair','poor','unknown')),
    freshness_score REAL NOT NULL CHECK (freshness_score >= 0.0 AND freshness_score <= 1.0),
    freshness_level TEXT NOT NULL CHECK (freshness_level IN ('excellent','good','fair','poor','unknown')),
    completeness_score REAL NOT NULL CHECK (completeness_score >= 0.0 AND completeness_score <= 1.0),
    completeness_level TEXT NOT NULL CHECK (completeness_level IN ('excellent','good','fair','poor','unknown')),
    provenance_score REAL NOT NULL CHECK (provenance_score >= 0.0 AND provenance_score <= 1.0),
    provenance_level TEXT NOT NULL CHECK (provenance_level IN ('excellent','good','fair','poor','unknown')),
    record_count    INTEGER NOT NULL DEFAULT 0,
    details         TEXT NOT NULL DEFAULT '{}',  -- JSON blob with full per-axis breakdown
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quality_scores_source ON quality_scores(source);
CREATE INDEX IF NOT EXISTS idx_quality_scores_composite ON quality_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_quality_scores_updated ON quality_scores(updated_at DESC);

-- Unique constraint: one quality score per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_scores_source_unique ON quality_scores(source);
