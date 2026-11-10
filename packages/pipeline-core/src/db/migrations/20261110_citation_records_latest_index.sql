-- Forward-only index for CitationStore.latest (GET /v1/claims/latest).
-- Safe on a database that already has citation_records.
-- The store applies this same statement from CITATION_RECORDS_DDL on open.
-- runMigrations applies it too. No down migration.

CREATE INDEX IF NOT EXISTS idx_citation_records_created_at_hash
  ON citation_records (created_at DESC, hash DESC);
