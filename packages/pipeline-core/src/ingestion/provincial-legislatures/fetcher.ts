// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Legislatures Fetcher — Quill
 *
 * HTTP fetchers for provincial legislative data across Canada.
 * Each province has its own data format and API approach:
 *
 *   Ontario (ola.org)    — Best API: XML Hansard, committee evidence, bills list
 *   BC (leg.bc.ca)       — XML Hansard archives, committee HTML pages
 *   Alberta (assembly.ab.ca) — HTML Hansard, committee hearing pages
 *   Quebec (assnat.qc.ca)    — XML Hansard (bilingual), committee HTML
 *   All 13 provinces/territories with real fetchers
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
  QUEBEC,
  MANITOBA,
  SASKATCHEWAN,
  NOVA_SCOTIA,
  NEW_BRUNSWICK,
  NFLD,
  PEI,
  YUKON,
  NWT,
  NUNAVUT,
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
      case 'QC':
        allRecords.push(...await fetchQuebecLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'MB':
        allRecords.push(...await fetchManitobaLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'NS':
        allRecords.push(...await fetchNovaScotiaLegislativeData(type, options, maxRecords - allRecords.length));
        break;
      case 'SK':
        allRecords.push(...await fetchSaskatchewanLegislativeData(type, options, maxRecords - allRecords.length));
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
    // Fetch the committees listing page
    const resp = await httpGet(ONTARIO.COMMITTEE_EVIDENCE_XML_PATTERN
      .replace('{committee}', 'standing')
      .replace('{date}', new Date().toISOString().substring(0, 10)), {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400 && resp.body.length > 0) {
      // Try to parse the XML response for committee evidence data
      const committeeEntries = extractCommitteeEntries(resp.body);

      for (let i = 0; i < Math.min(committeeEntries.length, maxRecords); i++) {
        const entry = committeeEntries[i];
        const id = await computeHash(`on-committee-${entry.url}-${entry.date}`, 'sha256');

        records.push({
          id,
          province: 'ON',
          recordType: 'committee',
          chamber: 'legislative-assembly',
          sittingDate: entry.date,
          hansardUrl: null,
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
          committeeName: entry.committeeName ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: entry.url,
          sourceRecordId: null,
          sourceSystem: 'ola-committee-html',
          ingestedAt: now,
        });
      }
    }

    // If we got records from the XML endpoint, return them
    if (records.length > 0) return records;

    // Fallback: fetch the main committees page for committee listing
    if (records.length < maxRecords) {
      const listingResp = await httpGet(ONTARIO.COMMITTEES_URL, {
        headers: DEFAULT_HEADERS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      if (listingResp.statusCode < 400) {
        const committeeLinks = extractOntarioCommitteeLinks(listingResp.body);

        for (let i = 0; i < Math.min(committeeLinks.length, maxRecords - records.length); i++) {
          const link = committeeLinks[i];
          const id = await computeHash(`on-committee-${link.url}-${link.date}`, 'sha256');

          records.push({
            id,
            province: 'ON',
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
            committeeName: link.title ?? null,
            meetingNumber: null,
            meetingStartTime: null,
            meetingEndTime: null,
            interventionCount: null,
            language: 'en',
            sourceUrl: link.url,
            sourceRecordId: null,
            sourceSystem: 'ola-committee-html',
            ingestedAt: now,
          });
        }
      }
    }
  } catch {
    // If the committee endpoint is not available, return what we have
  }

  return records;
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
 * Fetch BC committee hearings.
 * BC publishes committee schedules and transcripts via HTML pages.
 */
export async function fetchBCCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(BC.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const committeeLinks = extractBCCommitteeLinks(resp.body);

    for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
      const link = committeeLinks[i];
      const id = await computeHash(`bc-committee-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'BC',
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
        committeeName: link.title ?? null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: link.url,
        sourceRecordId: null,
        sourceSystem: 'bcleg-committee-html',
        ingestedAt: now,
      });
    }
  } catch {
    // Return what we have on error
  }

  return records;
}

/**
 * Fetch BC bills.
 * BC publishes bill information via HTML listing pages.
 */
export async function fetchBCBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(BC.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.leg.bc.ca');

    for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
      const bill = billEntries[i];
      const id = await computeHash(`bc-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

      records.push({
        id,
        province: 'BC',
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
        sourceSystem: 'bcleg-bills-html',
        ingestedAt: now,
      });
    }
  } catch {
    return [];
  }

  return records;
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
 * Fetch Alberta committee hearings.
 * Alberta publishes committee schedules and transcripts as HTML.
 */
export async function fetchAlbertaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(ALBERTA.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.assembly.ab.ca');

    for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
      const link = committeeLinks[i];
      const id = await computeHash(`ab-committee-${link.url}-${link.date}`, 'sha256');

      records.push({
        id,
        province: 'AB',
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
        committeeName: link.title ?? null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: link.url,
        sourceRecordId: null,
        sourceSystem: 'assembly-ab-committee-html',
        ingestedAt: now,
      });
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Alberta bills.
 * Alberta publishes bill information as HTML/PDF via their assembly site.
 */
export async function fetchAlbertaBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(ALBERTA.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.assembly.ab.ca');

    for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
      const bill = billEntries[i];
      const id = await computeHash(`ab-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

      records.push({
        id,
        province: 'AB',
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
        sourceSystem: 'assembly-ab-bills-html',
        ingestedAt: now,
      });
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Quebec Fetcher                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch Quebec National Assembly legislative data.
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

/**
 * Fetch Quebec Hansard transcripts.
 * Quebec publishes Hansard via assnat.qc.ca HTML pages (bilingual).
 */
export async function fetchQuebecHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    // Try CKAN search first
    const ckanRecords = await searchCkan(
      QUEBEC.CKAN_URL,
      'QC',
      'hansard',
      ['assnat', 'hansard', 'journal', 'debats'],
      maxRecords,
      now,
    );
    records.push(...ckanRecords);

    // Fallback: fetch the Hansard listing page
    if (records.length < maxRecords) {
      const resp = await httpGet(QUEBEC.HANSARD_LIST_URL, {
        headers: DEFAULT_HEADERS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      if (resp.statusCode < 400) {
        const transcriptLinks = extractQuebecTranscriptLinks(resp.body);

        for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords - records.length); i++) {
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
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Quebec committee hearings.
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

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.assnat.qc.ca');

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
          committeeName: link.title ?? null,
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
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Quebec bills.
 */
export async function fetchQuebecBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(QUEBEC.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.assnat.qc.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`qc-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'QC',
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
          language: 'fr',
          sourceUrl: bill.url,
          sourceRecordId: bill.number,
          sourceSystem: 'assnat-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Manitoba Fetcher                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch Manitoba Legislative Assembly data.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://www.gov.mb.ca');

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
          sourceSystem: 'mb-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Manitoba committee hearings.
 */
export async function fetchManitobaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(MANITOBA.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.gov.mb.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`mb-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'MB',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'mb-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
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

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://web2.gov.mb.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`mb-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'MB',
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
          sourceSystem: 'mb-bills-html',
          ingestedAt: now,
        });
      }
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
 * Fetch Nova Scotia House of Assembly data.
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

/**
 * Fetch Nova Scotia Hansard transcripts.
 */
export async function fetchNovaScotiaHansard(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const ckanRecords = await searchCkan(
      NOVA_SCOTIA.CKAN_URL,
      'NS',
      'hansard',
      ['nsleg', 'hansard', 'debates', 'legislature'],
      maxRecords,
      now,
    );
    records.push(...ckanRecords);

    if (records.length < maxRecords) {
      const resp = await httpGet(NOVA_SCOTIA.HANSARD_URL, {
        headers: DEFAULT_HEADERS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      if (resp.statusCode < 400) {
        const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://nslegislature.ca');

        for (let i = 0; i < Math.min(transcriptLinks.length, maxRecords - records.length); i++) {
          const link = transcriptLinks[i];
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
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Nova Scotia committee hearings.
 */
export async function fetchNovaScotiaCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NOVA_SCOTIA.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://nslegislature.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`ns-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'NS',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'nsleg-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Nova Scotia bills.
 */
export async function fetchNovaScotiaBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NOVA_SCOTIA.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://nslegislature.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`ns-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'NS',
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
          sourceSystem: 'nsleg-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Saskatchewan Fetcher                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch Saskatchewan Legislative Assembly data.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://www.legassembly.sk.ca');

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
          sourceSystem: 'sk-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Saskatchewan committee hearings.
 */
export async function fetchSaskatchewanCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SASKATCHEWAN.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.legassembly.sk.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`sk-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'SK',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'sk-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Saskatchewan bills.
 */
export async function fetchSaskatchewanBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SASKATCHEWAN.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://publications.saskatchewan.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`sk-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'SK',
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
          sourceSystem: 'sk-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  New Brunswick Fetcher                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch New Brunswick Legislative Assembly data.
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

/**
 * Fetch New Brunswick Hansard transcripts.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://www.legnb.ca');

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
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch New Brunswick committee hearings.
 */
export async function fetchNewBrunswickCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NEW_BRUNSWICK.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.legnb.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`nb-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'NB',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'legnb-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch New Brunswick bills.
 */
export async function fetchNewBrunswickBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NEW_BRUNSWICK.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.legnb.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`nb-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'NB',
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
          sourceSystem: 'legnb-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Newfoundland & Labrador Fetcher                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch Newfoundland and Labrador House of Assembly data.
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

/**
 * Fetch Newfoundland Hansard transcripts.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://www.assembly.nl.ca');

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
          sourceSystem: 'nl-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Newfoundland committee hearings.
 */
export async function fetchNewfoundlandCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NFLD.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.assembly.nl.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`nl-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'NL',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'nl-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Newfoundland bills.
 */
export async function fetchNewfoundlandBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NFLD.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.assembly.nl.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`nl-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'NL',
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
          sourceSystem: 'nl-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  PEI Fetcher                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch Prince Edward Island Legislative Assembly data.
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
    const resp = await httpGet(PEI.HANSARD_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://www.assembly.pe.ca');

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
          sourceSystem: 'pe-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch PEI committee hearings.
 */
export async function fetchPEICommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(PEI.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.assembly.pe.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`pe-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'PE',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'pe-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch PEI bills.
 */
export async function fetchPEIBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(PEI.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.assembly.pe.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`pe-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'PE',
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
          sourceSystem: 'pe-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Yukon Fetcher                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch Yukon Legislative Assembly data.
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

/**
 * Fetch Yukon Hansard transcripts.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://yukonassembly.ca');

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
          sourceSystem: 'yk-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Yukon committee hearings.
 */
export async function fetchYukonCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(YUKON.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://yukonassembly.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`yt-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'YT',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'yk-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Yukon bills.
 */
export async function fetchYukonBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(YUKON.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://yukonassembly.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`yt-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'YT',
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
          sourceSystem: 'yk-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  NWT Fetcher                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch Northwest Territories Legislative Assembly data.
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

/**
 * Fetch NWT Hansard transcripts.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://www.ntlegislativeassembly.ca');

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
          sourceSystem: 'nt-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch NWT committee hearings.
 */
export async function fetchNWTCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NWT.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://www.ntlegislativeassembly.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`nt-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'NT',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'nt-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
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

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://www.ntlegislativeassembly.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`nt-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'NT',
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
          sourceSystem: 'nt-bills-html',
          ingestedAt: now,
        });
      }
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
 * Fetch Nunavut Legislative Assembly data.
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

/**
 * Fetch Nunavut Hansard transcripts.
 * Nunavut publishes PDF transcripts at assembly.nu.ca/hansard.
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

    if (resp.statusCode < 400) {
      const transcriptLinks = extractGenericTranscriptLinks(resp.body, 'https://assembly.nu.ca');

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
          sourceSystem: 'nu-hansard-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Nunavut committee hearings.
 */
export async function fetchNunavutCommitteeHearings(
  options: { dateFrom?: string; dateTo?: string } = {},
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NUNAVUT.COMMITTEES_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const committeeLinks = extractGenericCommitteeLinks(resp.body, 'https://assembly.nu.ca');

      for (let i = 0; i < Math.min(committeeLinks.length, maxRecords); i++) {
        const link = committeeLinks[i];
        const id = await computeHash(`nu-committee-${link.url}-${link.date}`, 'sha256');

        records.push({
          id,
          province: 'NU',
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
          committeeName: link.title ?? null,
          meetingNumber: null,
          meetingStartTime: null,
          meetingEndTime: null,
          interventionCount: null,
          language: 'en',
          sourceUrl: link.url,
          sourceRecordId: null,
          sourceSystem: 'nu-committee-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    // Return what we have
  }

  return records;
}

/**
 * Fetch Nunavut bills.
 */
export async function fetchNunavutBills(
  maxRecords: number = 500,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(NUNAVUT.BILLS_URL, {
      headers: DEFAULT_HEADERS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const billEntries = extractBillEntriesGeneric(resp.body, 'https://assembly.nu.ca');

      for (let i = 0; i < Math.min(billEntries.length, maxRecords); i++) {
        const bill = billEntries[i];
        const id = await computeHash(`nu-bill-${bill.number}-${bill.title ?? 'untitled'}`, 'sha256');

        records.push({
          id,
          province: 'NU',
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
          sourceSystem: 'nu-bills-html',
          ingestedAt: now,
        });
      }
    }
  } catch {
    return [];
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  CKAN Search Utility                                                */
/* ------------------------------------------------------------------ */

/**
 * Generic CKAN portal search for legislative datasets.
 * Searches a province's open data portal (CKAN) for datasets matching
 * legislative/hansard keywords, returning them as ProvincialLegislatureRecords.
 */
export async function searchCkan(
  ckanBaseUrl: string,
  province: ProvinceCode,
  recordType: LegislativeRecordType,
  keywords: string[],
  maxRecords: number,
  ingestedAt: string,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];

  try {
    const query = keywords.map((k) => `"${k}"`).join(' OR ');
    const searchUrl = `${ckanBaseUrl}?q=${encodeURIComponent(query)}&rows=${Math.min(maxRecords, 50)}`;

    const resp = await httpGet(searchUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: 'application/json',
      },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return [];

    const data = await resp.json<{ success?: boolean; result?: { results?: Array<Record<string, unknown>> } }>();

    if (!data.success || !data.result?.results) return [];

    for (const pkg of data.result.results) {
      if (records.length >= maxRecords) break;

      const title = String(pkg['title'] ?? '');
      const notes = String(pkg['notes'] ?? '');
      const name = String(pkg['name'] ?? '');
      const metadataCreated = String(pkg['metadata_created'] ?? '').substring(0, 10);
      const url = String(pkg['url'] ?? '');
      const resources = pkg['resources'] as Array<{ url?: string; name?: string }> | undefined;

      const sourceUrl = resources?.[0]?.url ?? url ?? `https://${province.toLowerCase()}.ckan.io/dataset/${name}`;
      const id = await computeHash(`${province.toLowerCase()}-ckan-${name}-${metadataCreated}`, 'sha256');

      records.push({
        id,
        province,
        recordType,
        chamber: 'legislative-assembly',
        sittingDate: metadataCreated || null,
        hansardUrl: null,
        topic: title || notes || null,
        speaker: null,
        party: null,
        riding: null,
        textExcerpt: notes ? notes.substring(0, 500) : null,
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
        sourceUrl,
        sourceRecordId: name,
        sourceSystem: 'ckan',
        ingestedAt,
      });
    }
  } catch {
    // CKAN unavailable — return empty
  }

  return records;
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

/**
 * Generic bill entry extraction from any province's HTML listing page.
 * Looks for anchor tags with "bill" in the href and extracts bill numbers.
 */
function extractBillEntriesGeneric(html: string, baseUrl: string): BillEntry[] {
  const bills: BillEntry[] = [];
  const seenUrls = new Set<string>();

  // Pattern: match anchor tags with "bill" in href path
  const pattern = /href="([^"]*?\/(?:bill|projet-de-loi)[^"]*?)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    const url = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    // Try to extract bill number from URL or surrounding text
    const billNumMatch = url.match(/[Bb]ill[\s-]*(\d+)/) || href.match(/[Bb]ill[\s-]*(\d+)/);
    const billNumber = billNumMatch ? `Bill ${billNumMatch[1]}` : 'Unknown';

    // Try to extract a title from nearby anchor text or from the URL
    const titleMatch = html.match(new RegExp(`${escapeRegex(href)}\\s*[>]\\s*([^<]+)`, 'i'));
    const title = titleMatch?.[1]?.trim() ?? null;

    bills.push({
      number: billNumber,
      title,
      status: null,
      date: null,
      url,
    });
  }

  return bills;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract committee entries from Ontario committee XML data.
 */
export interface CommitteeEntry {
  url: string;
  date: string;
  title: string | null;
  committeeName: string | null;
}

/**
 * Parse committee entries from Ontario committee evidence XML.
 */
function extractCommitteeEntries(xml: string): CommitteeEntry[] {
  const entries: CommitteeEntry[] = [];

  // Parse XML-ish structures for committee meeting records
  // Pattern: look for meeting/sitting dates and committee identifiers
  const datePattern = /(\d{4}-\d{2}-\d{2})/g;
  let dateMatch: RegExpExecArray | null;

  while ((dateMatch = datePattern.exec(xml)) !== null) {
    const date = dateMatch[1];
    // Look for committee name near the date (within ~200 chars)
    const beforeDate = xml.substring(Math.max(0, dateMatch.index - 200), dateMatch.index);
    const committeeNameMatch = beforeDate.match(/committee[:\s]+([^<.]+)/i);
    const committeeName = committeeNameMatch?.[1]?.trim() ?? null;

    const id = `on-committee-${date}-${entries.length}`;
    entries.push({
      url: `https://www.ola.org/en/legislative-business/committees/${date}`,
      date,
      title: committeeName ? `Committee: ${committeeName}` : null,
      committeeName,
    });
  }

  return entries;
}

/**
 * Extract Ontario committee links from the OLA committees listing page.
 */
function extractOntarioCommitteeLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match Ontario committee page links
  const pattern = /href="(\/en\/legislative-business\/committees\/[^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.ola.org${match[1]}`;

    // Try to extract a committee name from nearby text
    const surrounding = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    const nameMatch = surrounding.match(/>([^<]+)</);
    const title = nameMatch?.[1]?.trim() ?? null;

    // Extract date from URL
    const dateMatch = url.match(/(\d{4}-\d{2}-\d{2})/);

    if (!links.some((l) => l.url === url)) {
      links.push({
        url,
        date: dateMatch?.[1] ?? new Date().toISOString().substring(0, 10),
        title,
      });
    }
  }

  return links;
}

/**
 * Extract BC committee links from the leg.bc.ca committees page.
 */
function extractBCCommitteeLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match BC committee-related links
  const pattern = /href="(\/parliamentary-business\/committees\/[^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.leg.bc.ca${match[1]}`;

    // Get committee name from link text
    const surrounding = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    const nameMatch = surrounding.match(/>([^<]+)</);
    const title = nameMatch?.[1]?.trim() ?? null;

    // Extract date from URL
    const dateMatch = url.match(/(\d{4}-\d{2}-\d{2})/);

    if (!links.some((l) => l.url === url)) {
      links.push({
        url,
        date: dateMatch?.[1] ?? new Date().toISOString().substring(0, 10),
        title,
      });
    }
  }

  return links;
}

/**
 * Generic committee link extraction from any province's committee listing page.
 * Looks for anchor tags containing "committee" in href path.
 */
function extractGenericCommitteeLinks(html: string, baseUrl: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];
  const seenUrls = new Set<string>();

  // Match anchor tags with "committee" or "commissions" in the href
  const pattern = /href="([^"]*(?:\/committee|\/commissions?)[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('#') || href.startsWith('javascript:')) continue;

    const url = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    // Get name from link text
    const surrounding = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 200);
    const nameMatch = surrounding.match(/>([^<]+)</);
    const title = nameMatch?.[1]?.trim() ?? null;

    // Extract date if present
    const dateMatch = url.match(/(\d{4}-\d{2}-\d{2})/);

    links.push({
      url,
      date: dateMatch?.[1] ?? new Date().toISOString().substring(0, 10),
      title,
    });
  }

  return links;
}

/**
 * Generic transcript link extraction from any province's Hansard listing page.
 * Looks for anchor tags with links containing date patterns and Hansard-like paths.
 */
function extractGenericTranscriptLinks(html: string, baseUrl: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];
  const seenUrls = new Set<string>();

  // Pattern 1: Links containing a date like YYYY-MM-DD in the href
  const datePattern = /href="([^"]*?(\d{4}-\d{2}-\d{2})[^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = datePattern.exec(html)) !== null) {
    const href = match[1];
    const date = match[2];

    if (href.startsWith('#') || href.startsWith('javascript:')) continue;

    // Filter to legislative-looking paths
    const isLegislative = /hansard|transcript|debates?|journal|proceedings/i.test(href);
    if (!isLegislative && links.length > 0) continue; // Only skip if we already have some

    const url = href.startsWith('http') ? href.split('#')[0] : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href.split('#')[0]}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    // Extract title from anchor text
    const surrounding = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 150);
    const nameMatch = surrounding.match(/>([^<]{3,200})</);
    const title = nameMatch?.[1]?.trim() ?? null;

    links.push({ url, date, title });
  }

  // Pattern 2: If no date-pattern links found, look for PDF links with Hansard keywords
  if (links.length === 0) {
    const pdfPattern = /href="([^"]*\.pdf[^"]*)"/gi;
    while ((match = pdfPattern.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith('#') || href.startsWith('javascript:')) continue;
      if (!/hansard|transcript|debates?/i.test(href)) continue;

      const dateMatch2 = href.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch2) continue;

      const url = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const surrounding = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 150);
      const nameMatch = surrounding.match(/>([^<]{3,200})</);
      const title = nameMatch?.[1]?.trim() ?? null;

      links.push({ url: url, date: dateMatch2[1], title });
    }
  }

  return links;
}

/**
 * Extract Quebec Hansard transcript links from assnat.qc.ca pages.
 * Quebec publishes bilingual (FR/EN) Hansard listings.
 */
function extractQuebecTranscriptLinks(html: string): TranscriptLink[] {
  const links: TranscriptLink[] = [];

  // Match Quebec Hansard links — look for journal/debats URLs
  const pattern = /href="(\/[^\"]*?(?:journal|debats?|hansard)[^\"]*?(\d{4}-\d{2}-\d{2})[^\"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = `https://www.assnat.qc.ca${match[1].startsWith('/') ? '' : '/'}${match[1]}`;
    const date = match[2];

    if (!links.some((l) => l.url === url)) {
      // Get title from link text
      const surrounding = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 150);
      const nameMatch = surrounding.match(/>([^<]+)</);
      const title = nameMatch?.[1]?.trim() ?? null;

      links.push({ url, date, title });
    }
  }

  return links;
}
