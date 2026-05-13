-- 001_initial.sql
-- Core tables for MapleSpike Canada

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT[],
    category TEXT,
    jurisdiction TEXT,
    website TEXT,
    cra_bn TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT[],
    title TEXT,
    organization_id TEXT REFERENCES organizations(id),
    biography TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lobbying_records (
    id TEXT PRIMARY KEY,
    registrant_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    subject_matter TEXT[],
    government_institution TEXT,
    public_office_holder TEXT,
    communication_date DATE,
    lobbyist_type TEXT,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_awards (
    id TEXT PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    contract_value NUMERIC,
    currency TEXT DEFAULT 'CAD',
    award_date DATE,
    department TEXT,
    description TEXT,
    is_sole_source BOOLEAN DEFAULT FALSE,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    donor_name TEXT,
    recipient_name TEXT,
    amount NUMERIC,
    date DATE,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gac_grants (
    id TEXT PRIMARY KEY,
    recipient_name TEXT,
    amount NUMERIC,
    fiscal_year TEXT,
    department TEXT,
    program_name TEXT,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disclosures (
    id TEXT PRIMARY KEY,
    entity_name TEXT,
    disclosure_type TEXT,
    amount NUMERIC,
    date DATE,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT,
    target_id TEXT,
    edge_type TEXT,
    weight NUMERIC DEFAULT 1.0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefs (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    entities TEXT[],
    source_ids TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    severity TEXT,
    entity_ids TEXT[],
    source TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
