-- SPDX-License-Identifier: AGPL-3.0-only
-- Journalism Mode: Annotations Table
-- Stores notes, flags, overrides, and context annotations for journalism workflow
-- Enables persistent storage for MCP tool /api/annotations endpoint

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  annotation_type TEXT NOT NULL CHECK(annotation_type IN ('note','override','flag','context')),
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotations_entity ON annotations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(annotation_type);
CREATE INDEX IF NOT EXISTS idx_annotations_created ON annotations(created_at DESC);