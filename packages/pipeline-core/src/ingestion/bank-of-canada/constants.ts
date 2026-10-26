/**
 * Bank of Canada Ingestion Constants — Quill
 *
 * Bank of Canada URLs, RSS feeds, known decision schedules,
 * historical rate decisions, and source configurations.
 *
 * Sources:
 *   - Rate announcements:      https://www.bankofcanada.ca/rates/
 *   - Rate decision RSS:       https://www.bankofcanada.ca/rates/rss/
 *   - Monetary Policy Reports: https://www.bankofcanada.ca/publications/mpr/
 *   - Financial System Review: https://www.bankofcanada.ca/publications/fsr/
 *   - VALA executive speeches: https://www.vala.ca
 */

import type { BocSourceConfig, BocRateScheduleEntry, BocRateHistoryEntry } from './types.js';

/* ------------------------------------------------------------------ */
/*  Base URLs                                                          */
/* ------------------------------------------------------------------ */

/** Bank of Canada base domain */
export const BOC_BASE_URL = 'https://www.bankofcanada.ca' as const;

/** Rate announcements landing page */
export const BOC_RATES_URL = `${BOC_BASE_URL}/rates/` as const;

/** RSS feed for rate announcements */
export const BOC_RATES_RSS_URL = `${BOC_BASE_URL}/rates/rss/` as const;

/** Monetary Policy Reports landing page */
export const BOC_MPR_URL = `${BOC_BASE_URL}/publications/mpr/` as const;

/** Financial System Review landing page */
export const BOC_FSR_URL = `${BOC_BASE_URL}/publications/fsr/` as const;

/** VALA (Canadian securities regulators) base URL */
export const VALA_BASE_URL = 'https://www.vala.ca' as const;

/* ------------------------------------------------------------------ */
/*  Source Configurations                                              */
/* ------------------------------------------------------------------ */

/** All Bank of Canada data sources keyed by type */
export const BOC_SOURCES: Record<string, BocSourceConfig> = {
  rate: {
    label: 'Bank of Canada — Interest Rate Announcements',
    url: BOC_RATES_URL,
    rssUrl: BOC_RATES_RSS_URL,
    type: 'rate',
    yearPattern: null,
  },
  mpr: {
    label: 'Bank of Canada — Monetary Policy Report',
    url: BOC_MPR_URL,
    rssUrl: `${BOC_BASE_URL}/rss/publications/mpr.xml`,
    type: 'mpr',
    yearPattern: `${BOC_MPR_URL}?year=YEAR`,
  },
  fsr: {
    label: 'Bank of Canada — Financial System Review',
    url: BOC_FSR_URL,
    rssUrl: `${BOC_BASE_URL}/rss/publications/fsr.xml`,
    type: 'fsr',
    yearPattern: `${BOC_FSR_URL}?year=YEAR`,
  },
  speech: {
    label: 'VALA — Executive Speeches',
    url: VALA_BASE_URL,
    rssUrl: null,
    type: 'speech',
    yearPattern: null,
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Rate Decision Schedule                                             */
/* ------------------------------------------------------------------ */

/**
 * Scheduled Bank of Canada interest rate decision dates.
 *
 * The Bank of Canada publishes its rate decision schedule annually.
 * Decisions are made on Wednesdays, typically 8 times per year.
 * Dates shown are the announcement dates; the overnight rate takes
 * effect the following business day.
 *
 * Source: https://www.bankofcanada.ca/rates/fixed-dates/
 */
export const BOC_RATE_SCHEDULE: BocRateScheduleEntry[] = [
  // 2024 schedule
  { date: '2024-01-24', label: 'January 2024' },
  { date: '2024-03-06', label: 'March 2024' },
  { date: '2024-04-10', label: 'April 2024' },
  { date: '2024-06-05', label: 'June 2024' },
  { date: '2024-07-24', label: 'July 2024' },
  { date: '2024-09-04', label: 'September 2024' },
  { date: '2024-10-23', label: 'October 2024' },
  { date: '2024-12-11', label: 'December 2024' },

  // 2025 schedule
  { date: '2025-01-29', label: 'January 2025' },
  { date: '2025-03-12', label: 'March 2025' },
  { date: '2025-04-16', label: 'April 2025' },
  { date: '2025-06-04', label: 'June 2025' },
  { date: '2025-07-30', label: 'July 2025' },
  { date: '2025-09-17', label: 'September 2025' },
  { date: '2025-10-29', label: 'October 2025' },
  { date: '2025-12-10', label: 'December 2025' },

  // 2026 schedule
  { date: '2026-01-28', label: 'January 2026' },
  { date: '2026-03-11', label: 'March 2026' },
  { date: '2026-04-15', label: 'April 2026' },
  { date: '2026-06-03', label: 'June 2026' },
  { date: '2026-07-29', label: 'July 2026' },
  { date: '2026-09-16', label: 'September 2026' },
  { date: '2026-10-28', label: 'October 2026' },
  { date: '2026-12-09', label: 'December 2026' },
];

/* ------------------------------------------------------------------ */
/*  Historical Rate Decisions                                          */
/* ------------------------------------------------------------------ */

/**
 * Known Bank of Canada interest rate decisions with outcomes.
 *
 * This provides a historical record of overnight rate targets for
 * reference and cross-referencing. Recent rate decisions are included
 * to support analysis of the current monetary policy cycle.
 *
 * Source: https://www.bankofcanada.ca/rates/interest-rates/
 */
export const BOC_RATE_HISTORY: BocRateHistoryEntry[] = [
  // 2020 — COVID emergency rate cuts
  { date: '2020-03-04', effectiveDate: '2020-03-05', rate: '1.25', label: 'March 2020' },
  { date: '2020-03-13', effectiveDate: '2020-03-16', rate: '0.75', label: 'March 2020 (emergency)' },
  { date: '2020-03-27', effectiveDate: '2020-03-30', rate: '0.25', label: 'March 2020 (second emergency)' },

  // 2022 — hiking cycle begins
  { date: '2022-03-02', effectiveDate: '2022-03-03', rate: '0.50', label: 'March 2022' },
  { date: '2022-04-13', effectiveDate: '2022-04-14', rate: '1.00', label: 'April 2022' },
  { date: '2022-06-01', effectiveDate: '2022-06-02', rate: '1.50', label: 'June 2022' },
  { date: '2022-07-13', effectiveDate: '2022-07-14', rate: '2.50', label: 'July 2022' },
  { date: '2022-09-07', effectiveDate: '2022-09-08', rate: '3.25', label: 'September 2022' },
  { date: '2022-10-26', effectiveDate: '2022-10-27', rate: '3.75', label: 'October 2022' },
  { date: '2022-12-07', effectiveDate: '2022-12-08', rate: '4.25', label: 'December 2022' },

  // 2023
  { date: '2023-01-25', effectiveDate: '2023-01-26', rate: '4.50', label: 'January 2023' },
  { date: '2023-03-08', effectiveDate: '2023-03-09', rate: '4.50', label: 'March 2023' },
  { date: '2023-04-12', effectiveDate: '2023-04-13', rate: '4.50', label: 'April 2023' },
  { date: '2023-06-07', effectiveDate: '2023-06-08', rate: '4.75', label: 'June 2023' },
  { date: '2023-07-12', effectiveDate: '2023-07-13', rate: '5.00', label: 'July 2023' },
  { date: '2023-09-06', effectiveDate: '2023-09-07', rate: '5.00', label: 'September 2023' },
  { date: '2023-10-25', effectiveDate: '2023-10-26', rate: '5.00', label: 'October 2023' },
  { date: '2023-12-06', effectiveDate: '2023-12-07', rate: '5.00', label: 'December 2023' },

  // 2024
  { date: '2024-01-24', effectiveDate: '2024-01-25', rate: '5.00', label: 'January 2024' },
  { date: '2024-03-06', effectiveDate: '2024-03-07', rate: '5.00', label: 'March 2024' },
  { date: '2024-04-10', effectiveDate: '2024-04-11', rate: '5.00', label: 'April 2024' },
  { date: '2024-06-05', effectiveDate: '2024-06-06', rate: '4.75', label: 'June 2024' },
  { date: '2024-07-24', effectiveDate: '2024-07-25', rate: '4.50', label: 'July 2024' },
  { date: '2024-09-04', effectiveDate: '2024-09-05', rate: '4.25', label: 'September 2024' },
  { date: '2024-10-23', effectiveDate: '2024-10-24', rate: '3.75', label: 'October 2024' },
  { date: '2024-12-11', effectiveDate: '2024-12-12', rate: '3.25', label: 'December 2024' },

  // 2025
  { date: '2025-01-29', effectiveDate: '2025-01-30', rate: '3.00', label: 'January 2025' },
  { date: '2025-03-12', effectiveDate: '2025-03-13', rate: '2.75', label: 'March 2025' },
  { date: '2025-04-16', effectiveDate: '2025-04-17', rate: '2.50', label: 'April 2025' },
  { date: '2025-06-04', effectiveDate: '2025-06-05', rate: '2.50', label: 'June 2025' },
  { date: '2025-07-30', effectiveDate: '2025-07-31', rate: '2.50', label: 'July 2025' },
  { date: '2025-09-17', effectiveDate: '2025-09-18', rate: '2.50', label: 'September 2025' },
];

/* ------------------------------------------------------------------ */
/*  HTTP Configuration                                                 */
/* ------------------------------------------------------------------ */

/** Default HTTP request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default HTTP headers for Bank of Canada requests */
export const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
} as const;

/** Maximum RSS items to fetch per feed */
export const MAX_RSS_ITEMS = 50;

/** Years to look back for historical data during initial ingestion */
export const HISTORICAL_YEARS_BACK = 5;

/** Maximum detail pages to fetch */
export const MAX_DETAIL_FETCHES = 20;

/* ------------------------------------------------------------------ */
/*  DDL — Bank of Canada Table for D1 Schema                          */
/* ------------------------------------------------------------------ */

/**
 * DDL for the boc_decisions table.
 * This table stores Bank of Canada interest rate decisions, Monetary Policy
 * Reports, Financial System Reviews, and executive speeches.
 */
export const BOC_DECISIONS_DDL = `-- Bank of Canada decisions and publications
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
CREATE INDEX IF NOT EXISTS idx_boc_ingested ON boc_decisions(ingested_at DESC);`;

/**
 * Build a Bank of Canada rate announcement URL for a given date.
 * Pattern: https://www.bankofcanada.ca/YYYY/MM/PR-title/
 */
export function bocRateUrl(date: string, slug: string = ''): string {
  const d = date.replace(/-/g, '/');
  return `${BOC_BASE_URL}/${d}/${slug}`;
}

/**
 * Build a Bank of Canada publication URL.
 */
export function bocPublicationUrl(type: string, year: string, slug: string = ''): string {
  const base = type === 'mpr' ? BOC_MPR_URL : BOC_FSR_URL;
  return `${base}${year}/${slug}`;
}

/**
 * Look up a known rate history entry by date.
 */
export function findRateByDate(date: string): BocRateHistoryEntry | undefined {
  return BOC_RATE_HISTORY.find(e => e.date === date);
}

/**
 * Look up a schedule entry by date.
 */
export function findScheduleByDate(date: string): BocRateScheduleEntry | undefined {
  return BOC_RATE_SCHEDULE.find(e => e.date === date);
}
