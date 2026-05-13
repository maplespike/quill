-- 002_committee.sql
-- Committee meetings, interventions, and speakers

CREATE TABLE IF NOT EXISTS committee_meetings (
    id TEXT PRIMARY KEY,
    committee_code TEXT,
    committee_name TEXT,
    meeting_number INTEGER,
    parliament INTEGER,
    session INTEGER,
    date DATE,
    is_in_camera BOOLEAN DEFAULT FALSE,
    source_url TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS committee_interventions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT REFERENCES committee_meetings(id),
    speaker_name TEXT,
    speaker_affiliation TEXT,
    party TEXT,
    text TEXT,
    sequence INTEGER,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS committee_speakers (
    id TEXT PRIMARY KEY,
    name TEXT,
    party TEXT,
    riding TEXT,
    role TEXT,
    first_seen DATE,
    last_seen DATE,
    appearance_count INTEGER DEFAULT 0
);
