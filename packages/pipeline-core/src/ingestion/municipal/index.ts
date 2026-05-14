/**
 * Municipal Council Data Ingestion — MapleSpike Pipeline
 *
 * Orchestrates municipal council meeting data ingestion from major Canadian
 * cities.  The most fragmented data source in the pipeline — each city uses
 * different publishing systems (eScribe, iCompass, CivicWeb, or custom CMS).
 *
 * Pipeline:
 *   1. Fetch meeting list pages / API responses from city council sources
 *   2. Parse raw HTML/JSON into structured RawCouncilRecord entries
 *   3. Convert to structured MunicipalMeeting objects with SHA-256 IDs
 *   4. Persist to D1 database (UPSERT semantics)
 *
 * Currently implemented: Toronto, Vancouver
 * 19 cities implemented with live fetchers
 *
 * Usage:
 *   import { ingestMunicipal } from './ingestion/municipal/index.js';
 *   await ingestMunicipal(db, { city: 'toronto', year: 2025 });
 *   await ingestMunicipal(db, { city: 'vancouver', year: 2025 });
 *   await ingestMunicipal(db, { all: true });  // all implemented cities
 */

import { fetchCityMeetings, fetchMeetingDetail } from './fetcher.js';
import {
  parseMeetingRecords,
  parseMeetingPage,
  detectMeetingTypes,
} from './parser.js';
import {
  ALL_CITIES,
  IMPLEMENTED_CITIES,
  CITY_CONFIGS,
  VENDOR_PLATFORM_PATTERNS,
  MEETING_TYPE_KEYWORDS,
  DECISION_TYPE_KEYWORDS,
  getCityConfig,
  isCityImplemented,
  detectVendorPlatform,
  meetingsListUrl,
  meetingDetailUrl,
  agendaUrl,
  minutesUrl,
  MunicipalCouncilError,
  NotYetImplementedError,
} from './constants.js';
import type {
  MunicipalMeeting,
  MeetingDecision,
  MeetingType,
  MeetingStatus,
  DecisionType,
  CityCode,
  CityConfig,
  CityInfo,
  VendorPlatform,
  RawCouncilRecord,
  MunicipalIngestionResult,
} from './types.js';
import type { D1Database } from '../committees/db.js';


/* ------------------------------------------------------------------ */
/*  DDL — Table Creation                                              */
/* ------------------------------------------------------------------ */

export const MUNICIPAL_MEETINGS_DDL = `
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
`;

export const MUNICIPAL_DDL = MUNICIPAL_MEETINGS_DDL;


/* ------------------------------------------------------------------ */
/*  Main Ingestion Function                                            */
/* ------------------------------------------------------------------ */

/**
 * Ingest municipal council meeting data for one or all cities.
 *
 * @param db — D1 database instance (null for dry-run / parse-only mode)
 * @param options — Configuration options
 */
export async function ingestMunicipal(
  db: D1Database | null,
  options: {
    /** Specific city to ingest (omit or set 'all' to run all implemented) */
    city?: CityCode | 'all';
    /** Year to fetch (default: current year) */
    year?: number;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<MunicipalIngestionResult[]> {
  const startTime = Date.now();
  const log = options.onProgress ?? (() => {});
  const year = options.year ?? new Date().getFullYear();
  const results: MunicipalIngestionResult[] = [];

  // Determine which cities to process
  const citiesToProcess: CityCode[] = [];
  const city = options.city;

  if (!city || city === 'all') {
    // Default: process all implemented cities
    citiesToProcess.push(...IMPLEMENTED_CITIES.map(c => c.code));
  } else {
    citiesToProcess.push(city);
  }

  // Process each city
  for (const city of citiesToProcess) {
    const cityResult = await ingestSingleCity(db, city, year, options);
    results.push(cityResult);

    log(`[Municipal] ${city}: ${cityResult.meetingsIngested} meetings ingested` +
      ` (${cityResult.meetingsFound} found, ${cityResult.errors.length} errors)`);
  }

  const totalDuration = Date.now() - startTime;
  log(`[Municipal] Done: ${results.length} cities processed in ${totalDuration}ms`);

  return results;
}

/**
 * Ingest municipal data for a single city.
 */
async function ingestSingleCity(
  db: D1Database | null,
  city: CityCode,
  year: number,
  options: {
    force?: boolean;
    onProgress?: (msg: string) => void;
  },
): Promise<MunicipalIngestionResult> {
  const startTime = Date.now();
  const log = options.onProgress ?? (() => {});
  const config = getCityConfig(city);

  const result: MunicipalIngestionResult = {
    city,
    year,
    meetingsFound: 0,
    meetingsIngested: 0,
    decisionsRecorded: 0,
    totalBudgetAmount: 0,
    sourcesTried: [],
    errors: [],
    durationMs: 0,
  };

  try {
    // Phase 1: Fetch
    log(`[Municipal/${city}] Fetching meetings for ${year}...`);
    const fetched = await fetchCityMeetings(city, year);
    result.sourcesTried = fetched.sourcesTried;
    result.meetingsFound = fetched.records.length;

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log(`[Municipal/${city}] No records found`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[Municipal/${city}] Fetched ${fetched.records.length} raw records`);

    // Phase 2: Parse
    log(`[Municipal/${city}] Parsing...`);

    // Run city-specific HTML parsing first
    const parsedRecords: RawCouncilRecord[] = [];
    for (const raw of fetched.records) {
      if (raw.rawHtml && !raw.title) {
        // This is a raw HTML page — run the city parser
        const extracted = parseMeetingPage(raw.rawHtml, city, raw.sourceUrl ?? '');
        parsedRecords.push(...extracted);
      } else {
        // Already partially parsed
        parsedRecords.push(raw);
      }
    }

    // Convert to structured MunicipalMeeting objects
    const meetings = await parseMeetingRecords(
      parsedRecords.length > 0 ? parsedRecords : fetched.records,
      { sourceSystem: `municipal-${city}` },
    );

    log(`[Municipal/${city}] Parsed ${meetings.length} meetings`);

    // Phase 3: Persist
    if (db) {
      log(`[Municipal/${city}] Persisting to database...`);

      for (const meeting of meetings) {
        try {
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM municipal_meetings WHERE id = ? LIMIT 1',
            ).bind(meeting.id).first();

            if (existing) continue;
          }

          await db.prepare(`
            INSERT OR REPLACE INTO municipal_meetings
              (id, city, province, date, meeting_type, status,
               title, description, department,
               meeting_url, agenda_url, minutes_url, video_url,
               decisions, agenda_items,
               budget_reference, budget_amount,
               vendor_platform, source_url, source_system, source_meeting_id,
               ingested_at)
            VALUES (?, ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    ?, ?,
                    ?, ?, ?, ?,
                    ?)
          `).bind(
            meeting.id,
            meeting.city,
            meeting.province,
            meeting.date,
            meeting.meetingType,
            meeting.status,
            meeting.title,
            meeting.description,
            meeting.department,
            meeting.meetingUrl,
            meeting.agendaUrl,
            meeting.minutesUrl,
            meeting.videoUrl,
            JSON.stringify(meeting.decisions),
            JSON.stringify(meeting.agendaItems),
            meeting.budgetReference,
            meeting.budgetAmount,
            meeting.vendorPlatform,
            meeting.sourceUrl,
            meeting.sourceSystem,
            meeting.sourceMeetingId,
            meeting.ingestedAt,
          ).run();

          result.meetingsIngested++;
          result.decisionsRecorded += meeting.decisions.length;

          if (meeting.budgetAmount !== null) {
            result.totalBudgetAmount += meeting.budgetAmount;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${meeting.title}: ${msg}`);
        }
      }

      log(`[Municipal/${city}] Persisted ${result.meetingsIngested} meetings`);
    } else {
      // No DB — dry run
      result.meetingsIngested = meetings.length;
      for (const meeting of meetings) {
        result.decisionsRecorded += meeting.decisions.length;
        if (meeting.budgetAmount !== null) {
          result.totalBudgetAmount += meeting.budgetAmount;
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[Municipal/${city}] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;

  log(`[Municipal/${city}] Done in ${result.durationMs}ms: ` +
    `${result.meetingsIngested}/${result.meetingsFound} meetings ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}


/* ------------------------------------------------------------------ */
/*  Query Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search municipal meetings by city, date range, or keyword.
 */
export async function searchMunicipalMeetings(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    city?: CityCode;
    meetingType?: MeetingType;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<MunicipalMeeting[]> {
  let sql = `SELECT * FROM municipal_meetings WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      title LIKE ? OR
      description LIKE ? OR
      department LIKE ? OR
      city LIKE ? OR
      source_meeting_id LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }

  if (options.city) {
    sql += ' AND city = ?';
    params.push(options.city);
  }

  if (options.meetingType) {
    sql += ' AND meeting_type = ?';
    params.push(options.meetingType);
  }

  if (options.department) {
    sql += ' AND department = ?';
    params.push(options.department);
  }

  if (options.dateFrom) {
    sql += ' AND date >= ?';
    params.push(options.dateFrom);
  }

  if (options.dateTo) {
    sql += ' AND date <= ?';
    params.push(options.dateTo);
  }

  sql += ` ORDER BY date DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const raw = await stmt.all<any>();
  return (raw.results ?? []).map(deserializeMeeting);
}

/**
 * Get recent meetings for a city.
 */
export async function getRecentMeetings(
  db: D1Database,
  city: CityCode,
  limit: number = 20,
): Promise<MunicipalMeeting[]> {
  const stmt = db.prepare(
    `SELECT * FROM municipal_meetings
     WHERE city = ?
     ORDER BY date DESC
     LIMIT ?`,
  ).bind(city, limit);

  const raw = await stmt.all<any>();
  return (raw.results ?? []).map(deserializeMeeting);
}

/**
 * Get meetings with budget references.
 */
export async function getBudgetMeetings(
  db: D1Database,
  options: {
    limit?: number;
    city?: CityCode;
    minAmount?: number;
    fiscalYear?: string;
  } = {},
): Promise<MunicipalMeeting[]> {
  let sql = `SELECT * FROM municipal_meetings WHERE budget_reference IS NOT NULL`;
  const params: unknown[] = [];

  if (options.city) {
    sql += ' AND city = ?';
    params.push(options.city);
  }

  if (options.fiscalYear) {
    sql += ' AND (budget_reference LIKE ? OR date LIKE ?)';
    params.push(`%${options.fiscalYear}%`, `${options.fiscalYear}%`);
  }

  if (options.minAmount !== undefined) {
    sql += ' AND budget_amount >= ?';
    params.push(options.minAmount);
  }

  sql += ` ORDER BY budget_amount DESC NULLS LAST, date DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const raw = await stmt.all<any>();
  return (raw.results ?? []).map(deserializeMeeting);
}

/**
 * Get meetings by vendor platform.
 * Useful for auditing which platforms are producing data.
 */
export async function getMeetingsByVendor(
  db: D1Database,
  vendorPlatform: VendorPlatform,
  options: {
    limit?: number;
    city?: CityCode;
  } = {},
): Promise<MunicipalMeeting[]> {
  let sql = `SELECT * FROM municipal_meetings WHERE vendor_platform = ?`;
  const params: unknown[] = [vendorPlatform];

  if (options.city) {
    sql += ' AND city = ?';
    params.push(options.city);
  }

  sql += ` ORDER BY date DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const raw = await stmt.all<any>();
  return (raw.results ?? []).map(deserializeMeeting);
}


/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function deserializeMeeting(row: any): MunicipalMeeting {
  return {
    ...row,
    decisions: typeof row.decisions === 'string' ? JSON.parse(row.decisions) : (row.decisions ?? []),
    agendaItems: typeof row.agenda_items === 'string' ? JSON.parse(row.agenda_items) : (row.agenda_items ?? []),
    meetingType: row.meeting_type,
    meetingUrl: row.meeting_url,
    agendaUrl: row.agenda_url,
    minutesUrl: row.minutes_url,
    videoUrl: row.video_url,
    budgetReference: row.budget_reference,
    budgetAmount: row.budget_amount,
    vendorPlatform: row.vendor_platform,
    sourceMeetingId: row.source_meeting_id,
    ingestedAt: row.ingested_at,
  } as MunicipalMeeting;
}
