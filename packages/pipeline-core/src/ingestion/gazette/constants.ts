/**
 * Gazette Constants — CivInt Pipeline
 *
 * RSS feed URLs for Canada Gazette Parts I, II, III
 * and DDL for the gazette_records table.
 */

import { GazettePart } from './types.js';


export const GAZETTE_RSS_URLS: Record<GazettePart, string> = {
  [GazettePart.I]: 'https://gazette.gc.ca/rp-pr/p1/index.rss',
  [GazettePart.II]: 'https://gazette.gc.ca/rp-pr/p2/index.rss',
  [GazettePart.III]: 'https://gazette.gc.ca/rp-pr/p3/index.rss',
};

/** Human-readable labels for each part */
export const GAZETTE_PART_LABELS: Record<GazettePart, string> = {
  [GazettePart.I]: 'Part I — Proposed Regulations',
  [GazettePart.II]: 'Part II — Enacted Regulations',
  [GazettePart.III]: 'Part III — Acts of Parliament',
};

/** Base URL for the Canada Gazette */
export const GAZETTE_BASE_URL = 'https://gazette.gc.ca';


export const GAZETTE_DDL = `
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
`;
