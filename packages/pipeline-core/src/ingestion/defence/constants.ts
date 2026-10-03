/**
 * Quill — National Defence Data Source Constants
 *
 * DND/CAF personnel, procurement, and spending dataset references from CKAN.
 * Follow the terms and exclusions declared for each dataset and resource.
 */

export const DND_DATASETS: Record<string, { id: string; title: string; description: string; url: string }> = {
  REGULAR_FORCE_RANK: {
    id: '460aa2e0-5a37-47cf-a858-98b4327d29de',
    title: 'Regular Force Personnel by Rank',
    description: 'Monthly DND Regular Force personnel counts by rank, gender, and component. CSV format, updated quarterly.',
    url: 'https://open.canada.ca/data/en/dataset/460aa2e0-5a37-47cf-a858-98b4327d29de',
  },
  CIVILIAN_PERSONNEL: {
    id: '881a781c-8247-4990-b7e7-1d99317bd4b2',
    title: 'DND Civilian Personnel by Classification',
    description: 'DND civilian employee counts by classification group and tenure.',
    url: 'https://open.canada.ca/data/en/dataset/881a781c-8247-4990-b7e7-1d99317bd4b2',
  },
  DEFENCE_PROCUREMENT: {
    id: 'cd84dfb1-5129-4bd6-a063-0e4f0e2c3f66',
    title: 'Defence Procurement Contracts',
    description: 'DND contracts over $10K from proactive disclosure.',
    url: 'https://open.canada.ca/data/en/dataset/cd84dfb1-5129-4bd6-a063-0e4f0e2c3f66',
  },
};

export const DND_DDL = `CREATE TABLE IF NOT EXISTS defence_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_url TEXT,
  record_date TEXT,
  category TEXT,
  value REAL,
  metadata_json TEXT,
  citation_hash TEXT,
  ingested_at TEXT DEFAULT (datetime('now'))
);`;
