-- SPDX-License-Identifier: AGPL-3.0-only
-- Migration: Add entity_mentions table for cross-module entity resolution
-- Date: 2026-05-22
-- Issue: #412

CREATE TABLE IF NOT EXISTS entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,           -- Canonical entity identifier (slug or UUID)
    source_table TEXT NOT NULL,
    source_id TEXT NOT NULL,
    raw_name TEXT NOT NULL,
    normalized_name TEXT,
    mention_type TEXT CHECK(mention_type IN ('person', 'organization', 'committee', 'location', 'other')),
    context_json JSON,
    confidence REAL DEFAULT 1.0,
    match_method TEXT DEFAULT 'exact' CHECK(match_method IN ('exact', 'fuzzy', 'manual', 'graph')),
    source_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast resolution and graph queries
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_normalized_name ON entity_mentions(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_source ON entity_mentions(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_confidence ON entity_mentions(confidence);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_entity_mentions_timestamp
AFTER UPDATE ON entity_mentions
BEGIN
    UPDATE entity_mentions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
