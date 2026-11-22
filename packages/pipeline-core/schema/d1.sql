-- Canonical D1 Schema — Quill
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
  chamber TEXT NOT NULL DEFAULT 'commons',
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
  UNIQUE(chamber, parliament, session, committee_acronym, meeting_number)
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

-- Canada Gazette records — proposed (Part I) and enacted (Part II) regulations
CREATE TABLE IF NOT EXISTS gazette_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  html_url TEXT NOT NULL,
  part TEXT NOT NULL CHECK(part IN ('I', 'II', 'III')),
  published_at TEXT NOT NULL,
  description TEXT,
  registration_number TEXT,
  rias_url TEXT,
  rias_text TEXT,
  comment_deadline TEXT,
  department TEXT,
  regulation_id TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gazette_part ON gazette_records(part);
CREATE INDEX IF NOT EXISTS idx_gazette_published ON gazette_records(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_gazette_registration ON gazette_records(registration_number);
CREATE INDEX IF NOT EXISTS idx_gazette_department ON gazette_records(department);
CREATE INDEX IF NOT EXISTS idx_gazette_part_date ON gazette_records(part, published_at DESC);

-- Idempotent cap. Full RIAS text already stored is cut to 300 characters.
UPDATE gazette_records
SET rias_text = substr(rias_text, 1, 300)
WHERE rias_text IS NOT NULL AND length(rias_text) > 300;

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

-- GIC Appointments (Governor-in-Council)
--
-- Tracks federal GIC appointments to ~1,500+ positions across boards,
-- tribunals, commissions, agencies, and courts. This is the patronage
-- pipeline — the system through which the Governor-in-Council appoints
-- individuals to key regulatory, adjudicative, and advisory bodies.
--
-- Sources: GC InfoBase, Canada Gazette Orders in Council (open.canada.ca CKAN)
--
CREATE TABLE IF NOT EXISTS gic_appointments (
  id TEXT PRIMARY KEY,

  -- Appointee
  appointee_name TEXT NOT NULL,
  position_title TEXT NOT NULL,

  -- Organization / body receiving the appointment
  organization TEXT NOT NULL,
  organization_acronym TEXT,

  -- Classification
  category TEXT NOT NULL DEFAULT 'other',
  department TEXT NOT NULL,

  -- Dates
  appointment_date TEXT NOT NULL,
  expiry_date TEXT,
  is_retroactive INTEGER DEFAULT 0,

  -- Compensation
  salary_range TEXT,
  salary_min REAL,
  salary_max REAL,

  -- Metadata
  location TEXT,
  predecessor_name TEXT,
  order_in_council_number TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(appointee_name, position_title, organization, appointment_date)
);

-- Provincial Lobbying Registries
--
-- Tracks lobbying activities at the provincial level, normalized to
-- match the federal lobbying_records schema. The province field
-- distinguishes jurisdiction (ON, BC, AB, QC, etc.), enabling
-- cross-jurisdiction queries where a company may lobby both
-- federally and provincially on the same issue.
--
-- Sources:
--   - Ontario: Integrity Commissioner of Ontario (lobbyist.oico.on.ca)
--   - British Columbia: Office of the Registrar of Lobbyists
--   - Alberta: Office of the Ethics Commissioner
--   - Quebec: Commissaire au lobbyisme du Quebec
--
CREATE TABLE IF NOT EXISTS provincial_lobbying (
  id TEXT PRIMARY KEY,

  -- Jurisdiction
  province TEXT NOT NULL DEFAULT 'ON',

  -- Registrant information
  registrant_name TEXT NOT NULL,
  registrant_client TEXT,
  registrant_address TEXT,

  -- Client information
  client_name TEXT NOT NULL,
  client_business TEXT,

  -- Lobbying details
  subject_matter TEXT,
  government_institution TEXT,
  public_office_holder TEXT,

  -- Dates
  communication_date TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,

  -- Financials
  lobbying_cost_cad REAL,

  -- Classification
  lobbyist_type TEXT DEFAULT 'consultant',

  -- Provenance
  source_url TEXT NOT NULL,
  original_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'ontario-registry',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(province, registrant_name, client_name, communication_date)
);

CREATE INDEX IF NOT EXISTS idx_prov_lobbying_province ON provincial_lobbying(province);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_client ON provincial_lobbying(client_name);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_date ON provincial_lobbying(communication_date DESC);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_registrant ON provincial_lobbying(registrant_name);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_institution ON provincial_lobbying(government_institution);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_subject ON provincial_lobbying(subject_matter);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_province_client ON provincial_lobbying(province, client_name);
CREATE INDEX IF NOT EXISTS idx_prov_lobbying_source ON provincial_lobbying(source_system);

CREATE INDEX IF NOT EXISTS idx_gic_appointee ON gic_appointments(appointee_name);
CREATE INDEX IF NOT EXISTS idx_gic_organization ON gic_appointments(organization);
CREATE INDEX IF NOT EXISTS idx_gic_acronym ON gic_appointments(organization_acronym);
CREATE INDEX IF NOT EXISTS idx_gic_category ON gic_appointments(category);
CREATE INDEX IF NOT EXISTS idx_gic_department ON gic_appointments(department);
CREATE INDEX IF NOT EXISTS idx_gic_appointment_date ON gic_appointments(appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_gic_expiry ON gic_appointments(expiry_date);
CREATE INDEX IF NOT EXISTS idx_gic_oin ON gic_appointments(order_in_council_number);
CREATE INDEX IF NOT EXISTS idx_gic_source ON gic_appointments(source_system);

-- Independent Oversight Bodies tables
--
-- Tracks reports, investigations, and recommendations from Canada's
-- independent oversight bodies: OAG, PBO, Ethics Commissioner, etc.
-- Recommendation tracking is the key feature.
--

-- Oversight body reports
CREATE TABLE IF NOT EXISTS oversight_reports (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL CHECK(body IN ('OAG','PBO','EthicsCommissioner','LobbyingCommissioner','CompetitionBureau','CRTC','PrivacyCommissioner','InformationCommissioner','OfficialLanguagesCommissioner','CanadianHumanRightsCommission')),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  pdf_url TEXT,
  report_type TEXT NOT NULL,
  summary TEXT,
  findings_json TEXT,
  audited_entities_json TEXT,
  fiscal_year TEXT,
  report_number TEXT,
  language TEXT DEFAULT 'en',
  ingested_at TEXT NOT NULL,
  UNIQUE(body, url)
);

CREATE INDEX IF NOT EXISTS idx_or_body ON oversight_reports(body);
CREATE INDEX IF NOT EXISTS idx_or_date ON oversight_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_or_type ON oversight_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_or_fiscal ON oversight_reports(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_or_body_date ON oversight_reports(body, date DESC);

-- Oversight report recommendations
CREATE TABLE IF NOT EXISTS oversight_recommendations (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES oversight_reports(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('implemented','partially-implemented','not-implemented','in-progress','no-longer-valid','unknown')),
  responsible_entity TEXT,
  status_date TEXT,
  target_date TEXT,
  implementation_notes TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(report_id, number)
);

CREATE INDEX IF NOT EXISTS idx_or_rec_report ON oversight_recommendations(report_id);
CREATE INDEX IF NOT EXISTS idx_or_rec_status ON oversight_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_or_rec_entity ON oversight_recommendations(responsible_entity);
CREATE INDEX IF NOT EXISTS idx_or_rec_report_status ON oversight_recommendations(report_id, status);

-- Competition Bureau merger reviews
-- Tracks merger reviews for anti-competitive effects — reveals corporate power consolidation
CREATE TABLE IF NOT EXISTS merger_reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  parties_json TEXT NOT NULL,           -- JSON array of merging parties
  sector TEXT,
  outcome TEXT NOT NULL DEFAULT 'unknown' CHECK(outcome IN ('cleared','challenged','settled','withdrawn','ongoing','unknown')),
  conditions_json TEXT,                  -- JSON array of conditions imposed
  anti_competitive_concerns INTEGER DEFAULT 0,
  market_definition TEXT,
  findings_json TEXT,                    -- JSON array of key findings
  ingested_at TEXT NOT NULL,
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_mr_date ON merger_reviews(date DESC);
CREATE INDEX IF NOT EXISTS idx_mr_outcome ON merger_reviews(outcome);
CREATE INDEX IF NOT EXISTS idx_mr_sector ON merger_reviews(sector);
CREATE INDEX IF NOT EXISTS idx_mr_anticomp ON merger_reviews(anti_competitive_concerns);
CREATE INDEX IF NOT EXISTS idx_mr_date_outcome ON merger_reviews(outcome, date DESC);

-- CRTC regulatory decisions
-- Broadcasting/telecom regulatory decisions, ownership changes, net neutrality rulings
CREATE TABLE IF NOT EXISTS crtc_decisions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  decision_type TEXT NOT NULL DEFAULT 'broadcasting-decision' CHECK(decision_type IN ('broadcasting-decision','telecom-decision','ownership-change','policy','notice-consultation')),
  decision_number TEXT,
  affected_parties_json TEXT,            -- JSON array of companies/entities affected
  findings_json TEXT,                     -- JSON array of regulatory findings
  conditions_json TEXT,                   -- JSON array of conditions imposed
  is_ownership_change INTEGER DEFAULT 0,
  is_net_neutrality INTEGER DEFAULT 0,
  is_telecom_pricing INTEGER DEFAULT 0,
  is_broadcasting_content INTEGER DEFAULT 0,
  ingested_at TEXT NOT NULL,
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_crtc_date ON crtc_decisions(date DESC);
CREATE INDEX IF NOT EXISTS idx_crtc_type ON crtc_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_crtc_ownership ON crtc_decisions(is_ownership_change);
CREATE INDEX IF NOT EXISTS idx_crtc_netneutrality ON crtc_decisions(is_net_neutrality);
CREATE INDEX IF NOT EXISTS idx_crtc_pricing ON crtc_decisions(is_telecom_pricing);
CREATE INDEX IF NOT EXISTS idx_crtc_number ON crtc_decisions(decision_number);
CREATE INDEX IF NOT EXISTS idx_crtc_type_date ON crtc_decisions(decision_type, date DESC);

-- CRTC media ownership records
-- Tracks ownership of broadcasting and telecom undertakings, including
-- ownership percentages, parent companies, and transfers of control.
-- Key for media consolidation monitoring: Bell, Rogers, Quebecor, Shaw, etc.
CREATE TABLE IF NOT EXISTS crtc_ownership (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK(record_type IN ('broadcasting-undertaking','telecom-undertaking','media-ownership-group','transfer-of-control','transfer-of-ownership')),
  undertaking_name TEXT NOT NULL,
  undertaking_type TEXT NOT NULL,
  service_area TEXT,
  licence_number TEXT,
  owner_name TEXT NOT NULL,
  parent_company TEXT,
  ownership_percentage REAL,
  effective_date TEXT,
  published_date TEXT,
  transaction_value REAL,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(undertaking_name, owner_name, source_url)
);

CREATE INDEX IF NOT EXISTS idx_crtc_own_undertaking ON crtc_ownership(undertaking_name);
CREATE INDEX IF NOT EXISTS idx_crtc_own_owner ON crtc_ownership(owner_name);
CREATE INDEX IF NOT EXISTS idx_crtc_own_parent ON crtc_ownership(parent_company);
CREATE INDEX IF NOT EXISTS idx_crtc_own_type ON crtc_ownership(record_type);
CREATE INDEX IF NOT EXISTS idx_crtc_own_area ON crtc_ownership(service_area);
CREATE INDEX IF NOT EXISTS idx_crtc_own_effective_date ON crtc_ownership(effective_date);
CREATE INDEX IF NOT EXISTS idx_crtc_own_published_date ON crtc_ownership(published_date);
CREATE INDEX IF NOT EXISTS idx_crtc_own_undertaker_owner ON crtc_ownership(undertaking_name, owner_name);
CREATE INDEX IF NOT EXISTS idx_crtc_own_parent_owner ON crtc_ownership(parent_company, owner_name);

-- Oversight body investigations (Ethics Commissioner, Lobbying Commissioner)
--
-- Tracks investigations conducted by ethics and lobbying commissioners.
-- These are distinct from oversight_reports (audits/publications) and
-- store investigation-specific fields: subject of investigation, outcome,
-- and involved parties.
--
-- Cross-reference use case: link ethics investigations into ministers
-- with the company involved in the violation, and whether that company
-- lobbied the minister.
--
CREATE TABLE IF NOT EXISTS oversight_investigations (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL CHECK(body IN ('EthicsCommissioner','LobbyingCommissioner','PrivacyCommissioner','InformationCommissioner','OfficialLanguagesCommissioner')),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  date_opened TEXT NOT NULL,
  date_closed TEXT,
  summary TEXT,
  findings_json TEXT,
  outcome TEXT,
  parties_json TEXT,
  url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(body, url)
);

CREATE INDEX IF NOT EXISTS idx_oi_body ON oversight_investigations(body);
CREATE INDEX IF NOT EXISTS idx_oi_subject ON oversight_investigations(subject);
CREATE INDEX IF NOT EXISTS idx_oi_date ON oversight_investigations(date_opened DESC);
CREATE INDEX IF NOT EXISTS idx_oi_outcome ON oversight_investigations(outcome);
CREATE INDEX IF NOT EXISTS idx_oi_body_subject ON oversight_investigations(body, subject);

-- Investigation recommendations (for Ethics/Lobbying Commissioner reports)
CREATE TABLE IF NOT EXISTS oversight_investigation_recommendations (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES oversight_investigations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('implemented','partially-implemented','not-implemented','in-progress','no-longer-valid','unknown')),
  responsible_entity TEXT,
  status_date TEXT,
  target_date TEXT,
  implementation_notes TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(investigation_id, number)
);

CREATE INDEX IF NOT EXISTS idx_oir_inv ON oversight_investigation_recommendations(investigation_id);
CREATE INDEX IF NOT EXISTS idx_oir_status ON oversight_investigation_recommendations(status);

-- Elections Canada Third-Party Advertiser Registry
--
-- Tracks organizations and individuals who register as third-party
-- advertisers under the Canada Elections Act. Third parties spend money
-- on federal election advertising outside of political parties --
-- including unions, corporations, issue groups, and individuals.
--
-- This is the "dark money in elections" data source, enabling
-- cross-referencing with influence tracking (is a tracked IO/NGO also
-- a third-party advertiser?) and corporate tracking (is a tracked
-- company associated?).
--
-- Sources: Elections.ca registry, open.canada.ca CKAN datasets
--
CREATE TABLE IF NOT EXISTS third_party_ads (
  id TEXT PRIMARY KEY,

  -- Registrant identity
  registrant_name TEXT NOT NULL,
  registrant_type TEXT NOT NULL CHECK(registrant_type IN ('union', 'corporation', 'issue-group', 'individual', 'other')),

  -- Contact info
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  telephone TEXT,

  -- Responsible officer (for organizations)
  officer_name TEXT,
  officer_title TEXT,

  -- Advertising targeting
  targeted_ridings TEXT,       -- JSON array of electoral district names
  issue_focus TEXT,            -- JSON array of issue keywords
  platforms TEXT,              -- JSON array of advertising platforms

  -- Election period
  election_period_type TEXT NOT NULL DEFAULT 'election',
  election_name TEXT,
  election_period_start TEXT,
  election_period_end TEXT,

  -- Financial data
  total_spending REAL,
  spending_limit REAL,

  -- Registration metadata
  registration_number TEXT,
  registration_date TEXT,

  -- Cross-references
  is_tracked_influence_actor INTEGER DEFAULT 0,
  influence_actor_id TEXT,
  is_tracked_corporate_entity INTEGER DEFAULT 0,
  corporate_entity_number TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(registrant_name, registration_number, registration_date)
);

CREATE INDEX IF NOT EXISTS idx_tpa_name ON third_party_ads(registrant_name);
CREATE INDEX IF NOT EXISTS idx_tpa_type ON third_party_ads(registrant_type);
CREATE INDEX IF NOT EXISTS idx_tpa_province ON third_party_ads(province);
CREATE INDEX IF NOT EXISTS idx_tpa_spending ON third_party_ads(total_spending DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_period ON third_party_ads(election_period_type);
CREATE INDEX IF NOT EXISTS idx_tpa_registration ON third_party_ads(registration_date);
CREATE INDEX IF NOT EXISTS idx_tpa_influence ON third_party_ads(is_tracked_influence_actor);
CREATE INDEX IF NOT EXISTS idx_tpa_corporate ON third_party_ads(is_tracked_corporate_entity);
CREATE INDEX IF NOT EXISTS idx_tpa_source ON third_party_ads(source_system);

-- Third-party spending detail records
CREATE TABLE IF NOT EXISTS third_party_spending (
  id TEXT PRIMARY KEY,

  -- Link to advertiser registry record
  third_party_ad_id TEXT,
  registrant_name TEXT NOT NULL,

  -- Reporting period
  reporting_period TEXT NOT NULL,

  -- Spending detail
  platform TEXT NOT NULL,
  amount REAL NOT NULL,
  spending_category TEXT,
  vendor_name TEXT,
  targeted_riding TEXT,
  expense_date TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  FOREIGN KEY (third_party_ad_id) REFERENCES third_party_ads(id),
  UNIQUE(registrant_name, reporting_period, platform, amount, expense_date)
);

CREATE INDEX IF NOT EXISTS idx_tps_ad_id ON third_party_spending(third_party_ad_id);
CREATE INDEX IF NOT EXISTS idx_tps_name ON third_party_spending(registrant_name);
CREATE INDEX IF NOT EXISTS idx_tps_period ON third_party_spending(reporting_period);
CREATE INDEX IF NOT EXISTS idx_tps_platform ON third_party_spending(platform);
CREATE INDEX IF NOT EXISTS idx_tps_amount ON third_party_spending(amount DESC);
CREATE INDEX IF NOT EXISTS idx_tps_riding ON third_party_spending(targeted_riding);

-- CanLII Court Decisions tables
--
-- Tracks metadata for Canadian court decisions from the CanLII API.
-- Key courts: Supreme Court of Canada, Federal Court, Federal Court of Appeal, Tax Court.
-- Every decision that reviews a government action interprets a regulation.
-- Cross-reference with: tracked companies (are they litigating?),
-- tracked influence actors (interveners in court cases).
--
-- Sources: api.canlii.org/v1 (caseBrowse, caseCitator endpoints)
--

-- CanLII decisions metadata (full text deferred)
CREATE TABLE IF NOT EXISTS canlii_decisions (
  id TEXT PRIMARY KEY,

  -- CanLII source identifiers
  database_id TEXT NOT NULL,
  case_id TEXT NOT NULL,

  -- Case metadata
  case_name TEXT NOT NULL,
  court TEXT NOT NULL CHECK(court IN ('SCC', 'FCA', 'FC', 'TCC')),
  decision_date TEXT,

  -- Identifiers
  docket_number TEXT,
  citation TEXT,
  all_citations TEXT,

  -- URLs
  url TEXT,

  -- Case details
  language TEXT NOT NULL DEFAULT 'en',
  keywords TEXT,
  concatenated_id TEXT,
  summary TEXT,
  parties_json TEXT,

  -- Citation graphs (JSON arrays)
  cited_cases_json TEXT,
  citing_cases_json TEXT,
  cited_legislation_json TEXT,

  -- Relevance flags
  reviews_government_action INTEGER DEFAULT 0,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(database_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_canlii_court ON canlii_decisions(court);
CREATE INDEX IF NOT EXISTS idx_canlii_decision_date ON canlii_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_canlii_case_name ON canlii_decisions(case_name);
CREATE INDEX IF NOT EXISTS idx_canlii_keywords ON canlii_decisions(keywords);
CREATE INDEX IF NOT EXISTS idx_canlii_reviews_gov ON canlii_decisions(reviews_government_action);
CREATE INDEX IF NOT EXISTS idx_canlii_database_case ON canlii_decisions(database_id, case_id);
CREATE INDEX IF NOT EXISTS idx_canlii_ingested ON canlii_decisions(ingested_at DESC);

-- CanLII citation graph edges
-- Tracks case-to-case and case-to-legislation citation relationships.
CREATE TABLE IF NOT EXISTS canlii_citations (
  id TEXT PRIMARY KEY,

  -- Source decision (the decision that contains the citation)
  decision_id TEXT NOT NULL REFERENCES canlii_decisions(id) ON DELETE CASCADE,

  -- Citation target
  cited_database_id TEXT NOT NULL,
  cited_case_id TEXT,
  cited_title TEXT NOT NULL,
  cited_citation TEXT NOT NULL,

  -- Citation type
  citation_type TEXT NOT NULL CHECK(citation_type IN ('cited-case', 'citing-case', 'cited-legislation')),

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(decision_id, cited_citation, citation_type)
);

CREATE INDEX IF NOT EXISTS idx_canlii_cit_decision ON canlii_citations(decision_id);
CREATE INDEX IF NOT EXISTS idx_canlii_cit_target ON canlii_citations(cited_citation);
CREATE INDEX IF NOT EXISTS idx_canlii_cit_type ON canlii_citations(citation_type);
CREATE INDEX IF NOT EXISTS idx_canlii_cit_target_type ON canlii_citations(cited_citation, citation_type);

-- LMIA (Labour Market Impact Assessment) records — ESDC quarterly data
--
-- Tracks employers who received positive or negative Labour Market Impact
-- Assessments from Employment and Social Development Canada (ESDC).
-- Data published quarterly since 2014 on open.canada.ca.
--
-- Cross-reference opportunities:
--   - Corporate module: companies using TFW program with known lobbying/contracts
--   - Procurement: companies with government contracts who also use TFWs
--
CREATE TABLE IF NOT EXISTS lmia_records (
  id TEXT PRIMARY KEY,
  employer TEXT NOT NULL,
  city TEXT,
  province TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('positive', 'negative')),
  stream TEXT NOT NULL,
  stream_raw TEXT NOT NULL,
  noc TEXT,
  noc_title TEXT,
  positions INTEGER,
  wage_min REAL,
  wage_max REAL,
  wage_rate TEXT,
  quarter TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lmia_employer ON lmia_records(employer);
CREATE INDEX IF NOT EXISTS idx_lmia_outcome ON lmia_records(outcome);
CREATE INDEX IF NOT EXISTS idx_lmia_stream ON lmia_records(stream);
CREATE INDEX IF NOT EXISTS idx_lmia_province ON lmia_records(province);
CREATE INDEX IF NOT EXISTS idx_lmia_noc ON lmia_records(noc);
CREATE INDEX IF NOT EXISTS idx_lmia_quarter ON lmia_records(quarter);
CREATE INDEX IF NOT EXISTS idx_lmia_quarter_outcome ON lmia_records(quarter, outcome);
CREATE INDEX IF NOT EXISTS idx_lmia_employer_quarter ON lmia_records(employer, quarter);
CREATE INDEX IF NOT EXISTS idx_lmia_employer_outcome ON lmia_records(employer, outcome);

-- Proactive Disclosure Records — federal contracts over $10K, travel, hospitality, reclassification
--
-- Every Canadian federal department is required to proactively disclose:
--   - Contracts over $10,000 (including amendments)
--   - Travel expenses of senior officials
--   - Hospitality expenses
--   - Reclassification of public service positions
--
-- Data is published on open.canada.ca via CKAN with varying schema formats
-- across departments. This table normalises them into a unified structure.
--
-- Cross-reference opportunities:
--   - Corporate module: match vendor names to known corporate entities
--   - Lobbying: identify contractors that lobby the departments they sell to
--   - Influence tracking: trace government contract funding flows
--
CREATE TABLE IF NOT EXISTS proactive_disclosure (
  id TEXT PRIMARY KEY,

  -- Department information
  department TEXT NOT NULL,
  department_acronym TEXT,

  -- Vendor / supplier
  vendor_name TEXT NOT NULL,

  -- Contract financials
  contract_value REAL,
  currency TEXT DEFAULT 'CAD',

  -- Dates
  award_date TEXT,
  contract_period_start TEXT,
  contract_period_end TEXT,

  -- Classification
  goods_or_services TEXT,
  procurement_method TEXT,

  -- Description
  description TEXT,
  comments TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,

  -- Fiscal year
  fiscal_year TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(vendor_name, department, award_date, contract_value)
);

CREATE INDEX IF NOT EXISTS idx_pd_vendor ON proactive_disclosure(vendor_name);
CREATE INDEX IF NOT EXISTS idx_pd_department ON proactive_disclosure(department);
CREATE INDEX IF NOT EXISTS idx_pd_award_date ON proactive_disclosure(award_date DESC);
CREATE INDEX IF NOT EXISTS idx_pd_contract_value ON proactive_disclosure(contract_value DESC);
CREATE INDEX IF NOT EXISTS idx_pd_fiscal_year ON proactive_disclosure(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_pd_procurement_method ON proactive_disclosure(procurement_method);
CREATE INDEX IF NOT EXISTS idx_pd_goods_services ON proactive_disclosure(goods_or_services);
CREATE INDEX IF NOT EXISTS idx_pd_dept_date ON proactive_disclosure(department, award_date DESC);
CREATE INDEX IF NOT EXISTS idx_pd_vendor_dept ON proactive_disclosure(vendor_name, department);
CREATE INDEX IF NOT EXISTS idx_pd_ingested ON proactive_disclosure(ingested_at DESC);

-- Provincial Legislatures — Hansard, committees, and bills across all 10 provinces
--
-- Tracks legislative activity at the provincial level: Hansard transcripts,
-- committee hearings, and bill progress. Each province publishes data in
-- a different format — this table normalises across all of them.
--
-- Sources:
--   - Ontario: ola.org (XML Hansard, committees API)
--   - BC: leg.bc.ca (Hansard XML, committee pages)
--   - Alberta: assembly.ab.ca (Hansard HTML, committee hearings)
--   - Quebec: assnat.qc.ca (Hansard XML, French + English)
--   - Others: various HTML/PDF formats
--
-- Cross-reference opportunities:
--   - Provincial lobbying: match speakers/lobbyists to lobbying records
--   - Federal committees: connect provincial legislative activity to federal
--   - Legislative agenda tracking: monitor bill progress across provinces
--
CREATE TABLE IF NOT EXISTS provincial_legislatures (
  id TEXT PRIMARY KEY,

  -- Jurisdiction
  province TEXT NOT NULL CHECK(province IN ('ON','BC','AB','QC','SK','MB','NS','NB','NL','PE','NT','YT','NU')),
  record_type TEXT NOT NULL CHECK(record_type IN ('hansard','committee','bill')),
  chamber TEXT NOT NULL DEFAULT 'legislative-assembly',

  -- Date
  sitting_date TEXT,

  -- Hansard / transcript
  hansard_url TEXT,
  topic TEXT,
  speaker TEXT,
  party TEXT,
  riding TEXT,
  text_excerpt TEXT,

  -- Bill reference
  bill_reference TEXT,
  bill_number TEXT,
  bill_title TEXT,
  bill_status TEXT,
  bill_date TEXT,

  -- Committee info
  committee_name TEXT,
  meeting_number INTEGER,
  meeting_start_time TEXT,
  meeting_end_time TEXT,
  intervention_count INTEGER,

  -- Language
  language TEXT DEFAULT 'en',

  -- Provenance
  source_url TEXT NOT NULL,
  source_record_id TEXT,
  source_system TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(province, source_url, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_pl_province ON provincial_legislatures(province);
CREATE INDEX IF NOT EXISTS idx_pl_record_type ON provincial_legislatures(record_type);
CREATE INDEX IF NOT EXISTS idx_pl_sitting_date ON provincial_legislatures(sitting_date DESC);
CREATE INDEX IF NOT EXISTS idx_pl_speaker ON provincial_legislatures(speaker);
CREATE INDEX IF NOT EXISTS idx_pl_party ON provincial_legislatures(party);
CREATE INDEX IF NOT EXISTS idx_pl_bill_number ON provincial_legislatures(bill_number);
CREATE INDEX IF NOT EXISTS idx_pl_committee ON provincial_legislatures(committee_name);
CREATE INDEX IF NOT EXISTS idx_pl_topic ON provincial_legislatures(topic);
CREATE INDEX IF NOT EXISTS idx_pl_language ON provincial_legislatures(language);
CREATE INDEX IF NOT EXISTS idx_pl_source_system ON provincial_legislatures(source_system);
CREATE INDEX IF NOT EXISTS idx_pl_province_type ON provincial_legislatures(province, record_type);
CREATE INDEX IF NOT EXISTS idx_pl_province_date ON provincial_legislatures(province, sitting_date DESC);
CREATE INDEX IF NOT EXISTS idx_pl_speaker_party ON provincial_legislatures(speaker, party);
CREATE INDEX IF NOT EXISTS idx_pl_bill_status ON provincial_legislatures(bill_status);
CREATE INDEX IF NOT EXISTS idx_pl_ingested ON provincial_legislatures(ingested_at DESC);

-- Crown Corporations — annual reports, quarterly financials, governance data
--
-- Tracks reports, financials, and governance data from Canada's crown
-- corporations — government-owned enterprises operating at arm's length
-- from the federal government.
--
-- Tracked orgs: CBC, Canada Post, CN Rail (privatized, legacy), Via Rail,
-- EDC, BDC, CMHC, Canada Council for the Arts, National Arts Centre,
-- Farm Credit Canada, PSP Investments.
--
-- Each crown corporation publishes annual reports (with audited financial
-- statements), quarterly financials, corporate plans, board minutes, and
-- executive compensation disclosures.
--
-- Cross-reference opportunities:
--   - Corporate module: crown corp procurement spending
--   - GIC appointments: board members are GIC appointees
--   - Influence tracking: funding flows to NGOs/consultancies
--   - Oversight: OAG/PBO audits of crown corporations
--
CREATE TABLE IF NOT EXISTS crown_corporations (
  id TEXT PRIMARY KEY,

  -- Organization
  org TEXT NOT NULL CHECK(org IN ('CBC','CPC','CN','VIA','EDC','BDC','CMHC','CCC','NAC','NRC','CBCL','FCC','PBC','C.D.C.','OTHER')),
  org_name TEXT NOT NULL,

  -- Report metadata
  report_type TEXT NOT NULL CHECK(report_type IN ('annual-report','quarterly-financials','corporate-plan','board-minutes','executive-compensation','sustainability-report','diversity-report','other')),
  fiscal_year TEXT NOT NULL,
  fiscal_quarter TEXT,
  title TEXT,
  summary TEXT,

  -- Financial data
  revenue REAL,
  expenses REAL,
  net_income REAL,
  government_funding REAL,
  total_assets REAL,
  total_liabilities REAL,
  employee_count INTEGER,

  -- Governance
  executive_compensation TEXT,
  board_members TEXT,
  board_chair TEXT,
  ceo_name TEXT,

  -- Document references
  report_url TEXT,
  published_date TEXT,
  language TEXT DEFAULT 'en',

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(org, fiscal_year, report_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_cc_org ON crown_corporations(org);
CREATE INDEX IF NOT EXISTS idx_cc_report_type ON crown_corporations(report_type);
CREATE INDEX IF NOT EXISTS idx_cc_fiscal_year ON crown_corporations(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_cc_published_date ON crown_corporations(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_cc_org_fiscal ON crown_corporations(org, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_cc_org_type ON crown_corporations(org, report_type);
CREATE INDEX IF NOT EXISTS idx_cc_revenue ON crown_corporations(revenue DESC);
CREATE INDEX IF NOT EXISTS idx_cc_net_income ON crown_corporations(net_income DESC);
CREATE INDEX IF NOT EXISTS idx_cc_gov_funding ON crown_corporations(government_funding DESC);
CREATE INDEX IF NOT EXISTS idx_cc_ceo ON crown_corporations(ceo_name);
CREATE INDEX IF NOT EXISTS idx_cc_org_fiscal_type ON crown_corporations(org, fiscal_year, report_type);
CREATE INDEX IF NOT EXISTS idx_cc_ingested ON crown_corporations(ingested_at DESC);

-- Federal Budget — budget, public accounts, fiscal monitor, departmental plans
--
-- Tracks the Canadian federal government's fiscal position over time.
-- Includes annual budget documents, audited public accounts, monthly
-- fiscal monitor updates, departmental plans, and fiscal projections.
--
-- Sources:
--   - Federal budget:        https://www.budget.canada.ca
--   - Public accounts:       https://www.tpsgc-pwgsc.gc.ca/recgen/txt/72-eng.html
--   - Fiscal monitor:        https://www.fin.gc.ca/fm-mf/index-eng.asp
--   - Departmental plans:    https://www.canada.ca/en/government/system/departmental-plans.html
--   - Open Canada CKAN:      https://open.canada.ca/data
--
-- Cross-reference opportunities:
--   - Crown corporations: match budget allocations to crown corp funding
--   - Oversight: OAG audits of public accounts, PBO analysis of budget
--   - Procurement: track budget vs. actual spending on contracts
--   - Influence: government funding flows to tracked actors
--
CREATE TABLE IF NOT EXISTS federal_budget (
  id TEXT PRIMARY KEY,

  -- Fiscal context
  fiscal_year TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK(record_type IN (
    'budget',
    'public_accounts',
    'fiscal_monitor',
    'departmental_plan',
    'fiscal_projections',
    'supplementary_estimates',
    'main_estimates',
    'other'
  )),

  -- Department / organization
  department TEXT,
  department_acronym TEXT,

  -- Financial data
  category TEXT NOT NULL CHECK(category IN (
    'revenue',
    'expense',
    'debt-service',
    'transfer',
    'capital',
    'operating',
    'defense',
    'healthcare',
    'social',
    'education',
    'infrastructure',
    'indigenous',
    'climate',
    'innovation',
    'immigration',
    'public-safety',
    'culture',
    'pension',
    'other-revenue',
    'other-expense',
    'total',
    'deficit',
    'debt',
    'gdp',
    'unallocated'
  )),
  amount REAL,
  currency TEXT DEFAULT 'CAD',

  -- Description
  description TEXT,
  title TEXT,

  -- Temporal
  published_date TEXT,
  fiscal_quarter TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  language TEXT DEFAULT 'en',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(fiscal_year, record_type, category, source_url, amount)
);

CREATE INDEX IF NOT EXISTS idx_fb_fiscal_year ON federal_budget(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_fb_record_type ON federal_budget(record_type);
CREATE INDEX IF NOT EXISTS idx_fb_category ON federal_budget(category);
CREATE INDEX IF NOT EXISTS idx_fb_department ON federal_budget(department);
CREATE INDEX IF NOT EXISTS idx_fb_published_date ON federal_budget(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_fb_amount ON federal_budget(amount DESC);
CREATE INDEX IF NOT EXISTS idx_fb_fiscal_type ON federal_budget(fiscal_year, record_type);
CREATE INDEX IF NOT EXISTS idx_fb_dept_fiscal ON federal_budget(department, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_fb_category_fiscal ON federal_budget(category, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_fb_source_system ON federal_budget(source_system);
CREATE INDEX IF NOT EXISTS idx_fb_ingested ON federal_budget(ingested_at DESC);

-- Bank of Canada decisions and publications
CREATE TABLE IF NOT EXISTS boc_decisions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('rate','mpr','fsr','speech')),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  key_rate TEXT,
  effective_date TEXT,
  speaker TEXT,
  speaker_title TEXT,
  event TEXT,
  pdf_url TEXT,
  language TEXT DEFAULT 'en',
  ingested_at TEXT NOT NULL,
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_boc_date ON boc_decisions(date DESC);
CREATE INDEX IF NOT EXISTS idx_boc_type ON boc_decisions(type);
CREATE INDEX IF NOT EXISTS idx_boc_type_date ON boc_decisions(type, date DESC);
CREATE INDEX IF NOT EXISTS idx_boc_key_rate ON boc_decisions(key_rate);
CREATE INDEX IF NOT EXISTS idx_boc_speaker ON boc_decisions(speaker);
CREATE INDEX IF NOT EXISTS idx_boc_ingested ON boc_decisions(ingested_at DESC);

-- ATI (Access to Information) Completed Requests
--
-- Tracks completed Access to Information requests published by federal
-- government departments on open.canada.ca. Each record represents a
-- single completed ATI request, showing what was requested, how the
-- department responded (disposition), and how many pages were released
-- or withheld.
--
-- Sources:
--   - open.canada.ca ATI portal (CKAN): https://open.canada.ca/en/ati
--   - Individual department ATI completion pages
--
CREATE TABLE IF NOT EXISTS ati_records (
  id TEXT PRIMARY KEY,

  -- Department / institution
  department TEXT NOT NULL,
  department_acronym TEXT,

  -- Request details
  request_number TEXT NOT NULL,
  summary TEXT,

  -- Outcome
  disposition TEXT NOT NULL CHECK(disposition IN (
    'disclosed',
    'disclosed-part',
    'exempted',
    'excluded',
    'no-records',
    'transferred',
    'abandoned',
    'pending',
    'unknown'
  )),

  -- Page counts
  pages_released INTEGER,
  pages_withheld INTEGER,

  -- Temporal
  date_completed TEXT,
  fiscal_year TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'open-canada-ckan',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(request_number, department, disposition, source_url)
);

CREATE INDEX IF NOT EXISTS idx_ati_department ON ati_records(department);
CREATE INDEX IF NOT EXISTS idx_ati_disposition ON ati_records(disposition);
CREATE INDEX IF NOT EXISTS idx_ati_date ON ati_records(date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_ati_fiscal_year ON ati_records(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_ati_request_number ON ati_records(request_number);
CREATE INDEX IF NOT EXISTS idx_ati_source_system ON ati_records(source_system);
CREATE INDEX IF NOT EXISTS idx_ati_department_disposition ON ati_records(department, disposition);
CREATE INDEX IF NOT EXISTS idx_ati_department_fiscal ON ati_records(department, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_ati_ingested ON ati_records(ingested_at DESC);

-- Municipal Council Meetings — across all major Canadian cities
CREATE TABLE IF NOT EXISTS municipal_meetings (
  id TEXT PRIMARY KEY,

  -- City / province
  city TEXT NOT NULL,
  province TEXT NOT NULL,

  -- Meeting metadata
  date TEXT NOT NULL,
  meeting_type TEXT NOT NULL CHECK(meeting_type IN (
    'council', 'committee', 'board', 'standing-committee',
    'sub-committee', 'task-force', 'advisory', 'public-hearing', 'budget'
  )),
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN (
    'scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'
  )),
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,

  -- URLs
  meeting_url TEXT,
  agenda_url TEXT,
  minutes_url TEXT,
  video_url TEXT,

  -- Decisions (JSON array of MeetingDecision objects)
  decisions TEXT NOT NULL DEFAULT '[]',

  -- Agenda items (JSON array of strings)
  agenda_items TEXT NOT NULL DEFAULT '[]',

  -- Budget
  budget_reference TEXT,
  budget_amount REAL,

  -- Provenance
  vendor_platform TEXT,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'municipal-council',
  source_meeting_id TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_municipal_meetings_city ON municipal_meetings(city);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_date ON municipal_meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_city_date ON municipal_meetings(city, date DESC);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_type ON municipal_meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_department ON municipal_meetings(department);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_status ON municipal_meetings(status);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_source ON municipal_meetings(source_system);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_ingested ON municipal_meetings(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_municipal_meetings_vendor ON municipal_meetings(vendor_platform);

-- NPRI — National Pollutant Release Inventory (facility pollutant releases)
CREATE TABLE IF NOT EXISTS npri_records (
  id TEXT PRIMARY KEY,
  facility_name TEXT NOT NULL,
  facility_location TEXT,
  province TEXT,
  latitude REAL,
  longitude REAL,
  substance_name TEXT NOT NULL,
  substance_cas TEXT,
  release_air_kg REAL,
  release_water_kg REAL,
  release_land_kg REAL,
  disposal_kg REAL,
  recycling_kg REAL,
  fiscal_year TEXT NOT NULL,
  reported_by TEXT,
  source_url TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'open-canada-ckan',
  ingested_at TEXT NOT NULL,
  UNIQUE(facility_name, substance_name, fiscal_year, source_url)
);

CREATE INDEX IF NOT EXISTS idx_npri_facility ON npri_records(facility_name);
CREATE INDEX IF NOT EXISTS idx_npri_substance ON npri_records(substance_name);
CREATE INDEX IF NOT EXISTS idx_npri_province ON npri_records(province);
CREATE INDEX IF NOT EXISTS idx_npri_fiscal_year ON npri_records(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_npri_reported_by ON npri_records(reported_by);
CREATE INDEX IF NOT EXISTS idx_npri_substance_cas ON npri_records(substance_cas);
CREATE INDEX IF NOT EXISTS idx_npri_facility_province ON npri_records(facility_name, province);
CREATE INDEX IF NOT EXISTS idx_npri_fiscal_province ON npri_records(fiscal_year DESC, province);
CREATE INDEX IF NOT EXISTS idx_npri_ingested ON npri_records(ingested_at DESC);

-- Species at Risk — SARA registry listing decisions and recovery strategies
CREATE TABLE IF NOT EXISTS species_at_risk_records (
  id TEXT PRIMARY KEY,
  species_name TEXT NOT NULL,
  scientific_name TEXT,
  taxonomic_group TEXT,
  sara_species_id TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'extirpated',
    'endangered',
    'threatened',
    'special_concern',
    'not_at_risk',
    'data_deficient'
  )),
  assessment_date TEXT,
  listing_date TEXT,
  recovery_strategy_url TEXT,
  critical_habitat INTEGER,
  province_territory TEXT,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'sara-api',
  ingested_at TEXT NOT NULL,
  UNIQUE(species_name, status, source_url)
);

CREATE INDEX IF NOT EXISTS idx_sara_species_name ON species_at_risk_records(species_name);
CREATE INDEX IF NOT EXISTS idx_sara_scientific_name ON species_at_risk_records(scientific_name);
CREATE INDEX IF NOT EXISTS idx_sara_status ON species_at_risk_records(status);
CREATE INDEX IF NOT EXISTS idx_sara_taxonomic_group ON species_at_risk_records(taxonomic_group);
CREATE INDEX IF NOT EXISTS idx_sara_province ON species_at_risk_records(province_territory);
CREATE INDEX IF NOT EXISTS idx_sara_assessment_date ON species_at_risk_records(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_sara_listing_date ON species_at_risk_records(listing_date DESC);
CREATE INDEX IF NOT EXISTS idx_sara_status_group ON species_at_risk_records(status, taxonomic_group);
CREATE INDEX IF NOT EXISTS idx_sara_ingested ON species_at_risk_records(ingested_at DESC);

-- IAAC — Impact Assessment Agency of Canada (federal project assessments)
CREATE TABLE IF NOT EXISTS impact_assessment_records (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  proponent TEXT,
  project_type TEXT,
  location TEXT,
  province TEXT,
  decision TEXT NOT NULL CHECK(decision IN (
    'approved',
    'approved-with-conditions',
    'denied',
    'pending',
    'withdrawn',
    'exempted',
    'referred',
    'not-required',
    'unknown'
  )),
  decision_date TEXT,
  assessment_type TEXT NOT NULL DEFAULT 'unknown' CHECK(assessment_type IN (
    'iaa',
    'ceaa-2012',
    'ceaa-2012-original',
    'panel-review',
    'substituted',
    'unknown'
  )),
  conditions_url TEXT,
  assessment_report_url TEXT,
  iaac_reference_number TEXT,
  ceaa_reference_number TEXT,
  federal_provincial_agreement INTEGER,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'iaac-web',
  ingested_at TEXT NOT NULL,
  UNIQUE(project_name, decision, source_url)
);

CREATE INDEX IF NOT EXISTS idx_iaac_project ON impact_assessment_records(project_name);
CREATE INDEX IF NOT EXISTS idx_iaac_proponent ON impact_assessment_records(proponent);
CREATE INDEX IF NOT EXISTS idx_iaac_decision ON impact_assessment_records(decision);
CREATE INDEX IF NOT EXISTS idx_iaac_decision_date ON impact_assessment_records(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_iaac_project_type ON impact_assessment_records(project_type);
CREATE INDEX IF NOT EXISTS idx_iaac_province ON impact_assessment_records(province);
CREATE INDEX IF NOT EXISTS idx_iaac_assessment_type ON impact_assessment_records(assessment_type);
CREATE INDEX IF NOT EXISTS idx_iaac_ref_number ON impact_assessment_records(iaac_reference_number);
CREATE INDEX IF NOT EXISTS idx_iaac_ingested ON impact_assessment_records(ingested_at DESC);
-- Health Canada — regulated product records (drugs, devices, natural products, recalls)
CREATE TABLE IF NOT EXISTS health_canada_records (
  id TEXT PRIMARY KEY,

  -- Product identity
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN (
    'drug', 'device', 'natural', 'recall'
  )),

  -- Licensing
  license_number TEXT,
  license_status TEXT NOT NULL DEFAULT 'unknown' CHECK(license_status IN (
    'active', 'suspended', 'revoked', 'cancelled', 'expired',
    'discontinued', 'recalled', 'pending', 'unknown'
  )),

  -- Manufacturer / company
  manufacturer TEXT,

  -- Drug-specific fields
  therapeutic_area TEXT,
  active_ingredient TEXT,
  din TEXT,
  npn TEXT,

  -- Dates
  license_date TEXT,
  expiry_date TEXT,

  -- Recall-specific fields
  recall_severity TEXT,
  recall_reason TEXT,
  recall_classification TEXT,

  -- Dosage / administration
  dosage_form TEXT,
  route_of_administration TEXT,
  company_status TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'hc-dpd',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(product_name, product_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_hc_product_name ON health_canada_records(product_name);
CREATE INDEX IF NOT EXISTS idx_hc_product_type ON health_canada_records(product_type);
CREATE INDEX IF NOT EXISTS idx_hc_license_number ON health_canada_records(license_number);
CREATE INDEX IF NOT EXISTS idx_hc_license_status ON health_canada_records(license_status);
CREATE INDEX IF NOT EXISTS idx_hc_manufacturer ON health_canada_records(manufacturer);
CREATE INDEX IF NOT EXISTS idx_hc_therapeutic_area ON health_canada_records(therapeutic_area);
CREATE INDEX IF NOT EXISTS idx_hc_active_ingredient ON health_canada_records(active_ingredient);
CREATE INDEX IF NOT EXISTS idx_hc_din ON health_canada_records(din);
CREATE INDEX IF NOT EXISTS idx_hc_npn ON health_canada_records(npn);
CREATE INDEX IF NOT EXISTS idx_hc_license_date ON health_canada_records(license_date DESC);
CREATE INDEX IF NOT EXISTS idx_hc_expiry_date ON health_canada_records(expiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_hc_recall_severity ON health_canada_records(recall_severity);
CREATE INDEX IF NOT EXISTS idx_hc_product_type_status ON health_canada_records(product_type, license_status);
CREATE INDEX IF NOT EXISTS idx_hc_ingested ON health_canada_records(ingested_at DESC);

-- CIPO — Canadian Intellectual Property Office IP rights records
-- Tracks patents, trademarks, and industrial designs registered in Canada.
CREATE TABLE IF NOT EXISTS cipo_records (
  id TEXT PRIMARY KEY,

  -- Application identity
  application_number TEXT NOT NULL,
  filing_date TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN (
    'active', 'pending', 'abandoned', 'expired', 'refused',
    'withdrawn', 'opposed', 'expunged', 'unknown'
  )),
  type TEXT NOT NULL CHECK(type IN (
    'patent', 'trademark', 'industrial_design'
  )),

  -- Title / description
  title TEXT NOT NULL,
  description TEXT,

  -- Owner / agent
  owner_name TEXT,
  agent_name TEXT,

  -- Classifications
  ipc_classification TEXT,
  nice_classification TEXT,

  -- Dates
  registration_date TEXT,
  expiry_date TEXT,
  publication_date TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'cipo-patent',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(application_number, type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_cipo_app_number ON cipo_records(application_number);
CREATE INDEX IF NOT EXISTS idx_cipo_type ON cipo_records(type);
CREATE INDEX IF NOT EXISTS idx_cipo_status ON cipo_records(status);
CREATE INDEX IF NOT EXISTS idx_cipo_title ON cipo_records(title);
CREATE INDEX IF NOT EXISTS idx_cipo_owner ON cipo_records(owner_name);
CREATE INDEX IF NOT EXISTS idx_cipo_agent ON cipo_records(agent_name);
CREATE INDEX IF NOT EXISTS idx_cipo_filing_date ON cipo_records(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_cipo_registration_date ON cipo_records(registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_cipo_expiry_date ON cipo_records(expiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cipo_ipc ON cipo_records(ipc_classification);
CREATE INDEX IF NOT EXISTS idx_cipo_nice ON cipo_records(nice_classification);
CREATE INDEX IF NOT EXISTS idx_cipo_type_status ON cipo_records(type, status);
CREATE INDEX IF NOT EXISTS idx_cipo_ingested ON cipo_records(ingested_at DESC);

-- CMHC — Canada Mortgage and Housing Corporation housing market data
-- Tracks housing starts, vacancy rates, rental rates, affordability, and related metrics.
CREATE TABLE IF NOT EXISTS cmhc_records (
  id TEXT PRIMARY KEY,

  -- Metric identity
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK(metric_type IN (
    'housing_starts', 'vacancy_rate', 'rental_rate', 'affordability',
    'home_price', 'mortgage_arrears', 'housing_completions',
    'housing_under_construction', 'supply', 'demand', 'absorption', 'other'
  )),

  -- Geography
  geographic_area TEXT NOT NULL,
  geographic_level TEXT NOT NULL DEFAULT 'city',

  -- Time period
  period TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,

  -- Value
  value REAL,
  unit TEXT,

  -- Housing type
  housing_type TEXT NOT NULL DEFAULT 'all' CHECK(housing_type IN (
    'rental', 'ownership', 'social', 'co-op', 'condo',
    'single_detached', 'semi_detached', 'row', 'apartment', 'all'
  )),

  -- Adjustment
  seasonally_adjusted INTEGER,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'cmhc-housing-starts',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(metric_name, geographic_area, period, housing_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_cmhc_metric_name ON cmhc_records(metric_name);
CREATE INDEX IF NOT EXISTS idx_cmhc_metric_type ON cmhc_records(metric_type);
CREATE INDEX IF NOT EXISTS idx_cmhc_geo ON cmhc_records(geographic_area);
CREATE INDEX IF NOT EXISTS idx_cmhc_period ON cmhc_records(period DESC);
CREATE INDEX IF NOT EXISTS idx_cmhc_housing_type ON cmhc_records(housing_type);
CREATE INDEX IF NOT EXISTS idx_cmhc_value ON cmhc_records(value);
CREATE INDEX IF NOT EXISTS idx_cmhc_geo_period ON cmhc_records(geographic_area, period DESC);
CREATE INDEX IF NOT EXISTS idx_cmhc_metric_period ON cmhc_records(metric_type, period DESC);
CREATE INDEX IF NOT EXISTS idx_cmhc_ingested ON cmhc_records(ingested_at DESC);

-- Global Canada — GAC / ECCC / CSIS combined metadata tracking
-- Lighter-weight module primarily tracking records with links to source URLs/full docs.
CREATE TABLE IF NOT EXISTS global_canada_records (
  id TEXT PRIMARY KEY,

  -- Source identity
  source_system TEXT NOT NULL CHECK(source_system IN ('gac', 'eccc', 'csis')),
  record_type TEXT NOT NULL CHECK(record_type IN (
    'trade_agreement', 'foreign_policy', 'development_project',
    'international_assistance', 'sanctions', 'treaty',
    'climate_data', 'weather_warning', 'environmental_indicator',
    'greenhouse_gas_inventory', 'climate_adaptation', 'weather_forecast',
    'annual_report', 'public_briefing', 'security_advisory', 'other'
  )),

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  url TEXT NOT NULL,

  -- Department / topic
  department TEXT NOT NULL,
  topic_area TEXT,
  geographic_focus TEXT,

  -- Reference
  reference_number TEXT,
  format TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(title, source_system, url)
);

CREATE INDEX IF NOT EXISTS idx_gc_source ON global_canada_records(source_system);
CREATE INDEX IF NOT EXISTS idx_gc_record_type ON global_canada_records(record_type);
CREATE INDEX IF NOT EXISTS idx_gc_title ON global_canada_records(title);
CREATE INDEX IF NOT EXISTS idx_gc_date ON global_canada_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_gc_department ON global_canada_records(department);
CREATE INDEX IF NOT EXISTS idx_gc_topic ON global_canada_records(topic_area);
CREATE INDEX IF NOT EXISTS idx_gc_geo_focus ON global_canada_records(geographic_focus);
CREATE INDEX IF NOT EXISTS idx_gc_source_type ON global_canada_records(source_system, record_type);
CREATE INDEX IF NOT EXISTS idx_gc_date_source ON global_canada_records(date DESC, source_system);

-- Immigration & Refugee Tables
--
-- Tracks IRCC permanent and temporary resident admissions,
-- IRB refugee protection decisions, and CBSA enforcement data.
-- Source access is not a reuse grant; verify each dataset's publisher terms.
--

-- IRCC permanent resident admissions (monthly updates)
CREATE TABLE IF NOT EXISTS immigration_permanent_residents (
  id TEXT PRIMARY KEY,
  immigration_category TEXT NOT NULL,
  sub_category TEXT,
  province_territory TEXT,
  country_of_citizenship TEXT,
  year INTEGER NOT NULL,
  month INTEGER,
  count INTEGER NOT NULL DEFAULT 0,
  gender TEXT,
  age_range TEXT,
  source_url TEXT NOT NULL,
  ckan_dataset_id TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(year, province_territory, immigration_category, country_of_citizenship)
);

CREATE INDEX IF NOT EXISTS idx_ipr_category ON immigration_permanent_residents(immigration_category);
CREATE INDEX IF NOT EXISTS idx_ipr_year ON immigration_permanent_residents(year DESC);
CREATE INDEX IF NOT EXISTS idx_ipr_province ON immigration_permanent_residents(province_territory);
CREATE INDEX IF NOT EXISTS idx_ipr_country ON immigration_permanent_residents(country_of_citizenship);
CREATE INDEX IF NOT EXISTS idx_ipr_year_category ON immigration_permanent_residents(year DESC, immigration_category);

-- IRCC study permit holders (monthly updates)
CREATE TABLE IF NOT EXISTS immigration_study_permits (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  quarter INTEGER,
  country_of_citizenship TEXT,
  province_territory TEXT,
  institution TEXT,
  study_level TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(year, province_territory, country_of_citizenship, study_level)
);

CREATE INDEX IF NOT EXISTS idx_isp_year ON immigration_study_permits(year DESC);
CREATE INDEX IF NOT EXISTS idx_isp_province ON immigration_study_permits(province_territory);
CREATE INDEX IF NOT EXISTS idx_isp_country ON immigration_study_permits(country_of_citizenship);

-- IRCC work permit holders (TFWP and IMP, monthly)
CREATE TABLE IF NOT EXISTS immigration_work_permits (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  quarter INTEGER,
  program_type TEXT NOT NULL CHECK(program_type IN ('TFWP', 'IMP')),
  noc_level TEXT,
  country_of_citizenship TEXT,
  province_territory TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(year, program_type, province_territory, noc_level, country_of_citizenship)
);

CREATE INDEX IF NOT EXISTS idx_iwp_year ON immigration_work_permits(year DESC);
CREATE INDEX IF NOT EXISTS idx_iwp_program ON immigration_work_permits(program_type);
CREATE INDEX IF NOT EXISTS idx_iwp_province ON immigration_work_permits(province_territory);
CREATE INDEX IF NOT EXISTS idx_iwp_noc ON immigration_work_permits(noc_level);

-- IRB refugee protection division decisions (quarterly)
CREATE TABLE IF NOT EXISTS immigration_rpd_decisions (
  id TEXT PRIMARY KEY,
  decision_id TEXT,
  year INTEGER NOT NULL,
  quarter INTEGER,
  country_of_origin TEXT,
  language TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('accepted', 'rejected', 'abandoned', 'withdrawn', 'other')),
  represented INTEGER,
  gender TEXT,
  age_group TEXT,
  hearing_type TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_irpd_year ON immigration_rpd_decisions(year DESC);
CREATE INDEX IF NOT EXISTS idx_irpd_country ON immigration_rpd_decisions(country_of_origin);
CREATE INDEX IF NOT EXISTS idx_irpd_outcome ON immigration_rpd_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_irpd_year_outcome ON immigration_rpd_decisions(year DESC, outcome);
CREATE INDEX IF NOT EXISTS idx_irpd_country_year ON immigration_rpd_decisions(country_of_origin, year DESC);

-- CBSA enforcement penalties (AMPS)
CREATE TABLE IF NOT EXISTS immigration_cbsa_penalties (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  violation_type TEXT NOT NULL,
  penalty_amount REAL NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 1,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(year, violation_type)
);

CREATE INDEX IF NOT EXISTS idx_icbsa_year ON immigration_cbsa_penalties(year DESC);
CREATE INDEX IF NOT EXISTS idx_icbsa_type ON immigration_cbsa_penalties(violation_type);
CREATE INDEX IF NOT EXISTS idx_icbsa_amount ON immigration_cbsa_penalties(penalty_amount DESC);

-- end immigration
CREATE INDEX IF NOT EXISTS idx_gc_ingested ON global_canada_records(ingested_at DESC);
