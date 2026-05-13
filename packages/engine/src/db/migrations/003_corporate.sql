-- 003_corporate.sql
-- Corporate entities, executive statements, and insider transactions

CREATE TABLE IF NOT EXISTS executive_statements (
    id TEXT PRIMARY KEY,
    executive_name TEXT,
    organization TEXT,
    statement_type TEXT,
    date DATE,
    title TEXT,
    text TEXT,
    source_url TEXT,
    committee_meeting_id TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corporate_entities (
    id TEXT PRIMARY KEY,
    name TEXT,
    ticker TEXT,
    sector TEXT,
    cra_bn TEXT,
    website TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insider_transactions (
    id TEXT PRIMARY KEY,
    executive_name TEXT,
    issuer_name TEXT,
    relationship TEXT,
    transaction_type TEXT,
    transaction_date DATE,
    securities_owned NUMERIC,
    value NUMERIC,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);
