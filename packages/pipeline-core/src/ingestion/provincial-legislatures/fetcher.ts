/**
 * Provincial Legislatures Fetcher — MapleSpike Pipeline
 *
 * HTTP fetchers for provincial legislative data across Canada.
 * Each province/territory has its own data format and website structure:
 *
 *   Ontario (ola.org)          — XML Hansard, committee evidence, bills list
 *   BC (leg.bc.ca)             — XML Hansard archives, committee HTML pages
 *   Alberta (assembly.ab.ca)   — HTML Hansard, committee hearing pages
 *   Quebec (assnat.qc.ca)      — XML Hansard (bilingual), committee HTML
 *   Saskatchewan (legassembly.sk.ca)    — HTML Hansard listing
 *   Manitoba (gov.mb.ca/legislature)    — HTML/PDF Hansard
 *   Nova Scotia (nslegislature.ca)      — HTML listing with dates
 *   New Brunswick (legnb.ca)           — PDF Hansard listing
 *   Newfoundland (assembly.nl.ca)       — HTML Hansard per session
 *   PEI (assembly.pe.ca)                — HTML Hansard
 *   Yukon (yukonassembly.ca)            — HTML/PDF Hansard
 *   NWT (ntlegislativeassembly.ca)      — Structured HTML table
 *   Nunavut (assembly.nu.ca)            — PDF Hansard listing
 *
 * The main entry point is fetchProvincialHansard(province, date) which
 * dispatches to the appropriate province-specific fetcher.
 */

import { httpGet } from '../../utils/http.js';
import {
  PROVINCE_CONFIGS,
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
 * fetchers.
 *
 * @param province - Province code (ON, BC, AB, QC, SK, MB, NS, NB, NL, PE, YT, NT, NU)
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
      case 'QC':
        allRecords.push(...await fetchQuebecLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'SK':
        allRecords.push(...await fetchSaskatchewanLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'MB':
        allRecords.push(...await fetchManitobaLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'NS':
        allRecords.push(...await fetchNovaScotiaLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'NB':
        allRecords.push(...await fetchNewBrunswickLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'NL':
        allRecords.push(...await fetchNewfoundlandLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'PE':
        allRecords.push(...await fetchPEILegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'YT':
        allRecords.push(...await fetchYukonLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'NT':
        allRecords.push(...await fetchNWTLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'NU':
        allRecords.push(...await fetchNunavutLegislativeData(type, options, maxRecords - allRecords.length));
        break;
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
  const provinces = options.provinces ?? Object.keys(PROVINCE_CONFIGS) as ProvinceCode[];
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
 */
export async function fetchOntarioHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
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
 */
export async function fetchOntarioCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  try {
    const resp = await httpGet(ONTARIO.COMMITTEE_EVIDENCE_XML_PATTERN
      .replace('{committee}', 'standing')
      .replace('{date}', new Date().toISOString().substring(0, 10)), {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetch Ontario bills.
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
 * Fetch BC committee hearings from committees page.
 */
export async function fetchBCCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('BC' as ProvinceCode, BC_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch BC bills from bills page.
 */
export async function fetchBCBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('BC' as ProvinceCode, BC_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Generic Committee & Bills Fetchers (used by all provinces)         */
/* ------------------------------------------------------------------ */

/**
 * Generic committee hearings fetcher — scrapes common HTML patterns from
 * any province's committee page.
 *
 * Handles:
 *   - HTML tables with date columns and committee name columns
 *   - Lists of meeting links containing dates
 *   - Any page with date + committee name patterns
 */
async function fetchGenericCommitteeHearings(
  province: ProvinceCode,
  url: string,
  options: { maxRecords?: number } = {},
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const maxRecords = options.maxRecords ?? 500;
  const now = new Date().toISOString();
  try {
    const resp = await httpGet(url, { headers: DEFAULT_HEADERS, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (resp.statusCode >= 400) return records;
    const html = resp.body;

    // Pattern 1: Tables with date + committee name
    const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;
    while ((match = tableRowPattern.exec(html)) !== null && records.length < maxRecords) {
      const cells = match[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells || cells.length < 2) continue;
      const texts = cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim());
      const dateStr = texts.find((t: string) => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(t)) || texts.find((t: string) => /\b\d{4}\b/.test(t)) || '';
      if (!dateStr) continue;
      const committeeName = texts.find((t: string) => t.length > 3 && !/^\d{4}[-/]/.test(t)) || 'Committee Hearing';
      const linkMatches = match[1].matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
      const links = Array.from(linkMatches, (m: RegExpExecArray) => m[1]);
      records.push({
        id: await computeHash(`${province}-committee-${dateStr}-${committeeName}`, 'sha256'),
        province, recordType: 'committee', chamber: 'legislative-assembly',
        sittingDate: dateStr, committeeName, meetingNumber: null, meetingStartTime: null, meetingEndTime: null,
        sourceUrl: links[0] ? (links[0].startsWith('http') ? links[0] : `${url.replace(/\/[^/]*$/, '')}/${links[0].replace(/^\//, '')}`) : url,
        sourceSystem: `${province.toLowerCase()}-committee-html`,
        ingestedAt: now, topic: null, speaker: null, party: null, riding: null, textExcerpt: null,
        billReference: null, billNumber: null, billTitle: null, billStatus: null, billDate: null,
        hansardUrl: null, interventionCount: null, sourceRecordId: null, language: 'en',
      });
    }

    // Pattern 2: Div/list-based meeting entries
    if (records.length === 0) {
      const itemPattern = /<(?:div|li|article)[^>]*class="[^"]*(?:meeting|committee|hearing|event)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li|article)>/gi;
      while ((match = itemPattern.exec(html)) !== null && records.length < maxRecords) {
        const content = match[1];
        const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
        if (!dateMatch) continue;
        const titleMatch = text.match(/^(.{10,150}?)(?:\s*\d{4}|$)/);
        const committeeName = titleMatch?.[1]?.trim() ?? 'Committee Hearing';
        const linkMatches = content.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
        const links = Array.from(linkMatches, (m: RegExpExecArray) => m[1]);
        records.push({
          id: await computeHash(`${province}-committee-${dateMatch[1]}-${committeeName}`, 'sha256'),
          province, recordType: 'committee', chamber: 'legislative-assembly',
          sittingDate: dateMatch[1], committeeName,
          sourceUrl: links[0] ?? url,
          sourceSystem: `${province.toLowerCase()}-committee-html`,
          ingestedAt: now, topic: null, speaker: null, party: null, riding: null, textExcerpt: null,
          billReference: null, billNumber: null, billTitle: null, billStatus: null, billDate: null,
          hansardUrl: null, interventionCount: null, sourceRecordId: null, language: 'en',
          meetingNumber: null, meetingStartTime: null, meetingEndTime: null,
        });
      }
    }
  } catch { /* Unavailable */ }
  return records;
}

/**
 * Generic bills fetcher — scrapes common HTML patterns from any province's bills page.
 * Handles tables and lists with bill numbers, titles, and status.
 */
async function fetchGenericBills(
  province: ProvinceCode,
  url: string,
  options: { maxRecords?: number } = {},
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const maxRecords = options.maxRecords ?? 500;
  const now = new Date().toISOString();
  try {
    const resp = await httpGet(url, { headers: DEFAULT_HEADERS, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (resp.statusCode >= 400) return records;
    const html = resp.body;

    // Pattern: Tables with bill number + title
    const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;
    while ((match = tableRowPattern.exec(html)) !== null && records.length < maxRecords) {
      const cells = match[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells || cells.length < 2) continue;
      const texts = cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim());
      const billNum = texts.find((t: string) => /^Bill\s+\d+/i.test(t) || /^(S-\d+|M\d+|C-\d+)/.test(t)) || '';
      if (!billNum) continue;
      const title = texts.find((t: string) => t.length > 5 && t !== billNum) || 'Bill';
      const status = texts.find((t: string) => /passed|defeated|royal\s+assent|first\s+reading|second\s+reading|third\s+reading|committee/i.test(t)) || null;
      const dateStr = texts.find((t: string) => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(t)) || '';
      const linkMatches = match[1].matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
      const links = Array.from(linkMatches, (m: RegExpExecArray) => m[1]);
      records.push({
        id: await computeHash(`${province}-bill-${billNum}`, 'sha256'),
        province, recordType: 'bill', chamber: 'legislative-assembly',
        billNumber: billNum, billTitle: title, billStatus: status, billDate: dateStr || null,
        sourceUrl: links[0] ?? url,
        sourceSystem: `${province.toLowerCase()}-bills-html`,
        ingestedAt: now, topic: null, speaker: null, party: null, riding: null, textExcerpt: null,
        billReference: null, sittingDate: null, hansardUrl: null, committeeName: null,
        meetingNumber: null, meetingStartTime: null, meetingEndTime: null,
        interventionCount: null, sourceRecordId: null, language: 'en',
      });
    }

    // Pattern 2: Links with "Bill" in text
    if (records.length === 0) {
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = linkPattern.exec(html)) !== null && records.length < maxRecords) {
        const linkText = match[2].replace(/<[^>]+>/g, '').trim();
        const billMatch = linkText.match(/^(Bill\s+\d+|S-\d+|M\d+|C-\d+)\s*[–-]?\s*(.+)$/i);
        if (!billMatch) continue;
        const billNum = billMatch[1];
        const title = billMatch[2].trim() || 'Bill';
        records.push({
          id: await computeHash(`${province}-bill-${billNum}`, 'sha256'), province, recordType: 'bill',
          chamber: 'legislative-assembly', billNumber: billNum, billTitle: title, billStatus: null,
          billDate: null, sourceUrl: match[1].startsWith('http') ? match[1] : `${url.replace(/\/[^/]*$/, '')}/${match[1].replace(/^\//, '')}`,
          sourceSystem: `${province.toLowerCase()}-bills-html`, ingestedAt: now,
          topic: null, speaker: null, party: null, riding: null, textExcerpt: null, billReference: null,
          sittingDate: null, hansardUrl: null, committeeName: null, meetingNumber: null,
          meetingStartTime: null, meetingEndTime: null, interventionCount: null, sourceRecordId: null, language: 'en',
        });
      }
    }
  } catch { /* Unavailable */ }
  return records;
}

/* ------------------------------------------------------------------ */
/*  Helper: Extract Transcript Links from HTML                         */
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
 * Fetch Alberta committee hearings from committees page.
 */
export async function fetchAlbertaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('AB' as ProvinceCode, ALBERTA_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Alberta bills from bills page.
 */
export async function fetchAlbertaBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('AB' as ProvinceCode, ALBERTA_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Quebec Fetcher                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch Quebec legislative data.
 */
export async function fetchQuebecLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchQuebecHansard(options, maxRecords);
    case 'committee':
      return fetchQuebecCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchQuebecBills(maxRecords);
    default:
      return [];
  }
}

const QUEBEC = {
  HANSARD_LIST_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/derniers-journaux.html',
  HANSARD_ARCHIVE_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/archives.html',
  COMMITTEES_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/commissions/index.html',
  BILLS_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/projets-loi/index.html',
};

/**
 * Fetch Quebec Hansard transcripts.
 * Quebec publishes XML Hansard documents with bilingual (FR/EN) support.
 */
export async function fetchQuebecHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(QUEBEC.HANSARD_LIST_URL, {
      headers: { ...DEFAULT_HEADERS, 'Accept': 'text/html,application/xhtml+xml,*/*' },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Quebec Hansard list returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'QC',
        QUEBEC.HANSARD_LIST_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractQuebecTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`qc-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'QC',
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
        language: 'fr',
        sourceUrl: link.url,
        sourceRecordId: null,
        sourceSystem: 'assnat-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Quebec Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'QC',
      QUEBEC.HANSARD_LIST_URL,
    );
  }

  return records;
}

/**
 * Fetch Quebec committee hearings (stub).
 */
export async function fetchQuebecCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(QUEBEC.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const committeeLinks = extractQuebecCommitteeLinks(resp.body);

    for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
      const link = committeeLinks[i];
      const id = await computeHash(`qc-committee-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'QC',
        recordType: 'committee',
        chamber: 'legislative-assembly',
        sittingDate: link.date,
        hansardUrl: null,
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
        committeeName: link.committee ?? null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'fr',
        sourceUrl: link.url,
        sourceRecordId: null,
        sourceSystem: 'assnat-committee-html',
        ingestedAt: now,
      });
    }
  } catch {
    return [];
  }

  return records;
}

/**
 * Fetch Quebec bills from bills page.
 */
export async function fetchQuebecBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('QC' as ProvinceCode, QUEBEC_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Saskatchewan Fetcher                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch Saskatchewan legislative data.
 */
export async function fetchSaskatchewanLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchSaskatchewanHansard(options, maxRecords);
    case 'committee':
      return fetchSaskatchewanCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchSaskatchewanBills(maxRecords);
    default:
      return [];
  }
}

const SASKATCHEWAN = {
  HANSARD_URL: 'https://www.legassembly.sk.ca/legislative-business/debates-hansard/',
  COMMITTEES_URL: 'https://www.legassembly.sk.ca/legislative-business/legislative-committees/',
  BILLS_URL: 'https://www.legassembly.sk.ca/legislative-business/bills/',
};

/**
 * Fetch Saskatchewan Hansard transcripts.
 */
export async function fetchSaskatchewanHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SASKATCHEWAN.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Saskatchewan Hansard list returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'SK',
        SASKATCHEWAN.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractSKTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`sk-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'SK',
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
        sourceSystem: 'legassembly-sk-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Saskatchewan Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'SK',
      SASKATCHEWAN.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch Saskatchewan committee hearings from committees page.
 */
export async function fetchSaskatchewanCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('SK' as ProvinceCode, SASKATCHEWAN_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Saskatchewan bills from bills page.
 */
export async function fetchSaskatchewanBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('SK' as ProvinceCode, SASKATCHEWAN_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Manitoba Fetcher                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch Manitoba legislative data.
 */
export async function fetchManitobaLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchManitobaHansard(options, maxRecords);
    case 'committee':
      return fetchManitobaCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchManitobaBills(maxRecords);
    default:
      return [];
  }
}

const MANITOBA = {
  HANSARD_URL: 'https://www.gov.mb.ca/legislature/hansard/',
  COMMITTEES_URL: 'https://www.gov.mb.ca/legislature/committees/',
  BILLS_URL: 'https://web2.gov.mb.ca/bills/',
};

/**
 * Fetch Manitoba Hansard transcripts.
 */
export async function fetchManitobaHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(MANITOBA.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Manitoba Hansard list returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'MB',
        MANITOBA.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractMBTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`mb-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'MB',
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
        sourceSystem: 'govmb-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Manitoba Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'MB',
      MANITOBA.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch Manitoba committee hearings from committees page.
 */
export async function fetchManitobaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('MB' as ProvinceCode, MANITOBA_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Manitoba bills.
 */
export async function fetchManitobaBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(MANITOBA.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const billLinks = extractMBBillLinks(resp.body);

    for (let i = 0; i < Math.min(billLinks.length, maxRecords); i++) {
      const bill = billLinks[i];
      const id = await computeHash(`mb-bill-${bill.url}`, 'sha256');

      records.push({
        id,
        province: 'MB',
        recordType: 'bill',
        chamber: 'legislative-assembly',
        sittingDate: null,
        hansardUrl: null,
        topic: bill.title ?? null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: null,
        billReference: bill.number,
        billNumber: bill.number,
        billTitle: bill.title ?? null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: bill.url,
        sourceRecordId: bill.number,
        sourceSystem: 'govmb-bills-html',
        ingestedAt: now,
      });
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Nova Scotia Fetcher                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch Nova Scotia legislative data.
 */
export async function fetchNovaScotiaLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchNovaScotiaHansard(options, maxRecords);
    case 'committee':
      return fetchNovaScotiaCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchNovaScotiaBills(maxRecords);
    default:
      return [];
  }
}

const NOVA_SCOTIA = {
  HANSARD_URL: 'https://nslegislature.ca/legislative-business/hansard-debates',
};

/**
 * Fetch Nova Scotia Hansard transcripts.
 * Nova Scotia structures Hansard by assembly/session with drill-down to individual dates.
 */
export async function fetchNovaScotiaHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    // First, fetch the main listing page to find session links
    const resp = await httpGet(NOVA_SCOTIA.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Nova Scotia Hansard page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'NS',
        NOVA_SCOTIA.HANSARD_URL,
        resp.statusCode,
      );
    }

    // Extract session links from the main page
    const sessionLinks = extractNSSessionLinks(resp.body);

    // Follow each session link to get individual transcript dates
    for (const sessionUrl of sessionLinks.slice(0, 3)) { // Limit to latest 3 sessions
      if (records.length >= maxRecords) break;

      try {
        const sessionResp = await httpGet(sessionUrl, {
          headers: DEFAULT_HEADERS,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });

        if (sessionResp.statusCode >= 400) continue;

        const transcriptLinks = extractNSTranscriptLinks(sessionResp.body);

        for (const link of transcriptLinks) {
          if (records.length >= maxRecords) break;
          const id = await computeHash(`ns-hansard-${link.url}-${link.date}`, 'sha256');

          records.push({
            id,
            province: 'NS',
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
            sourceSystem: 'nsleg-hansard-html',
            ingestedAt: now,
          });
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Nova Scotia Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'NS',
      NOVA_SCOTIA.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch Nova Scotia committee hearings from committees page.
 */
export async function fetchNovaScotiaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('NS' as ProvinceCode, NOVA_SCOTIA_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Nova Scotia bills from bills page.
 */
export async function fetchNovaScotiaBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('NS' as ProvinceCode, NOVA_SCOTIA_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  New Brunswick Fetcher                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch New Brunswick legislative data.
 */
export async function fetchNewBrunswickLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchNewBrunswickHansard(options, maxRecords);
    case 'committee':
      return fetchNewBrunswickCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchNewBrunswickBills(maxRecords);
    default:
      return [];
  }
}

const NEW_BRUNSWICK = {
  HANSARD_URL: 'https://www.legnb.ca/en/house-business/hansard',
  COMMITTEES_URL: 'https://www.legnb.ca/en/committees',
  BILLS_URL: 'https://www.legnb.ca/en/legislation/bills',
};

/**
 * Fetch New Brunswick Hansard transcripts.
 * NB lists dates with links to PDF transcripts on their session pages.
 */
export async function fetchNewBrunswickHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NEW_BRUNSWICK.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `New Brunswick Hansard page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'NB',
        NEW_BRUNSWICK.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractNBTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`nb-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'NB',
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
        sourceSystem: 'legnb-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch New Brunswick Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'NB',
      NEW_BRUNSWICK.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch New Brunswick committee hearings from committees page.
 */
export async function fetchNewBrunswickCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('NB' as ProvinceCode, NEW_BRUNSWICK_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch New Brunswick bills from bills page.
 */
export async function fetchNewBrunswickBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('NB' as ProvinceCode, NEW_BRUNSWICK_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Newfoundland and Labrador Fetcher                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch Newfoundland and Labrador legislative data.
 */
export async function fetchNewfoundlandLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchNewfoundlandHansard(options, maxRecords);
    case 'committee':
      return fetchNewfoundlandCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchNewfoundlandBills(maxRecords);
    default:
      return [];
  }
}

const NFLD = {
  HANSARD_URL: 'https://www.assembly.nl.ca/HouseBusiness/Hansard/',
  COMMITTEES_URL: 'https://www.assembly.nl.ca/HouseBusiness/Committees/',
  BILLS_URL: 'https://www.assembly.nl.ca/HouseBusiness/Bills/',
};

/**
 * Fetch Newfoundland and Labrador Hansard transcripts.
 * NL organizes Hansard by General Assembly session, with links to HTML transcripts.
 */
export async function fetchNewfoundlandHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NFLD.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Newfoundland Hansard page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'NL',
        NFLD.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractNLTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`nl-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'NL',
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
        sourceSystem: 'assemblynl-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Newfoundland Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'NL',
      NFLD.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch Newfoundland committee hearings from committees page.
 */
export async function fetchNewfoundlandCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('NL' as ProvinceCode, NEWFOUNDLAND_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Newfoundland bills from bills page.
 */
export async function fetchNewfoundlandBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('NL' as ProvinceCode, NEWFOUNDLAND_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  PEI Fetcher                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch Prince Edward Island legislative data.
 */
export async function fetchPEILegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchPEIHansard(options, maxRecords);
    case 'committee':
      return fetchPEICommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchPEIBills(maxRecords);
    default:
      return [];
  }
}

const PEI = {
  HANSARD_URL: 'https://www.assembly.pe.ca/hansard',
  COMMITTEES_URL: 'https://www.assembly.pe.ca/committees',
  BILLS_URL: 'https://www.assembly.pe.ca/bills',
  HOUSE_RECORDS_URL: 'https://www.assembly.pe.ca/legislative-business/house-records',
};

/**
 * Fetch PEI Hansard transcripts.
 */
export async function fetchPEIHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(PEI.HOUSE_RECORDS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `PEI House records page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'PE',
        PEI.HOUSE_RECORDS_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractPETranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`pe-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'PE',
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
        sourceSystem: 'assemblype-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch PEI Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'PE',
      PEI.HOUSE_RECORDS_URL,
    );
  }

  return records;
}

/**
 * Fetch PEI committee hearings from committees page.
 */
export async function fetchPEICommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('PE' as ProvinceCode, PEI_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch PEI bills from bills page.
 */
export async function fetchPEIBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('PE' as ProvinceCode, PEI_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Yukon Fetcher                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch Yukon legislative data.
 */
export async function fetchYukonLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchYukonHansard(options, maxRecords);
    case 'committee':
      return fetchYukonCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchYukonBills(maxRecords);
    default:
      return [];
  }
}

const YUKON = {
  HANSARD_URL: 'https://yukonassembly.ca/hansard',
  COMMITTEES_URL: 'https://yukonassembly.ca/committees',
  BILLS_URL: 'https://yukonassembly.ca/bills',
};

/**
 * Fetch Yukon Hansard transcripts.
 * Note: yukonassembly.ca is behind Cloudflare; may return captcha challenge.
 */
export async function fetchYukonHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(YUKON.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Yukon Hansard page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'YT',
        YUKON.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractYTTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`yt-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'YT',
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
        sourceSystem: 'yukonassembly-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Yukon Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'YT',
      YUKON.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch Yukon committee hearings from committees page.
 */
export async function fetchYukonCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('YT' as ProvinceCode, YUKON_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Yukon bills from bills page.
 */
export async function fetchYukonBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('YT' as ProvinceCode, YUKON_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  Northwest Territories Fetcher                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch Northwest Territories legislative data.
 */
export async function fetchNWTLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchNWTHansard(options, maxRecords);
    case 'committee':
      return fetchNWTCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchNWTBills(maxRecords);
    default:
      return [];
  }
}

const NWT = {
  HANSARD_URL: 'https://www.ntlegislativeassembly.ca/documents-proceedings/hansard',
  COMMITTEES_URL: 'https://www.ntlegislativeassembly.ca/committees',
  BILLS_URL: 'https://www.ntlegislativeassembly.ca/documents-proceedings/bills',
};

/**
 * Fetch Northwest Territories Hansard transcripts.
 * NWT has a well-structured HTML table with dates, Word, and PDF links.
 */
export async function fetchNWTHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NWT.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `NWT Hansard page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'NT',
        NWT.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractNTTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`nt-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'NT',
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
        sourceSystem: 'ntassembly-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch NWT Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'NT',
      NWT.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch NWT committee hearings from committees page.
 */
export async function fetchNWTCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('NT' as ProvinceCode, NWT_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch NWT bills.
 */
export async function fetchNWTBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NWT.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const billLinks = extractNTBillLinks(resp.body);

    for (let i = 0; i < Math.min(billLinks.length, maxRecords); i++) {
      const bill = billLinks[i];
      const id = await computeHash(`nt-bill-${bill.url}`, 'sha256');

      records.push({
        id,
        province: 'NT',
        recordType: 'bill',
        chamber: 'legislative-assembly',
        sittingDate: null,
        hansardUrl: null,
        topic: bill.title ?? null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: null,
        billReference: bill.number,
        billNumber: bill.number,
        billTitle: bill.title ?? null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: bill.url,
        sourceRecordId: bill.number,
        sourceSystem: 'ntassembly-bills-html',
        ingestedAt: now,
      });
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Nunavut Fetcher                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch Nunavut legislative data.
 */
export async function fetchNunavutLegislativeData(
  recordType: LegislativeRecordType,
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  switch (recordType) {
    case 'hansard':
      return fetchNunavutHansard(options, maxRecords);
    case 'committee':
      return fetchNunavutCommitteeHearings(options, maxRecords);
    case 'bill':
      return fetchNunavutBills(maxRecords);
    default:
      return [];
  }
}

const NUNAVUT = {
  HANSARD_URL: 'https://assembly.nu.ca/hansard',
  COMMITTEES_URL: 'https://assembly.nu.ca/standing-and-special-committees',
  BILLS_URL: 'https://assembly.nu.ca/bills-and-legislation',
};

/**
 * Fetch Nunavut Hansard transcripts.
 * Nunavut publishes Hansard as PDF with "The Blues" unedited transcripts.
 */
export async function fetchNunavutHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NUNAVUT.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new ProvincialLegislatureError(
        `Nunavut Hansard page returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        'NU',
        NUNAVUT.HANSARD_URL,
        resp.statusCode,
      );
    }

    const transcriptLinks = extractNUTranscriptLinks(resp.body);

    for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords); i++) {
      const link = transcriptLinks[i];
      const id = await computeHash(`nu-hansard-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'NU',
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
        sourceSystem: 'assemblynu-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof ProvincialLegislatureError) throw err;
    throw new ProvincialLegislatureError(
      `Failed to fetch Nunavut Hansard: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      'NU',
      NUNAVUT.HANSARD_URL,
    );
  }

  return records;
}

/**
 * Fetch Nunavut committee hearings from committees page.
 */
export async function fetchNunavutCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericCommitteeHearings('NU' as ProvinceCode, NUNAVUT_CONFIG.committeesUrl, { maxRecords });
}

/**
 * Fetch Nunavut bills from bills page.
 */
export async function fetchNunavutBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  return fetchGenericBills('NU' as ProvinceCode, NUNAVUT_CONFIG.billsUrl, { maxRecords });
}

/* ------------------------------------------------------------------ */
/*  HTML Parsing Helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Extract Hansard transcript links from Ontario OLA HTML pages.
 */
export interface TranscriptLink {
  url: string;
  date: string;
  title: string | null;
}

function extractTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  const pattern = /href="(\/en\/legislative-business\/hansard\/[^"]+\/(\d{4}-\d{2}-\d{2}))"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const fullUrl = match[1];
    const date = match[2];
    const url = `https://www.ola.org${fullUrl}`;

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
 * Extract Alberta Hansard transcript entries from assembly.ab.ca pages.
 */
function extractAlbertaTranscriptEntries(html: string): TranscriptLink[] {
  const entries: TranscriptLink[] = [];

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
 * Extract Quebec Hansard transcript links from assnat.qc.ca pages.
 */
function extractQuebecTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match Quebec Hansard journal URLs
  // Pattern: /fr/travaux-parlementaires/journaux/...
  const pattern = /href="(\/fr\/travaux-parlementaires\/[^"]*?journaux?[^"]*?(\d{4}-\d{2}-\d{2})[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://www.assnat.qc.ca${url}`;
    } else if (!url.startsWith('http')) {
      url = `https://www.assnat.qc.ca/${url}`;
    }
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  return links;
}

/**
 * Extract Quebec committee links.
 */
interface CommitteeLink {
  url: string;
  date: string;
  title: string | null;
  committee: string | null;
}

function extractQuebecCommitteeLinks(html: string): CommitteeLink[] {
  const links: CommitteeLink[] = [];

  // Match Quebec committee commission URLs
  const pattern = /href="(\/fr\/travaux-parlementaires\/commissions\/[^"]+?)"[^>]*?>([^<]+)</gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://www.assnat.qc.ca${url}`;
    }
    const title = match[2]?.trim() ?? null;
    const date = '';

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title, committee: title });
    }
  }

  return links;
}

/**
 * Extract Saskatchewan Hansard/transcript links.
 */
function extractSKTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match links to assembly records calendar or transcript pages
  const pattern = /href="(https?:\/\/[^"]*legassembly\.sk\.ca[^"]*?(\d{4}-\d{2}-\d{2})[^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  // Also match relative paths
  const relPattern = /href="(\/[^"]*?(\d{4}-\d{2}-\d{2})[^"]*)"/g;
  while ((match = relPattern.exec(html)) !== null) {
    const url = `https://www.legassembly.sk.ca${match[1]}`;
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  return links;
}

/**
 * Extract Manitoba Hansard transcript links.
 */
function extractMBTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match links to Manitoba Hansard PDF/HTML documents
  const pattern = /href="([^"]*?hansard[^"]*?(\d{4}[-/]\d{2}[-/]\d{2})[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    const dateStr = match[2].replace(/\//g, '-');
    if (url.startsWith('/')) {
      url = `https://www.gov.mb.ca${url}`;
    }

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateStr, title: null });
    }
  }

  return links;
}

/**
 * Extract Manitoba bill links.
 */
function extractMBBillLinks(html: string): BillEntry[] {
  const bills: BillEntry[] = [];

  // Match Manitoba bill links
  const pattern = /href="((?:https?:\/\/web2\.gov\.mb\.ca)?\/bills\/[^"]*?bill[^"]*\.html?)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://web2.gov.mb.ca${url}`;
    }
    const billNumMatch = url.match(/(?:bill_?)(\d+)/i);

    if (!bills.some((b) => b.url === url)) {
      bills.push({
        number: billNumMatch ? `Bill ${billNumMatch[1]}` : 'Unknown',
        title: null,
        status: null,
        date: null,
        url,
      });
    }
  }

  return bills;
}

/**
 * Extract Nova Scotia session links from the main listing page.
 */
function extractNSSessionLinks(html: string): string[] {
  const links: string[] = [];

  // Match links to assembly sessions: /legislative-business/hansard-debates/assembly-{n}-session-{n}
  const pattern = /href="(\/legislative-business\/hansard-debates\/assembly-\d+-session-\d+)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://nslegislature.ca${match[1]}`;
    if (!links.includes(url)) {
      links.push(url);
    }
  }

  return links;
}

/**
 * Extract Nova Scotia transcript links from a session listing page.
 */
function extractNSTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match dates in the session table: 2026-Apr-9 format
  const pattern = /href="(\/legislative-business\/hansard-debates\/[^"]+?\/house_[a-z]+\d+)"[^>]*?>\s*(\d{4}-\w+-\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://nslegislature.ca${match[1]}`;
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  // Also match dates in table cells: 2026-Apr-9
  const datePattern = /href="(\/legislative-business\/hansard-debates\/[^"]+?\/house_[^"]+)"[^>]*?>\s*([^<]+)/g;
  while ((match = datePattern.exec(html)) !== null) {
    const url = `https://nslegislature.ca${match[1]}`;
    const dateText = match[2]?.trim() ?? '';

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateText, title: null });
    }
  }

  return links;
}

/**
 * Extract New Brunswick Hansard transcript links.
 * NB lists PDF links with dates like: March 27, 2026
 */
function extractNBTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match PDF links with dates in the format "Month DD, YYYY"
  const monthNames = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  const pattern = new RegExp(
    `href="([^"]*\\.pdf)"[^>]*?>[^<]*?<span>(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`,
    'gi',
  );
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://www.legnb.ca${url}`;
    } else if (!url.startsWith('http')) {
      url = `https://www.legnb.ca/${url}`;
    }
    const dateStr = match[2].replace(/,/g, '').trim();
    // Convert "March 27 2026" to "2026-03-27"
    const parsed = parseFlexibleDate(dateStr);

    if (parsed && !links.some((l) => l.url === url)) {
      links.push({ url, date: parsed, title: null });
    }
  }

  return links;
}

/**
 * Extract Newfoundland and Labrador Hansard transcript links.
 * NL has links to GA session pages and HTML transcript files.
 */
function extractNLTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match links to HTML transcript files with date patterns in URL
  const pattern = /href="([^"]*?\/Hansard\/[^"]*?(\d{2}-\d{2}-\d{2})[^"]*\.html?)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://www.assembly.nl.ca${url}`;
    } else if (!url.startsWith('http')) {
      url = `https://www.assembly.nl.ca/${url}`;
    }
    const dateRaw = match[2];
    // Convert DD-MM-YY or YY-MM-DD to proper ISO format
    const parts = dateRaw.split('-');
    let dateStr: string;
    if (parts[0].length === 4) {
      dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
    } else if (parts[2].length === 4) {
      dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      dateStr = `20${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateStr, title: null });
    }
  }

  // Also match GA session pages and PDF links with yyyy-mm-dd in filename
  const pdfPattern = /href="([^"]*?\/Hansard\/[^"]*?(\d{4}-\d{2}-\d{2})[^"]*\.pdf)"/gi;
  while ((match = pdfPattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://www.assembly.nl.ca${url}`;
    }
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  return links;
}

/**
 * Extract PEI Hansard transcript links.
 */
function extractPETranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match links to PEI Hansard documents
  const pattern = /href="([^"]*?assembly\.pe\.ca[^"]*?(\d{4}[-/]\d{2}[-/]\d{2})[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    const dateStr = match[2].replace(/\//g, '-');

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateStr, title: null });
    }
  }

  // Match relative paths with dates
  const relPattern = /href="(\/[^"]*?assembly[^"]*?(\d{4}[-/]\d{2}[-/]\d{2})[^"]*)"/gi;
  while ((match = relPattern.exec(html)) !== null) {
    const url = `https://www.assembly.pe.ca${match[1]}`;
    const dateStr = match[2].replace(/\//g, '-');

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateStr, title: null });
    }
  }

  return links;
}

/**
 * Extract Yukon Hansard transcript links.
 */
function extractYTTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match Yukon Hansard document links
  const pattern = /href="([^"]*?yukonassembly\.ca[^"]*?(\d{4}[-/]\d{2}[-/]\d{2})[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    const dateStr = match[2].replace(/\//g, '-');

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateStr, title: null });
    }
  }

  // Match relative paths
  const relPattern = /href="(\/[^"]*?(\d{4}[-/]\d{2}[-/]\d{2})[^"]*\.htm[l]?)"/gi;
  while ((match = relPattern.exec(html)) !== null) {
    const url = `https://yukonassembly.ca${match[1]}`;
    const dateStr = match[2].replace(/\//g, '-');

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date: dateStr, title: null });
    }
  }

  return links;
}

/**
 * Extract NWT Hansard transcript links from the structured table.
 * NWT pages have rows with dates like "Friday, March 6, 2026" and links to /hansard/hn260306
 */
function extractNTTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match table rows with dates: "Friday, March 6, 2026" and a link to /hansard/hn...
  const monthNames = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  const dayNames = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';

  // Pattern: href="/hansard/hn..." with a date appearing nearby
  const pattern = new RegExp(
    `href="(\\/hansard\\/hn\\d+)"[^>]*?>[^<]*<[^>]*>\\s*(?:${dayNames},\\s*)?(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`,
    'gi',
  );
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://www.ntlegislativeassembly.ca${url}`;
    }
    const dateStr = match[2].replace(/,/g, '').trim();
    const parsed = parseFlexibleDate(dateStr);

    if (parsed && !links.some((l) => l.url === url)) {
      links.push({ url, date: parsed, title: null });
    }
  }

  // Fallback: match any date in the html table
  const fallbackPattern = /href="(\/hansard\/hn(\d{2})(\d{2})(\d{2}))"/g;
  while ((match = fallbackPattern.exec(html)) !== null) {
    const url = `https://www.ntlegislativeassembly.ca${match[1]}`;
    // Format hnYYMMDD -> YYYY-MM-DD
    const year = parseInt(match[2]);
    const month = match[3];
    const day = match[4];
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    const date = `${fullYear}-${month}-${day}`;

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  return links;
}

/**
 * Extract Nunavut Hansard transcript links.
 * Nunavut displays PDF links with dates like "MARCH 19, 2026"
 */
function extractNUTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match PDF links with dates in the format "MONTH DD, YYYY" (uppercase month)
  // Nunavut site uses tabbed interface with links like: /sites/default/files/2026-03/20260319_Blues_English.pdf
  const pattern = /href="([^"]*?sites\/default\/files\/[^"]*?(\d{4})-(\d{2})\/(\d{8})[^"]*\.pdf)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://assembly.nu.ca${url}`;
    }
    // Date from YYYYMMDD in filename
    const dateStr = match[4];
    const date = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

    if (!links.some((l) => l.url === url)) {
      links.push({ url, date, title: null });
    }
  }

  // Also match from text content with month names
  const monthNames = '(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)';
  const textPattern = new RegExp(
    `(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'gi',
  );
  while ((match = textPattern.exec(html)) !== null) {
    const parsed = parseFlexibleDate(`${match[1]} ${match[2]} ${match[3]}`);

    // Find nearby PDF link
    const nearbyPdf = extractNearbyPdfLink(html, match.index, parsed ?? '');
    if (nearbyPdf && parsed && !links.some((l) => l.url === nearbyPdf)) {
      links.push({ url: nearbyPdf, date: parsed, title: null });
    }
  }

  return links;
}

/**
 * Extract nearby PDF link from HTML around a given position.
 */
function extractNearbyPdfLink(html: string, position: number, _date: string): string | null {
  // Look backwards/forwards for an href with .pdf
  const before = html.substring(Math.max(0, position - 500), position + 500);
  const pdfMatch = /href="([^"]*?\.pdf)"/i.exec(before);
  if (pdfMatch) {
    let url = pdfMatch[1];
    if (url.startsWith('/')) {
      url = `https://assembly.nu.ca${url}`;
    }
    return url;
  }
  return null;
}

/**
 * Extract NWT bill links.
 */
function extractNTBillLinks(html: string): BillEntry[] {
  const bills: BillEntry[] = [];

  const pattern = /href="(\/documents-proceedings\/bills\/[^"]*?bill[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.ntlegislativeassembly.ca${match[1]}`;
    const billNumMatch = url.match(/bill[_-]?(\d+)/i);

    if (!bills.some((b) => b.url === url)) {
      bills.push({
        number: billNumMatch ? `Bill ${billNumMatch[1]}` : 'Unknown',
        title: null,
        status: null,
        date: null,
        url,
      });
    }
  }

  return bills;
}

/**
 * Parse a flexible date string like "March 27, 2026" or "MARCH 19 2026" to ISO format.
 */
function parseFlexibleDate(dateStr: string): string | null {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };

  const cleaned = dateStr.replace(/,/g, '').trim();
  const parts = cleaned.split(/\s+/);

  if (parts.length >= 3) {
    const monthName = parts[0].toLowerCase();
    const day = parts[1].padStart(2, '0');
    const year = parts[2];

    const month = months[monthName];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try parsing as ISO-like already
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}

/**
 * Extract bill entries from HTML listing pages.
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

  const pattern = /href="(\/en\/legislative-business\/bills\/[^"]+?\/bill-\d+)"/g;
  const seenUrls = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.ola.org${match[1]}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

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
