-- SPDX-License-Identifier: AGPL-3.0-only
-- Migration: Add entity_relationships table for cross-module relationship graphs
-- Date: 2026-05-23
-- Issue: #451

CREATE TABLE IF NOT EXISTS entity_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entity_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'is_same_as', 'is_related_to', 'works_at', 'is_director_of',
        'is_shareholder_of', 'lobbied_for', 'represents', 'is_located_in',
        'is_part_of', 'other'
    )),
    source_table TEXT,
    source_id TEXT,
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    citation_sha256 TEXT,
    trust_score REAL CHECK (trust_score >= 0 AND trust_score <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_relationships_source ON entity_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_target ON entity_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_type ON entity_relationships(relationship_type);
