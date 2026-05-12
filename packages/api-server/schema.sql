-- CivInt Canada — D1 Database Schema
-- Multi-tenant API gateway storage
-- SQLite / Cloudflare D1 compatible

-- ═══════════════════════════════════════════════════════════════
-- TENANTS — Organizations / users with API access
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,                          -- UUID
  name TEXT NOT NULL,                           -- Organization or user name
  email TEXT,                                   -- Contact email
  tier TEXT NOT NULL DEFAULT 'free',            -- free | pro | business | enterprise | internal
  is_active INTEGER DEFAULT 1,
  journalism_mode INTEGER DEFAULT 0,            -- 1 = can bypass curation thresholds
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- API KEYS — Bearer tokens for auth
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,                          -- UUID
  tenant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,                -- SHA-256 of the API key
  name TEXT DEFAULT 'default',                  -- Human label (e.g. "dev", "prod")
  is_active INTEGER DEFAULT 1,
  last_used_at TEXT,
  expires_at TEXT,                              -- NULL = never expires
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_keys_active ON api_keys(is_active);

-- ═══════════════════════════════════════════════════════════════
-- DAILY USAGE — Per-tenant call counters
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,                           -- YYYY-MM-DD
  call_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, date),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON daily_usage(tenant_id, date);

-- ═══════════════════════════════════════════════════════════════
-- MONTHLY USAGE — Per-tenant monthly counters (for billing)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS monthly_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  year_month TEXT NOT NULL,                     -- YYYY-MM
  call_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, year_month),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monthly_tenant ON monthly_usage(tenant_id, year_month);

-- ═══════════════════════════════════════════════════════════════
-- AUDIT LOG — Immutable operation trail (AIDA compliance)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  api_key_id TEXT,
  operation TEXT NOT NULL,                      -- curation | insights | bias_analysis | citation | gov_data | ingestion
  model TEXT,                                   -- AI model used, or NULL
  endpoint TEXT,                                -- API endpoint called
  input_preview TEXT,                           -- Truncated input
  output_summary TEXT,                          -- Short summary of result
  confidence INTEGER,                           -- 0-100 or NULL
  success INTEGER DEFAULT 1,                    -- 1 = success, 0 = failure
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Internal tenant for Frostbite Gazette
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO tenants (id, name, tier, journalism_mode) VALUES
  ('fg-internal', 'Frostbite Gazette', 'internal', 1);

-- Dev/test API key (SHA-256 of "civint-dev-key")
INSERT OR IGNORE INTO api_keys (id, tenant_id, key_hash, name) VALUES
  ('dev-key-1', 'fg-internal', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'dev');
