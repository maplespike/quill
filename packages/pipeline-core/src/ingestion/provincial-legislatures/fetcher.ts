/**
 * Provincial Legislatures Fetcher — MapleSpike Pipeline
 *
 * HTTP fetchers for provincial legislative data across Canada.
 * Each province has its own data format and API approach:
 *
 *   Ontario (ola.org)    — Best API: XML Hansard, committee evidence, bills list
 *   BC (leg.bc.ca)       — XML Hansard archives, committee HTML pages
 *   Alberta (assembly.ab.ca) — HTML Hansard, committee hearing pages
 *   Quebec (assnat.qc.ca)    — XML Hansard (bilingual), committee HTML
 *   Others                — HTML/PDF, stubs returning empty arrays
 *
 * The main entry point is fetchProvincialHansard(province, date) which
 * dispatches to the appropriate province-specific fetcher.
 */

import { httpGet } from '../../utils/http.js';
import {
  PROVINCE_CONFIGS,
  IMPLEMENTED_PROVINCES,
  ONTARIO,
  BC,
  ALBERTA,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT_MS,
  ProvincialLegislatureError,
} from './constants.js';
import type {
  ProvinceCode,
  ProvincialLegislatureRecord,
  LegislativeRecordType,
  ProvinceLegislatureConfig,
} from './types.js';
import { computeHash } from '../../verification/hashing.js';

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch provincial legislative records for a given province and date range.
 *
 * This is the main entry point that dispatches to province-specific
 * fetchers. For provinces without implemented fetchers, it returns
 * an empty array.
 *
 * @param province - Province code (ON, BC, AB, etc.)
 * @param options - Options including date range and record types
 * @returns Array of raw/partial ProvincialLegislatureRecord objects
 */
export async function fetchProvincialHansard(
  province: ProvinceCode,
  options: {
    recordTypes?: LegislativeRecordType[];
    dateFrom?: string;
    dateTo?: string;
    maxRecords?: number;
  } = {},
): Promise<ProvincialLegislatureRecord[]> {
  const config = PROVINCE_CONFIGS[province];
  if (!config) {
    throw new ProvincialLegislatureError(
      `Unknown province: ${province}`,
      'UNKNOWN_PROVINCE',
      province,
    );
  }

  // Check if implementation exists
  const isImplemented = IMPLEMENTED_PROVINCES.some((p) => p.province === province);

  if (!isImplemented) {
    // Return empty for non-implemented provinces
    return [];
  }

  const maxRecords = options.maxRecords ?? 500;
  const recordTypes = options.recordTypes ?? ['hansard', 'committee', 'bill'];

  const allRecords: ProvincialLegislatureRecord[] = [];

  for (const type of recordTypes) {
    if (allRecords.length >= maxRecords) break;

    switch (province) {
      case 'ON':
        allRecords.push(...await fetchOntarioLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'BC':
        allRecords.push(...await fetchBCLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'AB':
        allRecords.push(...await fetchAlbertaLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      // Other provinces dispatch to stubs (return empty)
    }
  }

  return allRecords.slice(0, maxRecords);
}

/**
 * Convenience method to fetch all implemented provinces at once.
 */
export async function fetchAllProvincialHansard(
  options: {
    provinces?: ProvinceCode[];
    recordTypes?: LegislativeRecordType[];
    dateFrom?: string;
    dateTo?: string;
    maxRecordsPerProvince?: number;
  } = {},
): Promise<Record<string, ProvincialLegislatureRecord[]>> {
  const provinces = options.provinces ?? IMPLEMENTED_PROVINCES.map((p) => p.province);
  const maxRecordsPerProvince = options.maxRecordsPerProvince ?? 500;

  const result: Record<string, ProvincialLegislatureRecord[]> = {};

  for (const province of provinces) {
    try {
      result[province] = await fetchProvincialHansard(province, {
        recordTypes: options.recordTypes,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        maxRecords: maxRecordsPerProvince,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ProvLeg Fetcher] ${province}: ${msg}`);
      result[province] = [];
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Ontario Fetcher                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch Ontario legislative data (Hansard, committees, bills).
 *
 * Ontario has the best API among provinces, providing:
 *   - XML Hansard transcripts per sitting
 *   - Committee evidence XML
 *   - Bills lists and status
 */
export async function fetchOntarioLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchOntarioHansard(options, maxRecords);
    case 'committee':
      return fetchOntarioCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchOntarioBills(maxRecords);
    default:
      return [];
  }
}

/**
 * Fetch Ontario Hansard transcripts list.
 * Uses the OLA Hansard listing page to discover available transcripts.
 */
export async function fetchOntarioHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    // Fetch the Hansard listing page
    const resp = await httpGet(ONTARIO.HANSARD_LIST_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Ontario Hansard list returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'ON',
        ONTARIO.HANSARD_LIST_URL,
        resp.statusCode,
      );
    }

    // Parse the HTML to find transcript links
    // Ontario Hansard pages have links like: /en/legislative-business/hansard/{parliament}/{session}/{date}
    const transcriptLinks = extractTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`on-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'ON',
        recordType: 'hansard',
        chamber: 'legislative-assembly',
        sittingDate: link.date,
        hansardUrl: link.url,
        topic: link.title ?? null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: null,
        billReference: null,
        billNumber: null,
        billTitle: null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: link.url,
        sourceRecordId: null,
        sourceSystem: 'ola-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Ontario Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'ON',
      ONTARIO.HANSARD_LIST_URL,
    );
  }

  return records;
}

/**
 * Fetch Ontario committee hearings.
 * Uses the OLA committee pages to discover committee meetings and evidence.
 */
export async function fetchOntarioCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(ONTARIO.COMMITTEE_EVIDENCE_XML_PATTERN
      .replace('{committee}', 'standing')
      .replace('{date}', new Date().toISOString().substring(0, 10)), {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // Ontario committee data — currently implemented as a stub that
    // can be extended when specific committee endpoints are known.
    // The OLA committee pages contain links to evidence transcripts.
    // For now, return empty array (the structure is ready when endpoints are configured).
    return [];
  } catch {
    // If the committee endpoint is not available, return empty
    return [];
  }
}

/**
 * Fetch Ontario bills.
 * Uses the OLA bills listing page.
 */
export async function fetchOntarioBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(ONTARIO.BILLS_LIST_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      return [];
    }

    // Parse bill entries from the listing page
    const billEntries = extractBillEntries(resp.body);

    for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
      const bill = billEntries[i];
      const id = await computeHash(`on-bill-${bill.number}-${bill.title}`, 'sha256');

      records.push({
        id,
        province: 'ON',
        recordType: 'bill',
        chamber: 'legislative-assembly',
        sittingDate: bill.date ?? null,
        hansardUrl: null,
        topic: bill.title ?? null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: null,
        billReference: bill.number,
        billNumber: bill.number,
        billTitle: bill.title ?? null,
        billStatus: bill.status ?? null,
        billDate: bill.date ?? null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: bill.url,
        sourceRecordId: bill.number,
        sourceSystem: 'ola-bills-html',
        ingestedAt: now,
      });
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  BC Fetcher                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch BC Legislative Assembly data.
 */
export async function fetchBCLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchBCHansard(options, maxRecords);
    case 'committee':
      return fetchBCCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchBCBills(maxRecords);
    default:
      return [];
  }
}

/**
 * Fetch BC Hansard transcripts.
 * BC publishes XML Hansard documents via their data portal.
 */
export async function fetchBCHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(BC.HANSARD_BASE_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `BC Hansard list returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'BC',
        BC.HANSARD_BASE_URL,
        resp.statusCode,
      );
    }

    // Parse Hansard links from BC Legislature page
    const transcriptLinks = extractBCTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`bc-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'BC',
        recordType: 'hansard',
        chamber: 'legislative-assembly',
        sittingDate: link.date,
        hansardUrl: link.url,
        topic: link.title ?? null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: null,
        billReference: null,
        billNumber: null,
        billTitle: null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: link.url,
        sourceRecordId: null,
        sourceSystem: 'bcleg-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch BC Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'BC',
      BC.HANSARD_BASE_URL,
    );
  }

  return records;
}

/**
 * Fetch BC committee hearings (stub — committee data available as HTML pages).
 */
export async function fetchBCCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  // BC committees are published as HTML pages. Implementation pending
  // specific page structure analysis.
  return [];
}

/**
 * Fetch BC bills (stub — bill data available as HTML/PDF).
 */
export async function fetchBCBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  // BC bills are published as PDF documents. Implementation pending
  // structured data source identification.
  return [];
}

/* ------------------------------------------------------------------ */
/*  Alberta Fetcher                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch Alberta Legislative Assembly data.
 */
export async function fetchAlbertaLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchAlbertaHansard(options, maxRecords);
    case 'committee':
      return fetchAlbertaCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchAlbertaBills(maxRecords);
    default:
      return [];
  }
}

/**
 * Fetch Alberta Hansard transcripts.
 * Alberta publishes Hansard as HTML via their speech viewer.
 */
export async function fetchAlbertaHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(ALBERTA.HANSARD_SEARCH_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Alberta Hansard search returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'AB',
        ALBERTA.HANSARD_SEARCH_URL,
        resp.statusCode,
      );
    }

    // Parse Hansard entries from Alberta Assembly search page
    const transcriptEntries = extractAlbertaTranscriptEntries(resp.body);

    for (let i = 0; i < Math.min(transcriptEntries.length, maxRecords); i++) {
      const entry = transcriptEntries[i];
      const id = await computeHash(`ab-hansard-${entry.url}-${entry.date}`, 'sha256');

      records.push({
        id,
        province: 'AB',
        recordType: 'hansard',
        chamber: 'legislative-assembly',
        sittingDate: entry.date,
        hansardUrl: entry.url,
        topic: entry.title ?? null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: null,
        billReference: null,
        billNumber: null,
        billTitle: null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: entry.url,
        sourceRecordId: null,
        sourceSystem: 'assembly-ab-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Alberta Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'AB',
      ALBERTA.HANSARD_SEARCH_URL,
    );
  }

  return records;
}

/**
 * Fetch Alberta committee hearings (stub — committee data available as HTML pages).
 */
export async function fetchAlbertaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  // Alberta committees are published as HTML. Implementation pending
  // specific session/committee URL structure analysis.
  return [];
}

/**
 * Fetch Alberta bills (stub — bill data available as HTML/PDF).
 */
export async function fetchAlbertaBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  // Alberta bills are published as HTML/PDF. Implementation pending
  // structured data source identification.
  return [];
}

/* ------------------------------------------------------------------ */
/*  Generic Province Stubs                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch legislative data for provinces without dedicated implementations.
 * Returns an empty array — these are placeholders for future work.
 */
export async function fetchGenericProvinceData(
  config: ProvinceLegislatureConfig,
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  // Placeholder: provinces without dedicated fetchers return nothing
  return [];
}

/* ------------------------------------------------------------------ */
/*  HTML Parsing Helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Extract Hansard transcript links from Ontario OLA HTML pages.
 * Looks for anchor tags with Hansard transcript URLs in the listing page.
 */
export interface TranscriptLink {
  url: string;
  date: string;
  title: string | null;
}

function extractTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match Ontario Hansard transcript URLs
  // Pattern: /en/legislative-business/hansard/{parliament}/{session}/{date}
  const pattern = /href="(\/en\/legislative-business\/hansard\/[^"]+\/(\d{4}-\d{2}-\d{2}))"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const fullUrl = match[1];
    const date = match[2];
    const url = `https://www.ola.org${fullUrl}`;

    // Avoid duplicates
    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  return links;
}

/**
 * Extract BC Hansard transcript links from leg.bc.ca pages.
 */
function extractBCTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match BC Hansard URLs
  // Pattern: /documents-data/hansard/parliament-{n}/session-{n}/{date}
  const pattern = /href="(\/documents-data\/hansard\/[^"]+?\/(\d{4}-\d{2}-\d{2})[^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.leg.bc.ca${match[1]}`;
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  return links;
}

/**
 * Extract Alberta Hansard transcript entries from the assembly.ab.ca search page.
 */
function extractAlbertaTranscriptEntries(html: string): TranscriptLink[] {
  const entries: TranscriptLink[] = [];

  // Match Alberta Hansard links — the assembly site uses various patterns
  // for its speech viewer and transcript pages
  const pattern = /href="(\/net\/speech\.aspx[^"]*?&?date=(\d{4}-\d{2}-\d{2})[^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.assembly.ab.ca${match[1]}`;
    const date = match[2];

    if (!entries.some((e) => e.url === url)) {
      entries.push({ url, date, title: null });
    }
  }

  return entries;
}

/**
 * Extract bill entries from Ontario OLA bills listing page.
 */
export interface BillEntry {
  number: string;
  title: string | null;
  status: string | null;
  date: string | null;
  url: string;
}

function extractBillEntries(html: string): BillEntry[] {
  const bills: BillEntry[] = [];

  // Match Ontario bill links
  // Pattern: /en/legislative-business/bills/{parliament}/{session}/bill-{number}
  const pattern = /href="(\/en\/legislative-business\/bills\/[^"]+?\/bill-\d+)"/g;
  const seenUrls = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.ola.org${match[1]}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    // Extract bill number from URL
    const billNumMatch = url.match(/bill-(\d+)/i);
    const billNumber = billNumMatch ? `Bill ${billNumMatch[1]}` : 'Unknown';

    bills.push({
      number: billNumber,
      title: null,
      status: null,
      date: null,
      url,
    });
  }

  return bills;
}
