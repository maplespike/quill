/**
 * Northwest Territories Ministerial Travel & Meeting Registry Fetcher
 *
 * GNWT publishes quarterly Ministerial Travel and Meeting Registry at
 * https://engage.eia.gov.nt.ca/en/meeting-registry/ as substitute for
 * formal lobbyist registry (NWT rejected registry proposal in 2015).
 *
 * Since 2015, quarterly CSV exports of meetings between Cabinet Members
 * and external parties available for download.
 *
 * CSV Export: https://engage.eia.gov.nt.ca/en/meeting-registry/meeting-disclosure/?format=csv
 * Source: Government of Northwest Territories / Department of Executive and Indigenous Affairs
 *
 * CSV columns:
 *   meeting, date, minister, portfolio, type, other_ministers,
 *   outside_parties, date_published, date_modified, reason_modified, as_of
 *
 * Mapping to RawNWTRecord:
 *   meeting       → registrationNumber
 *   minister      → lobbyistName (minister is the "registrant" being met)
 *   portfolio     → governmentBodies[]
 *   type          → subjectMatters[]
 *   outside_parties → clientName (organization/people meeting minister)
 *   other_ministers → officials[] (split by semicolon)
 *   date          → communicationDate
 *   date_published → sourceUrl
 */

import { httpGet } from '../../../utils/http.js';
import { NWT_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawNWTRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


const CSV_ENDPOINT =
  'https://engage.eia.gov.nt.ca/en/meeting-registry/meeting-disclosure/?format=csv';


export class NWTLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'NWTLobbyingFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8',
} as const;


/**
 * Parse a single CSV row per RFC 4180 into string fields.
 *
 * Handles:
 *   - Quoted fields with embedded commas
 *   - Escaped double-quotes ("") within quoted fields
 *   - Leading/trailing whitespace is NOT stripped (caller decides)
 */
function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}


/**
 * Split CSV text into row strings, handling quoted fields spanning
 * multiple lines (RFC 4180 allows embedded newlines inside quotes).
 *
 * Handles \n, \r\n, and standalone \r line endings.
 */
function splitCSVRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      if (current.length > 0 || rows.length > 0) {
        rows.push(current);
      }
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      if (i + 1 < text.length && text[i + 1] === '\n') {
        i++;
      }
      rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    rows.push(current);
  }
  return rows;
}


/**
 * Download the full NWT Meeting Registry CSV from the GNWT EIA portal.
 *
 * @returns Raw CSV text
 * @throws {NWTLobbyingFetchError} on HTTP error
 */
export async function fetchNTCsv(): Promise<string> {
  const resp: HttpResponse = await httpGet(CSV_ENDPOINT, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new NWTLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching NWT Meeting Registry CSV`,
      resp.statusCode,
      CSV_ENDPOINT,
    );
  }

  return resp.body;
}


/**
 * Parse NWT Meeting Registry CSV into RawNWTRecord[].
 *
 * Column mapping:
 *   meeting          → registrationNumber
 *   minister         → lobbyistName
 *   portfolio        → governmentBodies[0]
 *   type             → subjectMatters[0]
 *   outside_parties  → clientName
 *   other_ministers  → officials[] (split by ';')
 *   date             → communicationDate
 *   date_published   → sourceUrl
 *
 * @param csvText Raw CSV content
 * @returns Parsed records (empty array if CSV has no data or missing required cols)
 */
export function parseNTCsv(csvText: string): RawNWTRecord[] {
  const rows = splitCSVRows(csvText);

  if (rows.length < 2) return [];

  const headerFields = parseCSVRow(rows[0]);
  const colIndex = new Map<string, number>();
  headerFields.forEach((name, idx) => {
    colIndex.set(name.trim().toLowerCase(), idx);
  });

  const REQUIRED = ['meeting', 'date', 'minister', 'portfolio', 'type', 'outside_parties'];
  for (const col of REQUIRED) {
    if (!colIndex.has(col)) {
      console.warn(`[NWT-CSV] Missing required column "${col}" — cannot parse`);
      return [];
    }
  }

  const records: RawNWTRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const line = rows[i].trim();
    if (!line) continue;

    const fields = parseCSVRow(line);

    const col = (name: string): string | undefined => {
      const idx = colIndex.get(name);
      if (idx === undefined || idx >= fields.length) return undefined;
      const val = fields[idx].trim();
      return val || undefined;
    };

    const meetingId = col('meeting');
    if (!meetingId) continue;

    const portfolioVal = col('portfolio');
    const typeVal = col('type');
    const otherMinisters = col('other_ministers');

    records.push({
      registrationNumber: meetingId,
      lobbyistName: col('minister'),
      clientName: col('outside_parties'),
      communicationDate: col('date'),
      governmentBodies: portfolioVal ? [portfolioVal] : [],
      subjectMatters: typeVal ? [typeVal] : [],
      officials: otherMinisters
        ? otherMinisters.split(';').map(s => s.trim()).filter(Boolean)
        : [],
      sourceUrl: CSV_ENDPOINT,
    });
  }

  return records;
}


/**
 * Search NWT Meeting Registry by keyword.
 *
 * Downloads full CSV, then filters records where clientName,
 * lobbyistName, subjectMatters, or governmentBodies contain the query.
 *
 * @param query Case-insensitive keyword to match
 * @returns Matching partial records
 */
export async function searchNTRegistry(
  query: string,
): Promise<Partial<RawNWTRecord>[]> {
  try {
    const csvText = await fetchNTCsv();
    const allRecords = parseNTCsv(csvText);
    const q = query.toLowerCase();

    return allRecords.filter(r =>
      r.clientName?.toLowerCase().includes(q) ||
      r.lobbyistName?.toLowerCase().includes(q) ||
      r.subjectMatters?.some(s => s.toLowerCase().includes(q)) ||
      r.governmentBodies?.some(b => b.toLowerCase().includes(q)),
    );
  } catch (err) {
    console.warn('[NWT-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Fetch lobbying records from the NWT Ministerial Travel & Meeting Registry.
 *
 * Downloads quarterly CSV from GNWT EIA portal, parses into normalized
 * RawNWTRecord shape, and applies optional query filter and limit.
 *
 * @param options.query  Optional keyword filter (searches client/party names)
 * @param options.limit  Max records to return
 * @returns Records, source label, and any errors encountered
 */
export async function fetchNTLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawNWTRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawNWTRecord[] = [];
  let source = 'none';

  if (options.query) {
    try {
      const searchResults = await searchNTRegistry(options.query);
      records = searchResults as RawNWTRecord[];
      source = 'nt-csv-search';
    } catch (err) {
      errors.push(`NWT CSV search failed: ${(err as Error).message}`);
    }
  }

  if (records.length === 0) {
    try {
      const csvText = await fetchNTCsv();
      records = parseNTCsv(csvText);
      source = 'nt-csv-full';
    } catch (err) {
      errors.push(`NWT CSV fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
