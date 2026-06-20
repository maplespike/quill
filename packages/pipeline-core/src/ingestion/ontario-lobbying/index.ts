// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ontario Lobbying Registry Ingestion — MapleSpike Pipeline
 *
 * Ingests data from the Integrity Commissioner of Ontario (OICO)
 * Lobbyists Registry — the third-largest lobbying registry in Canada.
 *
 * Sources (in order of preference):
 *   1. Ontario Data Catalogue (CKAN) — https://data.ontario.ca — CSV dumps of lobbying data
 *   2. OICO Lobbyists Registry search — https://lobbyist.oico.on.ca/lobbyistregistry/search
 *   3. Monthly communication reports — https://lobbyist.oico.on.ca/lobbyistregistry/monthly-reports
 *
 * Use ingestOntarioLobbying() for bulk ingestion and
 * searchOntarioLobbying() for ad-hoc queries.
 *
 * Cross-jurisdiction influence tracking: trace organizations that lobby
 * the Ontario government AND the federal government on the same issue.
 */

import { httpGet } from '../../utils/http.js';
import { hashString } from '../rss.js';
import type { D1Database } from '../committees/db.js';


/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OntarioLobbyingRecord {
  /** Stable hash-based ID (SHA-1-like from registry + registration number) */
  id: string;

  /** Ontario Lobbyists Registry registration number */
  registrationNumber: string;

  /** Lobbyist / registrant information */
  registrantName: string;
  registrantBusinessName: string | null;
  registrantAddress: string | null;

  /** Client organization being represented */
  clientName: string;
  clientBusiness: string | null;

  /** Subject matter(s) of lobbying activity */
  subjectMatters: string[];

  /** Government institution(s) contacted */
  governmentBodies: string[];

  /** Specific public office holder(s) contacted */
  officials: string[];

  /** Lobbying period */
  startDate: string | null;
  endDate: string | null;

  /** Date of last communication */
  communicationDate: string | null;

  /** Lobbyist type: consultant (external) or in-house */
  lobbyistType: 'consultant' | 'in-house';

  /** Registration status (active, inactive, etc.) */
  status: string | null;

  /** Source URL on the Ontario registry */
  sourceUrl: string;

  /** When this record was ingested */
  ingestedAt: string;
}

export interface OntarioLobbyingSearchResult {
  records: OntarioLobbyingRecord[];
  total: number;
  query: string;
  source: string;
  errors: string[];
}

export interface OntarioLobbyingIngestionResult {
  source: 'ontario-lobbying';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}

export interface OntarioLobbyingStats {
  totalRegistrations: number;
  activeRegistrations: number;
  consultantLobbyists: number;
  inHouseLobbyists: number;
  topSubjects: Array<{ subject: string; count: number }>;
  topClients: Array<{ client: string; count: number }>;
}


/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ONTARIO_LOBBYING_BASE = 'https://lobbyist.oico.on.ca/lobbyistregistry';
const ONTARIO_CKAN_BASE = 'https://data.ontario.ca/api/3/action';

/** Ontario CKAN — search for lobbying-related datasets */
const CKAN_SEARCH_URL = `${ONTARIO_CKAN_BASE}/package_search?q=lobbyists&rows=10`;

/** Ontario Lobbyists Registry — search page */
const REGISTRY_SEARCH_URL = `${ONTARIO_LOBBYING_BASE}/search`;

/** Ontario Lobbyists Registry — monthly reports page */
const MONTHLY_REPORTS_URL = `${ONTARIO_LOBBYING_BASE}/monthly-reports`;

/** DDL for the Ontario lobbying table used when persisting to D1 */
const ONTARIO_LOBBYING_DDL = `
  CREATE TABLE IF NOT EXISTS ontario_lobbying (
    id TEXT PRIMARY KEY,
    registration_number TEXT NOT NULL,
    registrant_name TEXT NOT NULL,
    registrant_business_name TEXT,
    registrant_address TEXT,
    client_name TEXT NOT NULL,
    client_business TEXT,
    subject_matters TEXT NOT NULL DEFAULT '[]',
    government_bodies TEXT NOT NULL DEFAULT '[]',
    officials TEXT NOT NULL DEFAULT '[]',
    start_date TEXT,
    end_date TEXT,
    communication_date TEXT,
    lobbyist_type TEXT NOT NULL DEFAULT 'consultant',
    status TEXT,
    source_url TEXT NOT NULL,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ontario_lobbying_registration
    ON ontario_lobbying(registration_number);
  CREATE INDEX IF NOT EXISTS idx_ontario_lobbying_client
    ON ontario_lobbying(client_name);
  CREATE INDEX IF NOT EXISTS idx_ontario_lobbying_subject
    ON ontario_lobbying(subject_matters);
`;

const DEFAULT_USER_AGENT =
  process.env['DEFAULT_USER_AGENT'] ??
  'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';


/* ------------------------------------------------------------------ */
/*  CKAN Data Fetcher                                                  */
/* ------------------------------------------------------------------ */

interface OntarioCkanPackageResult {
  id: string;
  title: string;
  notes: string | null;
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
    description: string | null;
  }>;
}

interface OntarioCkanSearchResponse {
  success: boolean;
  result: {
    results: OntarioCkanPackageResult[];
    count: number;
  };
}

/**
 * Search the Ontario Data Catalogue for lobbying-related datasets via CKAN.
 */
async function searchCkanDatasets(): Promise<OntarioCkanPackageResult[]> {
  try {
    const resp = await httpGet(CKAN_SEARCH_URL, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json' },
    });

    if (resp.statusCode >= 400 || !resp.body) {
      return [];
    }

    const data = await resp.json<OntarioCkanSearchResponse>();
    if (!data.success || !data.result?.results) {
      return [];
    }

    return data.result.results;
  } catch (err) {
    console.warn('[ON-Lobbying] CKAN search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Parse a CSV text into an array of OntarioLobbyingRecord objects.
 */
function parseCsvToRecords(csvText: string, sourceUrl: string): OntarioLobbyingRecord[] {
  const records: OntarioLobbyingRecord[] = [];
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);

  if (lines.length < 2) return records;

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });

      const registrationNumber = row['RegistrationNumber'] ?? row['registration_number'] ?? row['Reg Number'] ?? '';
      if (!registrationNumber) continue;

      const now = new Date().toISOString();
      const record: OntarioLobbyingRecord = {
        id: `on-lobby-${hashString(registrationNumber + sourceUrl)}`,
        registrationNumber,
        registrantName: row['LobbyistName'] ?? row['lobbyist_name'] ?? row['Registrant Name'] ?? 'Unknown',
        registrantBusinessName: row['BusinessName'] ?? row['business_name'] ?? null,
        registrantAddress: row['Address'] ?? row['address'] ?? null,
        clientName: row['ClientName'] ?? row['client_name'] ?? 'Unknown',
        clientBusiness: row['ClientBusiness'] ?? row['client_business'] ?? null,
        subjectMatters: (row['SubjectMatter'] ?? row['subject_matter'] ?? '')
          .split(';').map(s => s.trim()).filter(Boolean),
        governmentBodies: (row['GovernmentBody'] ?? row['government_body'] ?? row['Institution'] ?? '')
          .split(';').map(s => s.trim()).filter(Boolean),
        officials: (row['Official'] ?? row['official'] ?? row['PublicOfficeHolder'] ?? '')
          .split(';').map(s => s.trim()).filter(Boolean),
        startDate: row['StartDate'] ?? row['start_date'] ?? null,
        endDate: row['EndDate'] ?? row['end_date'] ?? null,
        communicationDate: row['CommunicationDate'] ?? row['communication_date'] ?? null,
        lobbyistType: (row['LobbyistType'] ?? row['lobbyist_type'] ?? '').toLowerCase() === 'in-house'
          ? 'in-house'
          : 'consultant',
        status: row['Status'] ?? row['status'] ?? null,
        sourceUrl,
        ingestedAt: now,
      };

      records.push(record);
    } catch {
      // Skip malformed rows
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  HTML Registry Fetcher                                              */
/* ------------------------------------------------------------------ */

/**
 * Parse Ontario Lobbyists Registry HTML search results into partial records.
 */
function parseRegistrySearchHtml(html: string, sourceUrl: string): OntarioLobbyingRecord[] {
  const records: OntarioLobbyingRecord[] = [];
  const now = new Date().toISOString();

  // Match table rows in the search results
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 3) continue;

    const extractCell = (idx: number): string => {
      const cell = cells[idx];
      if (!cell) return '';
      return cell.replace(/<[^>]+>/g, '').trim();
    };

    const regLinkMatch = cells[0]?.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    const registrationNumber = regLinkMatch
      ? regLinkMatch[2].replace(/<[^>]+>/g, '').trim()
      : extractCell(0);

    if (!registrationNumber) continue;

    const detailUrl = regLinkMatch?.[1]
      ? (regLinkMatch[1].startsWith('http')
          ? regLinkMatch[1]
          : `${ONTARIO_LOBBYING_BASE}/${regLinkMatch[1].replace(/^\//, '')}`)
      : sourceUrl;

    records.push({
      id: `on-lobby-html-${hashString(registrationNumber + sourceUrl)}`,
      registrationNumber,
      registrantName: extractCell(1) || 'Unknown',
      registrantBusinessName: null,
      registrantAddress: null,
      clientName: extractCell(2) || 'Unknown',
      clientBusiness: null,
      subjectMatters: extractCell(3) ? [extractCell(3)] : [],
      governmentBodies: [],
      officials: [],
      startDate: null,
      endDate: null,
      communicationDate: null,
      lobbyistType: 'consultant',
      status: extractCell(4) || null,
      sourceUrl: detailUrl,
      ingestedAt: now,
    });
  }

  return records;
}

/**
 * Search the Ontario Lobbyists Registry HTML interface by keyword.
 */
async function fetchRegistrySearch(query: string): Promise<OntarioLobbyingRecord[]> {
  const searchUrl = `${REGISTRY_SEARCH_URL}?q=${encodeURIComponent(query)}`;

  try {
    const resp = await httpGet(searchUrl, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'text/html,*/*' },
    });

    if (resp.statusCode >= 400 || !resp.body) {
      return [];
    }

    return parseRegistrySearchHtml(resp.body, searchUrl);
  } catch (err) {
    console.warn('[ON-Lobbying] Registry search fetch failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch the list of monthly communication reports from the Ontario registry.
 */
async function fetchMonthlyReports(): Promise<Array<{ year: number; month: number; csvUrl: string }>> {
  const reports: Array<{ year: number; month: number; csvUrl: string }> = [];

  try {
    const resp = await httpGet(MONTHLY_REPORTS_URL, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'text/html,*/*' },
    });

    if (resp.statusCode >= 400 || !resp.body) {
      return reports;
    }

    const linkPattern = /<a\s[^>]*href="([^"]*lobbying[^"]*report[^"]*(?:csv|pdf))"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(resp.body)) !== null) {
      const href = linkMatch[1];
      const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();

      const yearMatch = text.match(/(\d{4})/) || href.match(/(\d{4})/);
      const monthNames = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
      const monthMatch = text.match(monthNames);
      const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      };

      if (yearMatch) {
        reports.push({
          year: parseInt(yearMatch[1], 10),
          month: monthMatch ? (monthMap[monthMatch[0].toLowerCase()] ?? 0) : 0,
          csvUrl: href.startsWith('http') ? href : `${ONTARIO_LOBBYING_BASE}/${href.replace(/^\//, '')}`,
        });
      }
    }
  } catch (err) {
    console.warn('[ON-Lobbying] Monthly reports fetch failed:', (err as Error).message);
  }

  return reports;
}


/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ingest Ontario lobbying records from all available sources.
 *
 * Tries sources in order:
 *   1. Ontario Data Catalogue (CKAN) — CSV dump of lobbying records
 *   2. OICO Lobbyists Registry HTML search — keyword search fallback
 *   3. Monthly communication reports — supplementary metadata
 *
 * When `db` is provided, records are persisted to the `ontario_lobbying`
 * table. When `db` is null, the ingestion result includes the fetched
 * records for in-memory use.
 *
 * @param db - Optional D1 database instance for persistence
 * @param options - Query options (limit, query, force, onProgress)
 */
export async function ingestOntarioLobbying(
  db: D1Database | null,
  options: {
    /** Search query to filter results */
    query?: string;
    /** Maximum records to return */
    limit?: number;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<OntarioLobbyingIngestionResult> {
  const startTime = Date.now();
  const result: OntarioLobbyingIngestionResult = {
    source: 'ontario-lobbying',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const allRecords: OntarioLobbyingRecord[] = [];

  log('[ON-Lobbying] Starting Ontario lobbying registry ingestion...');

  try {
    // Initialize D1 table if provided
    if (db) {
      await db.exec(ONTARIO_LOBBYING_DDL);
      log('[ON-Lobbying] Table initialized');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`DB init: ${msg}`);
    log(`[ON-Lobbying] DB init error: ${msg}`);
    // Continue even without DB — return data in-memory
  }

  // --- Source 1: CKAN CSV dump ---
  log('[ON-Lobbying] Trying CKAN datasets...');
  try {
    const datasets = await searchCkanDatasets();

    if (datasets.length > 0) {
      log(`[ON-Lobbying] Found ${datasets.length} CKAN dataset(s)`);

      for (const dataset of datasets) {
        for (const resource of dataset.resources) {
          if (resource.format?.toUpperCase() === 'CSV') {
            try {
              const csvResp = await httpGet(resource.url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
              });

              if (csvResp.statusCode < 400 && csvResp.body) {
                const records = parseCsvToRecords(csvResp.body, resource.url);
                allRecords.push(...records);
                log(`[ON-Lobbying] Parsed ${records.length} records from ${resource.name || resource.url}`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              result.errors.push(`CKAN CSV ${resource.url}: ${msg}`);
            }
          }
        }
      }
    } else {
      log('[ON-Lobbying] No CKAN lobbying datasets found');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`CKAN search error: ${msg}`);
    log(`[ON-Lobbying] CKAN error: ${msg}`);
  }

  // --- Source 2: HTML registry search (fallback or supplement) ---
  if (allRecords.length === 0 && options.query) {
    log(`[ON-Lobbying] Falling back to registry HTML search for "${options.query}"...`);
    try {
      const htmlRecords = await fetchRegistrySearch(options.query);
      allRecords.push(...htmlRecords);
      log(`[ON-Lobbying] Found ${htmlRecords.length} record(s) via HTML search`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`HTML search: ${msg}`);
    }
  }

  // --- Source 3: Monthly reports (supplementary — just discover available) ---
  try {
    const reports = await fetchMonthlyReports();
    if (reports.length > 0) {
      log(`[ON-Lobbying] ${reports.length} monthly report(s) available for incremental sync`);
    }
  } catch {
    // Non-fatal
  }

  result.recordsFound = allRecords.length;
  log(`[ON-Lobbying] Total records fetched: ${allRecords.length}`);

  // Apply limit
  const limited = options.limit && allRecords.length > options.limit
    ? allRecords.slice(0, options.limit)
    : allRecords;

  // --- Persist to D1 ---
  if (db) {
    log(`[ON-Lobbying] Persisting ${limited.length} records to D1...`);

    for (const record of limited) {
      try {
        // Skip existing unless force
        if (!options.force) {
          const existing = await db.prepare(
            'SELECT 1 FROM ontario_lobbying WHERE id = ? LIMIT 1',
          ).bind(record.id).first<Record<string, unknown>>();

          if (existing) {
            continue;
          }
        }

        await db.prepare(`
          INSERT OR REPLACE INTO ontario_lobbying
            (id, registration_number, registrant_name, registrant_business_name,
             registrant_address, client_name, client_business, subject_matters,
             government_bodies, officials, start_date, end_date, communication_date,
             lobbyist_type, status, source_url, ingested_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          record.id,
          record.registrationNumber,
          record.registrantName,
          record.registrantBusinessName,
          record.registrantAddress,
          record.clientName,
          record.clientBusiness,
          JSON.stringify(record.subjectMatters),
          JSON.stringify(record.governmentBodies),
          JSON.stringify(record.officials),
          record.startDate,
          record.endDate,
          record.communicationDate,
          record.lobbyistType,
          record.status,
          record.sourceUrl,
          record.ingestedAt,
        ).run();

        result.recordsIngested++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Insert ${record.registrationNumber}: ${msg}`);
      }
    }

    log(`[ON-Lobbying] Persisted ${result.recordsIngested} records (${result.errors.length} errors)`);
  } else {
    result.recordsIngested = limited.length;
  }

  result.durationMs = Date.now() - startTime;
  log(`[ON-Lobbying] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}

/**
 * Search the Ontario Lobbyists Registry by keyword, returning results
 * from both CKAN (if available) and the live HTML search interface.
 *
 * This is a lighter-weight query than full ingestion — designed for
 * ad-hoc lookups from the MCP server or dashboard.
 *
 * @param query - Search keyword (registrant name, client, subject, etc.)
 * @param options - Optional: limit, includeCkan (default: true)
 */
export async function searchOntarioLobbying(
  query: string,
  options: {
    /** Maximum search results to return */
    limit?: number;
    /** Whether to also search CKAN datasets (default: true) */
    includeCkan?: boolean;
  } = {},
): Promise<OntarioLobbyingSearchResult> {
  const result: OntarioLobbyingSearchResult = {
    records: [],
    total: 0,
    query,
    source: 'html-search',
    errors: [],
  };

  const includeCkan = options.includeCkan ?? true;

  // Source 1: CKAN (if available)
  if (includeCkan) {
    try {
      const datasets = await searchCkanDatasets();
      for (const dataset of datasets) {
        for (const resource of dataset.resources) {
          if (resource.format?.toUpperCase() === 'CSV') {
            try {
              const csvResp = await httpGet(resource.url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
              });

              if (csvResp.statusCode < 400 && csvResp.body) {
                const records = parseCsvToRecords(csvResp.body, resource.url);
                const matching = records.filter(r =>
                  r.registrantName.toLowerCase().includes(query.toLowerCase()) ||
                  r.clientName.toLowerCase().includes(query.toLowerCase()) ||
                  r.subjectMatters.some(s => s.toLowerCase().includes(query.toLowerCase())) ||
                  r.registrationNumber.toLowerCase().includes(query.toLowerCase())
                );
                result.records.push(...matching);

                if (matching.length > 0) {
                  result.source = 'ckan';
                }
              }
            } catch (err) {
              result.errors.push(`CKAN CSV: ${(err as Error).message}`);
            }
          }
        }
      }
    } catch (err) {
      result.errors.push(`CKAN search: ${(err as Error).message}`);
    }
  }

  // Source 2: HTML registry search — richer, more up-to-date
  try {
    const htmlRecords = await fetchRegistrySearch(query);

    // Deduplicate by registration number
    const existingIds = new Set(result.records.map(r => r.registrationNumber));
    for (const record of htmlRecords) {
      if (!existingIds.has(record.registrationNumber)) {
        result.records.push(record);
        existingIds.add(record.registrationNumber);
      }
    }

    if (htmlRecords.length > 0) {
      result.source = 'html-search';
    }
  } catch (err) {
    result.errors.push(`HTML search: ${(err as Error).message}`);
  }

  // Apply limit
  if (options.limit && result.records.length > options.limit) {
    result.records = result.records.slice(0, options.limit);
  }

  result.total = result.records.length;
  return result;
}

/**
 * Get summary statistics about the current Ontario lobbying registry data
 * (requires a database connection with pre-ingested data).
 *
 * @param db - D1 database with populated ontario_lobbying table
 */
export async function getOntarioLobbyingStats(
  db: D1Database,
): Promise<OntarioLobbyingStats> {
  const totalRegistrations = await db.prepare(
    'SELECT COUNT(*) as count FROM ontario_lobbying',
  ).first<{ count: number }>() ?? { count: 0 };

  const activeRegistrations = await db.prepare(
    "SELECT COUNT(*) as count FROM ontario_lobbying WHERE status = 'Active' OR status IS NULL",
  ).first<{ count: number }>() ?? { count: 0 };

  const consultantLobbyists = await db.prepare(
    "SELECT COUNT(*) as count FROM ontario_lobbying WHERE lobbyist_type = 'consultant'",
  ).first<{ count: number }>() ?? { count: 0 };

  const inHouseLobbyists = await db.prepare(
    "SELECT COUNT(*) as count FROM ontario_lobbying WHERE lobbyist_type = 'in-house'",
  ).first<{ count: number }>() ?? { count: 0 };

  const topSubjects = await db.prepare(`
    SELECT subject_matters as raw, COUNT(*) as count
    FROM ontario_lobbying
    WHERE subject_matters != '[]'
    GROUP BY subject_matters
    ORDER BY count DESC
    LIMIT 10
  `).all<{ raw: string; count: number }>();

  const topClients = await db.prepare(`
    SELECT client_name as client, COUNT(*) as count
    FROM ontario_lobbying
    GROUP BY client_name
    ORDER BY count DESC
    LIMIT 10
  `).all<{ client: string; count: number }>();

  return {
    totalRegistrations: totalRegistrations.count,
    activeRegistrations: activeRegistrations.count,
    consultantLobbyists: consultantLobbyists.count,
    inHouseLobbyists: inHouseLobbyists.count,
    topSubjects: (topSubjects?.results ?? []).map(r => ({
      subject: (() => { try { return JSON.parse(r.raw)[0] ?? r.raw; } catch { return r.raw; } })(),
      count: r.count,
    })),
    topClients: (topClients?.results ?? []).map(r => ({
      client: r.client,
      count: r.count,
    })),
  };
}
