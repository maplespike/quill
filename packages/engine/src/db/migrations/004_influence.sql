-- 004_influence.sql
-- Influence tracking: actors, connections, funding, and charity cache

CREATE TABLE IF NOT EXISTS influence_actors (
    id TEXT PRIMARY KEY,
    name TEXT,
    aliases TEXT[],
    category TEXT,
    priority TEXT DEFAULT 'medium',
    headquarters TEXT,
    website TEXT,
    is_cra_charity BOOLEAN DEFAULT FALSE,
    cra_bn TEXT,
    policy_areas TEXT[],
    notes TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS influence_connections (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES influence_actors(id),
    government_entity TEXT,
    connection_type TEXT,
    description TEXT,
    date DATE,
    value_cad NUMERIC,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS government_funding (
    id TEXT PRIMARY KEY,
    recipient_name TEXT,
    department TEXT,
    program_name TEXT,
    amount NUMERIC,
    fiscal_year TEXT,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cra_charity_cache (
    id TEXT PRIMARY KEY,
    bn TEXT,
    legal_name TEXT,
    status TEXT,
    category TEXT,
    revenue NUMERIC,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);
