// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GIC Appointment Ingestion — Quill
 *
 * Orchestrates Governor-in-Council appointment data ingestion from
 * multiple Canadian government sources.
 *
 * Pipeline:
 *   1. Fetch GIC appointments from GC InfoBase and/or CKAN sources
 *   2. Parse raw records into structured GICAppointment objects
 *   3. Categorize by body type and department
 *   4. Persist to D1 database
 *   5. Enable search and cross-referencing
 *
 * Designed for cron-based ingestion and ad-hoc queries.
 */

import { fetchGICAppointments, searchGicPackages } from './fetcher.js';
import { parseGICAppointments, categorizeByDepartment, categorizeByBody } from './parser.js';
import { GIC_SOURCE_CONFIGS, GIC_SOURCES } from './constants.js';
import type { GICAppointment, GICCategory, GICIngestionResult, RawGICRecord } from './types.js';
import type { D1Database } from '../committees/db.js';
import { upsertPerson, upsertOrganization } from '../../shared-db.js';

/**
 * GIC appointments table schema. MUST stay in lockstep with the INSERT
 * column list in ingestGIC(). Exported as `GIC_DDL` so the registry's
 * resolveCallArgs() auto-injects it (like COMMITTEE_DDL / CORPORATE_DDL)
 * before running the db-first module — without it the table is never
 * created and every insert fails with "no such table: gic_appointments"
 * (observed live during the #828 M2-gate run).
 */
export const GIC_DDL = `
CREATE TABLE IF NOT EXISTS gic_appointments (
  id TEXT PRIMARY KEY,
  appointee_name TEXT NOT NULL,
  position_title TEXT,
  organization TEXT,
  organization_acronym TEXT,
  category TEXT,
  department TEXT,
  appointment_date TEXT,
  expiry_date TEXT,
  is_retroactive INTEGER DEFAULT 0,
  salary_range TEXT,
  salary_min REAL,
  salary_max REAL,
  location TEXT,
  predecessor_name TEXT,
  order_in_council_number TEXT,
  source_url TEXT,
  source_system TEXT,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  ingested_at TEXT
);
`;


/**
 * Ingest GIC appointments into the database.
 *
 * Steps:
 *   1. Fetch from all available sources
 *   2. Parse raw records
 *   3. Categorize appointments
 *   4. Persist to D1 database
 */
export async function ingestGIC(
  db: D1Database | null,
  options: {
    /** Limit records per source */
    limit?: number;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Only specific CKAN package IDs */
    ckanPackageIds?: string[];
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<GICIngestionResult> {
  const startTime = Date.now();
  const result: GICIngestionResult = {
    source: 'gic-appointments',
    recordsFound: 0,
    recordsIngested: 0,
    categoriesFound: {
      board: 0, tribunal: 0, commission: 0, agency: 0,
      court: 0, 'crown-corporation': 0, committee: 0, other: 0,
    },
    highValueAppointments: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Phase 1: Fetch from sources
    log('[GIC] Fetching appointments from sources...');
    const fetched = await fetchGICAppointments({
      limit: options.limit,
      ckanPackageIds: options.ckanPackageIds,
    });

    result.recordsFound = fetched.records.length;
    log(`[GIC] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[GIC] No records found from any source');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Phase 2: Parse records
    log('[GIC] Parsing raw records...');
    const appointments = await parseGICAppointments(fetched.records, {
      sourceSystem: fetched.source,
    });
    log(`[GIC] Parsed ${appointments.length} structured appointments`);

    // Phase 3: Categorize and persist
    if (db) {
      log('[GIC] Persisting to database...');
      for (const appt of appointments) {
        try {
          // Check for existing record unless force flag
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM gic_appointments WHERE id = ? LIMIT 1',
            ).bind(appt.id).first();

            if (existing) {
              continue;
            }
          }

          // Upsert appointment
          await db.prepare(`
            INSERT OR REPLACE INTO gic_appointments
              (id, appointee_name, position_title, organization, organization_acronym,
               category, department, appointment_date, expiry_date, is_retroactive,
               salary_range, salary_min, salary_max, location, predecessor_name,
               order_in_council_number, source_url, source_system,
               ckan_package_id, ckan_resource_id, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            appt.id,
            appt.appointeeName,
            appt.positionTitle,
            appt.organization,
            appt.organizationAcronym,
            appt.category,
            appt.department,
            appt.appointmentDate,
            appt.expiryDate,
            appt.isRetroactive ? 1 : 0,
            appt.salaryRange,
            appt.salaryMin,
            appt.salaryMax,
            appt.location,
            appt.predecessorName,
            appt.orderInCouncilNumber,
            appt.sourceUrl,
            appt.sourceSystem,
            appt.ckanPackageId,
            appt.ckanResourceId,
            appt.ingestedAt,
          ).run();

          result.recordsIngested++;

          // Also upsert to shared tables
          try {
            upsertPerson(appt.appointeeName, {
              firstName: appt.appointeeName.split(" ")[0],
              lastName: appt.appointeeName.split(" ").slice(1).join(" "),
              source: "gic",
              rawData: {
                position: appt.positionTitle,
                organization: appt.organization,
                department: appt.department,
                appointmentDate: appt.appointmentDate,
                category: appt.category,
              },
            });
          } catch { /* non-fatal */ }
          try {
            upsertOrganization(appt.organization, {
              type: appt.category,
              source: "gic",
              rawData: {
                acronym: appt.organizationAcronym,
                department: appt.department,
              },
            });
          } catch { /* non-fatal */ }

          // Track categories
          const cat = appt.category;
          if (cat in result.categoriesFound) {
            result.categoriesFound[cat]++;
          }

          // Check if high-value body
          const isHighValue = appt.organizationAcronym !== null &&
            ['CRTC', 'CRTC-B', 'CER', 'CER-B', 'CT', 'CITT', 'FCA', 'FC', 'SCC', 'IRB'].includes(
              appt.organizationAcronym,
            );
          if (isHighValue) {
            result.highValueAppointments++;
          }

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${appt.appointeeName}: ${msg}`);
        }
      }

      log(`[GIC] Persisted ${result.recordsIngested} records`);
    } else {
      // No DB — just return the data
      result.recordsIngested = appointments.length;
      for (const appt of appointments) {
        const cat = appt.category;
        if (cat in result.categoriesFound) {
          result.categoriesFound[cat]++;
        }
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[GIC] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;

  const catSummary = Object.entries(result.categoriesFound)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  log(`[GIC] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    ` (${catSummary})` +
    (result.highValueAppointments > 0 ? `, ${result.highValueAppointments} high-value` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}


/**
 * Search GIC appointments by keyword across appointee name, position,
 * organization, and department fields.
 */
export async function searchGIC(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    category?: GICCategory;
    department?: string;
    organization?: string;
  } = {},
): Promise<GICAppointment[]> {
  let sql = `
    SELECT * FROM gic_appointments
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      appointee_name LIKE ? OR
      position_title LIKE ? OR
      organization LIKE ? OR
      department LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q);
  }

  if (options.category) {
    sql += ' AND category = ?';
    params.push(options.category);
  }

  if (options.department) {
    sql += ' AND department LIKE ?';
    params.push(`%${options.department}%`);
  }

  if (options.organization) {
    sql += ' AND organization LIKE ?';
    params.push(`%${options.organization}%`);
  }

  sql += ` ORDER BY appointment_date DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<GICAppointment>();
  return result.results ?? [];
}


/**
 * Get GIC appointments from the last N days.
 */
export async function getRecentAppointments(
  db: D1Database,
  days: number = 30,
  options: {
    limit?: number;
    category?: GICCategory;
  } = {},
): Promise<GICAppointment[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const since = sinceDate.toISOString().split('T')[0];

  let sql = `
    SELECT * FROM gic_appointments
    WHERE appointment_date >= ?
  `;
  const params: unknown[] = [since];

  if (options.category) {
    sql += ' AND category = ?';
    params.push(options.category);
  }

  sql += ` ORDER BY appointment_date DESC LIMIT ?`;
  params.push(options.limit ?? 100);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<GICAppointment>();
  return result.results ?? [];
}


/**
 * Get recent appointments to high-value GIC bodies (CRTC, CER, courts, etc.).
 */
export async function getHighValueAppointments(
  db: D1Database,
  options: {
    days?: number;
    limit?: number;
  } = {},
): Promise<GICAppointment[]> {
  const days = options.days ?? 365;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const since = sinceDate.toISOString().split('T')[0];

  const highValueAcronyms = [
    'CRTC', 'CRTC-B', 'CER', 'CER-B', 'CT', 'CITT',
    'FCA', 'FC', 'SCC', 'TCC', 'IRB', 'CHRT', 'CTA', 'CIRB',
  ];

  const placeholders = highValueAcronyms.map(() => '?').join(',');

  const sql = `
    SELECT * FROM gic_appointments
    WHERE appointment_date >= ?
      AND organization_acronym IN (${placeholders})
    ORDER BY appointment_date DESC
    LIMIT ?
  `;

  const params: unknown[] = [since, ...highValueAcronyms, options.limit ?? 50];

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<GICAppointment>();
  return result.results ?? [];
}


/**
 * Find GIC appointees who also appear in lobbying records.
 * This is a key cross-reference: did the appointee lobby before being appointed?
 *
 * Optionally filter by appointee name or position to search for a specific person.
 * Optionally accepts pre-fetched appointee records for in-memory matching
 * when a database is not available.
 *
 * Requires the lobbying_records table to be populated in the database,
 * or accepts lobbyingRecords dataset for in-memory matching.
 */
export async function findLobbyistsTurnedAppointees(
  db: D1Database | null,
  options: {
    /** Appointee name or position to search for (optional — omit for bulk mode) */
    name?: string;
    /** Limit results (default: 50) */
    limit?: number;
    /** Pre-fetched lobbying records for in-memory matching (used when db is null) */
    lobbyingRecords?: Array<{
      registrantName?: string | null;
      clientName?: string | null;
      communicationDate?: string | null;
    }>;
    /** Pre-fetched GIC appointments for in-memory matching (used when db is null) */
    appointments?: GICAppointment[];
  } = {},
): Promise<Array<{
  appointee: GICAppointment;
  lobbyingRecords: number;
  latestLobbyingDate: string | null;
}>> {
  // If a specific name/position is provided, filter by it
  if (options.name) {
    const searchTerm = `%${options.name}%`;

    if (db) {
      // Database mode with name filter
      const sql = `
        SELECT
          g.*,
          COUNT(lr.id) as lobbying_record_count,
          MAX(lr.communication_date) as latest_lobbying_date
        FROM gic_appointments g
        JOIN lobbying_records lr ON (
          lr.registrant_name LIKE ? OR
          lr.client_name LIKE ?
        )
        WHERE (g.appointee_name LIKE ? OR g.position_title LIKE ?)
          AND g.appointment_date > COALESCE(lr.communication_date, '1970-01-01')
        GROUP BY g.id
        ORDER BY lobbying_record_count DESC
        LIMIT ?
      `;

      const stmt = db.prepare(sql).bind(
        searchTerm, searchTerm,  // lobbying_records match
        searchTerm, searchTerm,  // appointee name/position filter
        options.limit ?? 50,
      );
      const result = await stmt.all<any>();
      return mapLobbyistAppointeeResults(result.results ?? []);
    }

    // In-memory mode with name filter
    if (options.appointments && options.lobbyingRecords) {
      const lowerName = options.name.toLowerCase();
      const filteredAppts = options.appointments.filter(a =>
        a.appointeeName.toLowerCase().includes(lowerName) ||
        (a.positionTitle && a.positionTitle.toLowerCase().includes(lowerName)),
      );
      return findMatchesInMemory(filteredAppts, options.lobbyingRecords, options.limit);
    }

    return [];
  }

  // Bulk mode (no name filter) — only works with database
  if (!db) {
    // In-memory bulk mode
    if (options.appointments && options.lobbyingRecords) {
      return findMatchesInMemory(options.appointments, options.lobbyingRecords, options.limit);
    }
    return [];
  }

  const sql = `
    SELECT
      g.*,
      COUNT(lr.id) as lobbying_record_count,
      MAX(lr.communication_date) as latest_lobbying_date
    FROM gic_appointments g
    JOIN lobbying_records lr ON (
      lr.registrant_name LIKE '%' || g.appointee_name || '%'
      OR lr.client_name LIKE '%' || g.appointee_name || '%'
    )
    WHERE g.appointment_date > COALESCE(lr.communication_date, '1970-01-01')
    GROUP BY g.id
    ORDER BY lobbying_record_count DESC
    LIMIT ?
  `;

  const stmt = db.prepare(sql).bind(options.limit ?? 50);
  const result = await stmt.all<any>();
  return mapLobbyistAppointeeResults(result.results ?? []);
}

/**
 * Map raw database rows to structured lobbyist-turned-appointee results.
 */
function mapLobbyistAppointeeResults(rows: any[]): Array<{
  appointee: GICAppointment;
  lobbyingRecords: number;
  latestLobbyingDate: string | null;
}> {
  return rows.map((r: any) => ({
    appointee: {
      id: r.id,
      appointeeName: r.appointee_name,
      positionTitle: r.position_title,
      organization: r.organization,
      organizationAcronym: r.organization_acronym,
      category: r.category,
      department: r.department,
      appointmentDate: r.appointment_date,
      expiryDate: r.expiry_date,
      isRetroactive: !!r.is_retroactive,
      salaryRange: r.salary_range,
      salaryMin: r.salary_min,
      salaryMax: r.salary_max,
      location: r.location,
      predecessorName: r.predecessor_name,
      orderInCouncilNumber: r.order_in_council_number,
      sourceUrl: r.source_url,
      sourceSystem: r.source_system,
      ckanPackageId: r.ckan_package_id,
      ckanResourceId: r.ckan_resource_id,
      ingestedAt: r.ingested_at,
    } as GICAppointment,
    lobbyingRecords: r.lobbying_record_count,
    latestLobbyingDate: r.latest_lobbying_date,
  }));
}

/**
 * Find matching lobbying records for given appointments in memory.
 */
function findMatchesInMemory(
  appointments: GICAppointment[],
  lobbyingRecords: Array<{
    registrantName?: string | null;
    clientName?: string | null;
    communicationDate?: string | null;
  }>,
  limit?: number,
): Array<{
  appointee: GICAppointment;
  lobbyingRecords: number;
  latestLobbyingDate: string | null;
}> {
  const results: Array<{
    appointee: GICAppointment;
    lobbyingRecords: number;
    latestLobbyingDate: string | null;
  }> = [];

  for (const appt of appointments) {
    const lowerName = appt.appointeeName.toLowerCase();
    const matches = lobbyingRecords.filter(lr =>
      (lr.registrantName && lr.registrantName.toLowerCase().includes(lowerName)) ||
      (lr.clientName && lr.clientName.toLowerCase().includes(lowerName)),
    );

    if (matches.length > 0) {
      const dates = matches
        .map(m => m.communicationDate)
        .filter((d): d is string => d !== null && d !== undefined)
        .sort()
        .reverse();

      results.push({
        appointee: appt,
        lobbyingRecords: matches.length,
        latestLobbyingDate: dates.length > 0 ? dates[0] : null,
      });
    }
  }

  // Sort by lobbying record count descending
  results.sort((a, b) => b.lobbyingRecords - a.lobbyingRecords);

  const cap = limit ?? 50;
  return results.slice(0, cap);
}


/**
 * Search GIC appointments in-memory (no DB required).
 * Fetches from available sources, parses, and filters.
 */
export async function searchGicAppointments(
  options: {
    query?: string;
    category?: GICCategory;
    limit?: number;
  } = {},
): Promise<GICAppointment[]> {
  const fetched = await fetchGICAppointments({ limit: options.limit ?? 100 });
  const appointments = await parseGICAppointments(fetched.records, {
    sourceSystem: fetched.source,
  });

  let filtered = appointments;

  if (options.category) {
    filtered = filtered.filter(a => a.category === options.category);
  }

  if (options.query) {
    const q = options.query.toLowerCase();
    filtered = filtered.filter(a =>
      a.appointeeName.toLowerCase().includes(q) ||
      a.positionTitle.toLowerCase().includes(q) ||
      a.organization.toLowerCase().includes(q) ||
      a.department.toLowerCase().includes(q),
    );
  }

  const cap = options.limit ?? 50;
  return filtered.slice(0, cap);
}

export type {
  GICAppointment,
  GICCategory,
  GICIngestionResult,
  RawGICRecord,
} from './types.js';

export {
  GIC_SOURCE_CONFIGS,
  GIC_SOURCES,
  GIC_CKAN_PACKAGE_IDS,
  ckanPackageUrl,
  ckanSearchUrl,
  infobaseApiUrl,
} from './constants.js';

export {
  fetchGICAppointments,
  fetchAppointmentDetail,
  searchGicPackages,
} from './fetcher.js';

export {
  parseGICAppointment,
  parseGICAppointments as parseGICAppointments,
  categorizeByDepartment,
  categorizeByBody,
  extractSalaryRange,
  extractDepartmentCategory,
} from './parser.js';
