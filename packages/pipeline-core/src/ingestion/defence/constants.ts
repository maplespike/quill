/**
 * MapleSpike — National Defence Data Source Constants
 *
 * DND/CAF personnel, procurement, and spending data from CKAN.
 * All under Open Government Licence – Canada.
 */

export const DND_DATASETS: Record<string, { id: string; title: string; description: string; url: string }> = {
  REGULAR_FORCE_RANK: {
    id: '460aa2e0-5a37-47cf-a858-98b4327d29de',
    title: 'Regular Force Personnel by Rank',
    description: 'Monthly DND Regular Force personnel counts by rank, gender, and component. CSV format, updated quarterly.',
    url: 'https://open.canada.ca/data/en/dataset/460aa2e0-5a37-47cf-a858-98b4327d29de',
  },
  CIVILIAN_PERSONNEL: {
    id: '72c8bbf1-3a22-4510-8bc4-28c3c5e38838',
    title: 'DND Civilian Personnel by Classification',
    description: 'DND civilian employee counts by classification group and tenure.',
    url: 'https://open.canada.ca/data/en/dataset/72c8bbf1-3a22-4510-8bc4-28c3c5e38838',
  },
  DEFENCE_PROCUREMENT: {
    id: 'd4c13b9a-2e1c-4f5d-9b7a-8e3f6c2a1b4d', // proactive disclosure procurement
    title: 'Defence Procurement Contracts',
    description: 'DND contracts over $10K from proactive disclosure.',
    url: 'https://open.canada.ca/data/en/dataset/proactive-disclosure',
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
