-- Canonical D1 Schema — Frostbite Data Pipeline
--
-- Resolves the 3-schema problem documented in AGENTS.md.
-- This is the authoritative schema: cloudflare/schema.sql was the production schema,
-- with the audit_log table added and auth tables retained for compatibility.
--
-- Origin: cloudflare/schema.sql (200 lines, D1 production schema)

-- Articles table (canonical layout from D1 production)
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  published_at TEXT NOT NULL,
  category TEXT NOT NULL,

  -- AI Curation fields
  curation_score INTEGER,
  canadian_relevance INTEGER,
  accountability_value INTEGER,
  mission_alignment INTEGER,
  source_quality INTEGER,
  urgency INTEGER,
  curation_reason TEXT,
  is_breaking INTEGER DEFAULT 0,
  ai_newsroom_featured INTEGER DEFAULT 0,

  -- Community fields
  votes INTEGER DEFAULT 0,
  ai_synthesized INTEGER DEFAULT 0,

  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Hash for deduplication
  url_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_score ON articles(curation_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON articles(url_hash);

-- RSS Sources table
CREATE TABLE IF NOT EXISTS rss_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_fetched TEXT,
  last_error TEXT,
  article_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rss_sources_active ON rss_sources(is_active);

-- Citation verification hashes
CREATE TABLE IF NOT EXISTS citation_hashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  algorithm TEXT DEFAULT 'sha256',
  hash_length INTEGER,
  computed_at TEXT DEFAULT (datetime('now')),
  verified_count INTEGER DEFAULT 0,
  last_verified_at TEXT,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_citation_article ON citation_hashes(article_id);

-- Government data releases cache (synced from cluster CronJob)
CREATE TABLE IF NOT EXISTS gov_releases_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  release_date TEXT,
  data_url TEXT,
  jurisdiction TEXT DEFAULT 'federal',
  category TEXT,
  retrieved_at TEXT NOT NULL,
  UNIQUE(source, title)
);

CREATE INDEX IF NOT EXISTS idx_releases_date ON gov_releases_cache(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_releases_jurisdiction ON gov_releases_cache(jurisdiction);

-- Committee evidence tracking
CREATE TABLE IF NOT EXISTS committee_meetings (
  id TEXT PRIMARY KEY,
  committee_acronym TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  parliament INTEGER NOT NULL,
  session INTEGER NOT NULL,
  meeting_number INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  in_camera INTEGER DEFAULT 0,
  in_camera_note TEXT,
  evidence_url TEXT NOT NULL,
  xml_url TEXT NOT NULL,
  subject TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(parliament, session, committee_acronym, meeting_number)
);

CREATE INDEX IF NOT EXISTS idx_cm_committee ON committee_meetings(committee_acronym);
CREATE INDEX IF NOT EXISTS idx_cm_date ON committee_meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_cm_in_camera ON committee_meetings(in_camera);

CREATE TABLE IF NOT EXISTS committee_interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  speaker_name TEXT NOT NULL,
  speaker_affiliation TEXT,
  speaker_party TEXT,
  speaker_role TEXT,
  intervention_type TEXT,
  language TEXT DEFAULT 'EN',
  text TEXT NOT NULL,
  timestamp TEXT,
  UNIQUE(meeting_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_ci_meeting ON committee_interventions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ci_speaker ON committee_interventions(speaker_name);
CREATE INDEX IF NOT EXISTS idx_ci_party ON committee_interventions(speaker_party);
CREATE INDEX IF NOT EXISTS idx_ci_search ON committee_interventions(speaker_name, speaker_party, language);

CREATE TABLE IF NOT EXISTS committee_speakers (
  name TEXT PRIMARY KEY,
  latest_affiliation TEXT,
  latest_party TEXT,
  total_appearances INTEGER DEFAULT 0,
  first_seen TEXT,
  last_seen TEXT
);

CREATE INDEX IF NOT EXISTS idx_cs_party ON committee_speakers(latest_party);

-- Audit log table (NEW — not in original FG schema)
-- Tracks every AI decision for AIDA compliance and debugging.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT NOT NULL,
  input_preview TEXT,
  output_summary TEXT,
  confidence INTEGER,
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  article_id INTEGER,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_article ON audit_log(article_id);

-- Quota tracking table
CREATE TABLE IF NOT EXISTS quota_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  ai_requests INTEGER DEFAULT 0,
  worker_requests INTEGER DEFAULT 0,
  d1_writes INTEGER DEFAULT 0,
  d1_reads INTEGER DEFAULT 0,
  articles_processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quota_date ON quota_usage(date);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  user_id INTEGER,
  user_handle TEXT,
  direction INTEGER NOT NULL,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, user_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_article ON votes(article_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_handle ON votes(user_handle);

-- Users table (for future auth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  provider TEXT,
  provider_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

-- Auth tables (privacy-first: no personal data)
CREATE TABLE IF NOT EXISTS auth_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  transports TEXT,
  user_handle TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  device_type TEXT,
  device_name TEXT
);

CREATE TABLE IF NOT EXISTS auth_wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL UNIQUE,
  chain_id INTEGER DEFAULT 1,
  user_handle TEXT NOT NULL UNIQUE,
  signature TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  wallet_label TEXT
);

CREATE TABLE IF NOT EXISTS auth_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_handle TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL UNIQUE,
  user_handle TEXT NOT NULL,
  auth_method TEXT NOT NULL,
  auth_identifier TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_handle) REFERENCES auth_users(user_handle)
);

-- Auth indexes
CREATE INDEX IF NOT EXISTS idx_auth_credentials_user ON auth_credentials(user_handle);
CREATE INDEX IF NOT EXISTS idx_auth_credentials_id ON auth_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_auth_wallets_user ON auth_wallets(user_handle);
CREATE INDEX IF NOT EXISTS idx_auth_wallets_address ON auth_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_handle);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Corporate / Business Data Tables
--
-- Tracks public-domain corporate data: lobbying, procurement,
-- executive statements, and business registrations.
--

-- Lobbying registry (Office of the Commissioner of Lobbying)
CREATE TABLE IF NOT EXISTS lobbying_records (
  id TEXT PRIMARY KEY,
  registrant_name TEXT NOT NULL,
  registrant_client TEXT,
  registrant_address TEXT,
  client_name TEXT NOT NULL,
  client_business TEXT,
  subject_matter TEXT,
  government_institution TEXT,
  public_office_holder TEXT,
  communication_date TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  lobbying_cost_cad REAL,
  lobbyist_type TEXT DEFAULT 'consultant',
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(registrant_name, client_name, communication_date, subject_matter)
);

CREATE INDEX IF NOT EXISTS idx_lobbying_client ON lobbying_records(client_name);
CREATE INDEX IF NOT EXISTS idx_lobbying_date ON lobbying_records(communication_date DESC);
CREATE INDEX IF NOT EXISTS idx_lobbying_institution ON lobbying_records(government_institution);
CREATE INDEX IF NOT EXISTS idx_lobbying_subject ON lobbying_records(subject_matter);

-- Government procurement contracts (CanadaBuys, proactive disclosure)
CREATE TABLE IF NOT EXISTS contract_awards (
  id TEXT PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  vendor_address TEXT,
  contract_value REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  award_date TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  department TEXT NOT NULL,
  department_acronym TEXT,
  procurement_method TEXT,
  gsin TEXT,
  trade_agreement TEXT,
  bids_received INTEGER,
  source_url TEXT NOT NULL,
  is_sole_source INTEGER DEFAULT 0,
  ingested_at TEXT NOT NULL,
  UNIQUE(vendor_name, department, award_date, contract_value)
);

CREATE INDEX IF NOT EXISTS idx_contract_vendor ON contract_awards(vendor_name);
CREATE INDEX IF NOT EXISTS idx_contract_department ON contract_awards(department);
CREATE INDEX IF NOT EXISTS idx_contract_date ON contract_awards(award_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_sole_source ON contract_awards(is_sole_source);
CREATE INDEX IF NOT EXISTS idx_contract_value ON contract_awards(contract_value DESC);

-- Executive public statements (earnings calls, press releases, regulatory filings)
CREATE TABLE IF NOT EXISTS executive_statements (
  id TEXT PRIMARY KEY,
  executive_name TEXT NOT NULL,
  executive_title TEXT,
  organization TEXT NOT NULL,
  organization_ticker TEXT,
  statement_type TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  excerpt TEXT,
  source_url TEXT NOT NULL,
  topics TEXT,
  is_committee_appearance INTEGER DEFAULT 0,
  committee_meeting_id TEXT,
  ingested_at TEXT NOT NULL,
  FOREIGN KEY (committee_meeting_id) REFERENCES committee_meetings(id)
);

CREATE INDEX IF NOT EXISTS idx_exec_org ON executive_statements(organization);
CREATE INDEX IF NOT EXISTS idx_exec_name ON executive_statements(executive_name);
CREATE INDEX IF NOT EXISTS idx_exec_type ON executive_statements(statement_type);
CREATE INDEX IF NOT EXISTS idx_exec_date ON executive_statements(date DESC);
CREATE INDEX IF NOT EXISTS idx_exec_committee ON executive_statements(committee_meeting_id);

-- Corporate entities (Corporations Canada)
CREATE TABLE IF NOT EXISTS corporate_entities (
  corporation_number TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  operating_names TEXT,
  jurisdiction TEXT DEFAULT 'federal',
  status TEXT,
  incorporation_date TEXT,
  office_address TEXT,
  directors TEXT,
  last_annual_return TEXT,
  source_url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_name ON corporate_entities(legal_name);
CREATE INDEX IF NOT EXISTS idx_entity_jurisdiction ON corporate_entities(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_entity_status ON corporate_entities(status);

-- Insider transactions (SEDI)
CREATE TABLE IF NOT EXISTS insider_transactions (
  id TEXT PRIMARY KEY,
  insider_name TEXT NOT NULL,
  insider_relation TEXT,
  issuer_name TEXT NOT NULL,
  issuer_ticker TEXT,
  transaction_date TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  security_type TEXT,
  number_of_units REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_value REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  ownership_after REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insider_name ON insider_transactions(insider_name);
CREATE INDEX IF NOT EXISTS idx_insider_issuer ON insider_transactions(issuer_name);
CREATE INDEX IF NOT EXISTS idx_insider_date ON insider_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_insider_type ON insider_transactions(transaction_type);

-- Influence Actor Tables
--
-- Tracks international organizations, NGOs, think tanks, consultancies,
-- and their documented connections to the Canadian government.
--

-- Tracked influence actors (IOs, NGOs, think tanks, consultancies)
CREATE TABLE IF NOT EXISTS influence_actors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  headquarters TEXT,
  founded_year INTEGER,
  annual_budget_cad REAL,
  website TEXT,
  wikipedia_url TEXT,
  is_cra_charity INTEGER DEFAULT 0,
  cra_bn TEXT,
  key_people_json TEXT,
  policy_areas TEXT,
  notes TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inf_category ON influence_actors(category);
CREATE INDEX IF NOT EXISTS idx_inf_priority ON influence_actors(priority);
CREATE INDEX IF NOT EXISTS idx_inf_cra_bn ON influence_actors(cra_bn);

-- Documented connections between influence actors and government
CREATE TABLE IF NOT EXISTS influence_connections (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES influence_actors(id),
  actor_name TEXT NOT NULL,
  government_entity TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  description TEXT,
  date TEXT,
  value_cad REAL,
  source_url TEXT,
  source_system TEXT NOT NULL,
  source_record_id TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inf_conn_actor ON influence_connections(actor_id);
CREATE INDEX IF NOT EXISTS idx_inf_conn_type ON influence_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_inf_conn_gov ON influence_connections(government_entity);
CREATE INDEX IF NOT EXISTS idx_inf_conn_date ON influence_connections(date);

-- Government funding flows to organizations
CREATE TABLE IF NOT EXISTS government_funding (
  id TEXT PRIMARY KEY,
  recipient_name TEXT NOT NULL,
  recipient_type TEXT,
  department TEXT NOT NULL,
  department_acronym TEXT,
  program_name TEXT NOT NULL,
  agreement_type TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  fiscal_year TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  source_url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_funding_recipient ON government_funding(recipient_name);
CREATE INDEX IF NOT EXISTS idx_funding_dept ON government_funding(department);
CREATE INDEX IF NOT EXISTS idx_funding_fiscal ON government_funding(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_funding_amount ON government_funding(amount DESC);

-- CRA charity registry cache
CREATE TABLE IF NOT EXISTS cra_charity_cache (
  bn TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  operating_names TEXT,
  status TEXT,
  category TEXT,
  designation TEXT,
  total_revenue REAL,
  total_assets REAL,
  programs TEXT,
  directors TEXT,
  fiscal_year_end TEXT,
  source_url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cra_name ON cra_charity_cache(legal_name);
