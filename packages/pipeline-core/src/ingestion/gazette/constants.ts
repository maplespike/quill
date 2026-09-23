/**
 * Gazette Constants — MapleSpike Pipeline
 *
 * RSS feed URLs for Canada Gazette Parts I, II, III
 * and DDL for the gazette_records table.
 */

import { GazettePart } from './types.js';


/**
 * RSS feed URLs for Canada Gazette Parts I, II, III.
 *
 * The `/rp-pr/pN/index.rss` paths this file used to carry return 404 — the
 * live syndication endpoints are under `/rss/`. Part III is published under
 * its "Acts of Parliament / Lois du Parlement" slug (`en-ls-eng.xml`);
 * `p3-eng.xml` does not exist. Verified 200 on 2026-09-23:
 *   p1-eng.xml 435 items, p2-eng.xml 232 items, en-ls-eng.xml 22 items.
 */
export const GAZETTE_RSS_URLS: Record<GazettePart, string> = {
  [GazettePart.I]: 'https://gazette.gc.ca/rss/p1-eng.xml',
  [GazettePart.II]: 'https://gazette.gc.ca/rss/p2-eng.xml',
  [GazettePart.III]: 'https://gazette.gc.ca/rss/en-ls-eng.xml',
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
