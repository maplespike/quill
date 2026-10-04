/**
 * Provincial Legislatures Parser — Quill
 *
 * Normalizes per-province legislative data formats into the unified
 * ProvincialLegislatureRecord schema.
 *
 * Each province publishes data in a different format:
 *   - Ontario: XML Hansard transcripts, HTML committee pages, HTML bills
 *   - BC: XML Hansard, HTML committee pages
 *   - Alberta: HTML Hansard (speech viewer), HTML committee pages
 *   - Quebec: XML Hansard (bilingual FR/EN)
 *   - Others: various HTML/PDF formats
 *
 * The parser provides both per-province handler functions and batch
 * processing for multiple records.
 */

import { computeHash } from '../../verification/hashing.js';
import type { ProvincialLegislatureRecord, ProvinceCode, LegislativeRecordType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw province-specific record into the unified
 * ProvincialLegislatureRecord schema.
 *
 * @param rawRecord - Raw data object from the fetcher
 * @param province - Province code
 * @returns Normalized ProvincialLegislatureRecord
 */
export async function parseProvincialRecord(
  rawRecord: Record<string, unknown>,
  province: ProvinceCode,
): Promise<ProvincialLegislatureRecord> {
  const now = new Date().toISOString();

  // Detect record type from available fields
  const recordType = detectRecordType(rawRecord);
  const chamber = (rawRecord.chamber as string) ?? 'legislative-assembly';

  // Build hash content
  const hashContent = [
    province,
    recordType,
    rawRecord.sittingDate ?? rawRecord.date ?? '',
    rawRecord.hansardUrl ?? rawRecord.url ?? '',
    rawRecord.speaker ?? '',
    rawRecord.topic ?? '',
  ].join('|');

  const id = await computeHash(hashContent, 'sha256');

  return {
    id,
    province,
    recordType,
    chamber: chamber as ProvincialLegislatureRecord['chamber'],
    sittingDate: (rawRecord.sittingDate ?? rawRecord.date ?? null) as string | null,
    hansardUrl: (rawRecord.hansardUrl ?? rawRecord.url ?? null) as string | null,
    topic: (rawRecord.topic ?? rawRecord.title ?? null) as string | null,
    speaker: (rawRecord.speaker ?? null) as string | null,
    party: (rawRecord.party ?? null) as string | null,
    riding: (rawRecord.riding ?? null) as string | null,
    textExcerpt: (rawRecord.textExcerpt ?? rawRecord.excerpt ?? null) as string | null,
    billReference: (rawRecord.billReference ?? null) as string | null,
    billNumber: (rawRecord.billNumber ?? null) as string | null,
    billTitle: (rawRecord.billTitle ?? null) as string | null,
    billStatus: (rawRecord.billStatus ?? null) as string | null,
    billDate: (rawRecord.billDate ?? null) as string | null,
    committeeName: (rawRecord.committeeName ?? null) as string | null,
    meetingNumber: (rawRecord.meetingNumber != null ? Number(rawRecord.meetingNumber) : null) as number | null,
    meetingStartTime: (rawRecord.meetingStartTime ?? null) as string | null,
    meetingEndTime: (rawRecord.meetingEndTime ?? null) as string | null,
    interventionCount: (rawRecord.interventionCount != null ? Number(rawRecord.interventionCount) : null) as number | null,
    language: (rawRecord.language ?? 'en') as string | null,
    sourceUrl: (rawRecord.sourceUrl ?? rawRecord.url ?? '') as string,
    sourceRecordId: (rawRecord.sourceRecordId ?? null) as string | null,
    sourceSystem: (rawRecord.sourceSystem ?? `${province.toLowerCase()}-generic`) as string,
    ingestedAt: now,
  };
}

/**
 * Parse multiple raw records into normalized records with deduplication.
 *
 * @param rawRecords - Array of raw data objects
 * @param province - Province code
 * @returns Array of normalized ProvincialLegislatureRecord
 */
export async function parseProvincialRecords(
  rawRecords: Record<string, unknown>[],
  province: ProvinceCode,
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const seenHashes = new Set<string>();

  for (const raw of rawRecords) {
    try {
      const record = await parseProvincialRecord(raw, province);

      if (!seenHashes.has(record.id)) {
        seenHashes.add(record.id);
        records.push(record);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ProvLeg Parser] Skipping ${province} record: ${msg}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Province-Specific Parsers                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse Ontario Hansard XML into normalized records.
 * Ontario publishes Hansard as XML documents with structured sections
 * for each sitting day.
 *
 * @param xmlText - Raw XML text from Ontario Hansard
 * @returns Array of normalized records (one per speaking intervention)
 */
export async function parseOntarioHansardXml(
  xmlText: string,
  metadata: { date?: string; url?: string } = {},
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();
  const date = metadata.date ?? new Date().toISOString().substring(0, 10);

  try {
    // Simple XML parsing for Ontario Hansard format
    // Ontario Hansard XML typically has the structure:
    // <hansard>
    //   <session>...</session>
    //   <speech speaker="..." party="..." riding="...">
    //     <paragraph>...</paragraph>
    //   </speech>
    // </hansard>

    // Extract speech blocks using regex (lightweight XML parsing)
    const speechPattern = /<speech[^>]*>[\s\S]*?<\/speech>/g;
    let speechMatch: RegExpExecArray | null;

    while ((speechMatch = speechPattern.exec(xmlText)) !== null) {
      const speechBlock = speechMatch[0];

      // Extract speaker attributes
      const speakerMatch = speechBlock.match(/speaker\s*=\s*"([^"]*)"/);
      const partyMatch = speechBlock.match(/party\s*=\s*"([^"]*)"/);
      const ridingMatch = speechBlock.match(/riding\s*=\s*"([^"]*)"/);

      // Extract paragraphs
      const paraPattern = /<paragraph[^>]*>([\s\S]*?)<\/paragraph>/g;
      let paraMatch: RegExpExecArray | null;
      const paragraphs: string[] = [];

      while ((paraMatch = paraPattern.exec(speechBlock)) !== null) {
        // Strip XML tags from paragraph content
        const text = paraMatch[1].replace(/<[^>]+>/g, '').trim();
        if (text) paragraphs.push(text);
      }

      const speaker = speakerMatch ? speakerMatch[1] : null;
      const party = partyMatch ? partyMatch[1] : null;
      const riding = ridingMatch ? ridingMatch[1] : null;
      const excerpt = paragraphs.slice(0, 3).join(' ').substring(0, 500);

      // Extract bill references from the speech
      const billRefPattern = /Bill\s+\d+/g;
      const billRefs = [...new Set(speechBlock.match(billRefPattern) ?? [])];

      const contentForHash = `on-hansard-xml-${date}-${speaker ?? 'unknown'}-${excerpt.substring(0, 100)}`;
      const id = await computeHash(contentForHash, 'sha256');

      records.push({
        id,
        province: 'ON',
        recordType: 'hansard',
        chamber: 'legislative-assembly',
        sittingDate: date,
        hansardUrl: metadata.url ?? null,
        topic: null,
        speaker,
        party,
        riding,
        textExcerpt: excerpt || null,
        billReference: billRefs.length > 0 ? billRefs.join(', ') : null,
        billNumber: billRefs.length > 0 ? billRefs[0] : null,
        billTitle: null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: metadata.url ?? '',
        sourceRecordId: null,
        sourceSystem: 'ola-hansard-xml',
        ingestedAt: now,
      });
    }
  } catch (err) {
    console.warn(`[ProvLeg Parser] Error parsing Ontario Hansard XML: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records;
}

/**
 * Parse BC Hansard XML into normalized records.
 * BC publishes Hansard in a different XML format from Ontario.
 *
 * @param xmlText - Raw XML text from BC Hansard
 * @returns Array of normalized records
 */
export async function parseBCHansardXml(
  xmlText: string,
  metadata: { date?: string; url?: string } = {},
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();
  const date = metadata.date ?? new Date().toISOString().substring(0, 10);

  try {
    // BC Hansard XML typically has the structure:
    // <transcript>
    //   <debate>
    //     <member name="..." party="..." constituency="...">
    //       <para>...</para>
    //     </member>
    //   </debate>
    // </transcript>

    const memberPattern = /<member[^>]*>[\s\S]*?<\/member>/g;
    let memberMatch: RegExpExecArray | null;

    while ((memberMatch = memberPattern.exec(xmlText)) !== null) {
      const block = memberMatch[0];

      const nameMatch = block.match(/name\s*=\s*"([^"]*)"/);
      const partyMatch = block.match(/party\s*=\s*"([^"]*)"/);
      const constituencyMatch = block.match(/constituency\s*=\s*"([^"]*)"/);

      // Extract paragraphs
      const paraPattern = /<para[^>]*>([\s\S]*?)<\/para>/g;
      let paraMatch: RegExpExecArray | null;
      const paragraphs: string[] = [];

      while ((paraMatch = paraPattern.exec(block)) !== null) {
        const text = paraMatch[1].replace(/<[^>]+>/g, '').trim();
        if (text) paragraphs.push(text);
      }

      const speaker = nameMatch ? nameMatch[1] : null;
      const party = partyMatch ? partyMatch[1] : null;
      const riding = constituencyMatch ? constituencyMatch[1] : null;
      const excerpt = paragraphs.slice(0, 3).join(' ').substring(0, 500);

      const billRefs = [...new Set(block.match(/Bill\s+\d+/g) ?? [])];

      const contentForHash = `bc-hansard-xml-${date}-${speaker ?? 'unknown'}-${excerpt.substring(0, 100)}`;
      const id = await computeHash(contentForHash, 'sha256');

      records.push({
        id,
        province: 'BC',
        recordType: 'hansard',
        chamber: 'legislative-assembly',
        sittingDate: date,
        hansardUrl: metadata.url ?? null,
        topic: null,
        speaker,
        party,
        riding,
        textExcerpt: excerpt || null,
        billReference: billRefs.length > 0 ? billRefs.join(', ') : null,
        billNumber: billRefs.length > 0 ? billRefs[0] : null,
        billTitle: null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: metadata.url ?? '',
        sourceRecordId: null,
        sourceSystem: 'bcleg-hansard-xml',
        ingestedAt: now,
      });
    }
  } catch (err) {
    console.warn(`[ProvLeg Parser] Error parsing BC Hansard XML: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records;
}

/**
 * Parse Alberta Hansard HTML into normalized records.
 * Alberta publishes Hansard as HTML pages via their speech viewer.
 *
 * @param htmlText - Raw HTML from Alberta Assembly Hansard
 * @returns Array of normalized records
 */
export async function parseAlbertaHansardHtml(
  htmlText: string,
  metadata: { date?: string; url?: string } = {},
): Promise<ProvincialLegislatureRecord[]> {
  const records: ProvincialLegislatureRecord[] = [];
  const now = new Date().toISOString();
  const date = metadata.date ?? new Date().toISOString().substring(0, 10);

  try {
    // Alberta Hansard HTML typically has speaker blocks like:
    // <div class="speech">...<span class="speaker-name">...</span>...</div>

    const speechPattern = /<div[^>]*class="[^"]*speech[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
    let speechMatch: RegExpExecArray | null;

    while ((speechMatch = speechPattern.exec(htmlText)) !== null) {
      const block = speechMatch[0];

      // Extract speaker name
      const nameMatch = block.match(/<span[^>]*class="[^"]*speaker-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      // Extract party
      const partyMatch = block.match(/<span[^>]*class="[^"]*party[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      // Extract riding
      const ridingMatch = block.match(/<span[^>]*class="[^"]*riding[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

      // Extract text paragraphs
      const paraPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let paraMatch: RegExpExecArray | null;
      const paragraphs: string[] = [];

      while ((paraMatch = paraPattern.exec(block)) !== null) {
        const text = paraMatch[1].replace(/<[^>]+>/g, '').trim();
        if (text) paragraphs.push(text);
      }

      const speaker = nameMatch ? nameMatch[1].trim().replace(/<[^>]+>/g, '') : null;
      const party = partyMatch ? partyMatch[1].trim().replace(/<[^>]+>/g, '') : null;
      const riding = ridingMatch ? ridingMatch[1].trim().replace(/<[^>]+>/g, '') : null;
      const excerpt = paragraphs.slice(0, 3).join(' ').substring(0, 500);

      const billRefs = [...new Set(block.match(/Bill\s+\d+/g) ?? [])];

      const contentForHash = `ab-hansard-html-${date}-${speaker ?? 'unknown'}-${excerpt.substring(0, 100)}`;
      const id = await computeHash(contentForHash, 'sha256');

      records.push({
        id,
        province: 'AB',
        recordType: 'hansard',
        chamber: 'legislative-assembly',
        sittingDate: date,
        hansardUrl: metadata.url ?? null,
        topic: null,
        speaker,
        party,
        riding,
        textExcerpt: excerpt || null,
        billReference: billRefs.length > 0 ? billRefs.join(', ') : null,
        billNumber: billRefs.length > 0 ? billRefs[0] : null,
        billTitle: null,
        billStatus: null,
        billDate: null,
        committeeName: null,
        meetingNumber: null,
        meetingStartTime: null,
        meetingEndTime: null,
        interventionCount: null,
        language: 'en',
        sourceUrl: metadata.url ?? '',
        sourceRecordId: null,
        sourceSystem: 'assembly-ab-hansard-html',
        ingestedAt: now,
      });
    }
  } catch (err) {
    console.warn(`[ProvLeg Parser] Error parsing Alberta Hansard HTML: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records;
}

/**
 * Parse a bill listing entry into normalized records.
 *
 * @param billData - Raw bill data object
 * @param province - Province code
 * @returns Normalized record array (single entry)
 */
export async function parseBillEntry(
  billData: { number: string; title?: string; status?: string; date?: string; url: string },
  province: ProvinceCode,
): Promise<ProvincialLegislatureRecord[]> {
  const now = new Date().toISOString();
  const id = await computeHash(`${province}-bill-${billData.number}-${billData.title ?? ''}`, 'sha256');

  return [{
    id,
    province,
    recordType: 'bill' as LegislativeRecordType,
    chamber: 'legislative-assembly',
    sittingDate: billData.date ?? null,
    hansardUrl: null,
    topic: billData.title ?? null,
    speaker: null,
    party: null,
    riding: null,
    textExcerpt: null,
    billReference: billData.number,
    billNumber: billData.number,
    billTitle: billData.title ?? null,
    billStatus: billData.status ?? null,
    billDate: billData.date ?? null,
    committeeName: null,
    meetingNumber: null,
    meetingStartTime: null,
    meetingEndTime: null,
    interventionCount: null,
    language: 'en',
    sourceUrl: billData.url,
    sourceRecordId: billData.number,
    sourceSystem: `${province.toLowerCase()}-bills`,
    ingestedAt: now,
  }];
}

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Detect the record type from raw record fields.
 */
export function detectRecordType(raw: Record<string, unknown>): LegislativeRecordType {
  if (raw.billNumber || raw.billReference) return 'bill';
  if (raw.committeeName || raw.meetingNumber) return 'committee';
  if (raw.hansardUrl || raw.speaker) return 'hansard';
  return (raw.recordType as LegislativeRecordType) ?? 'hansard';
}

/**
 * Extract bill numbers referenced in a text block.
 */
export function extractBillReferences(text: string): string[] {
  const pattern = /Bill\s+(?:C-)?\d+/g;
  return [...new Set(text.match(pattern) ?? [])];
}

/**
 * Normalize a province name to its standard code.
 */
export function normalizeProvince(input: string): ProvinceCode | null {
  const normalized = input.toUpperCase().trim();

  const provinceMap: Record<string, ProvinceCode> = {
    'ON': 'ON', 'ONTARIO': 'ON',
    'BC': 'BC', 'BRITISH_COLUMBIA': 'BC', 'BRITISH COLUMBIA': 'BC',
    'AB': 'AB', 'ALBERTA': 'AB',
    'QC': 'QC', 'QUEBEC': 'QC', 'QUÉBEC': 'QC',
    'SK': 'SK', 'SASKATCHEWAN': 'SK',
    'MB': 'MB', 'MANITOBA': 'MB',
    'NS': 'NS', 'NOVA_SCOTIA': 'NS', 'NOVA SCOTIA': 'NS',
    'NB': 'NB', 'NEW_BRUNSWICK': 'NB', 'NEW BRUNSWICK': 'NB',
    'NL': 'NL', 'NEWFOUNDLAND': 'NL', 'NEWFOUNDLAND_AND_LABRADOR': 'NL',
    'PE': 'PE', 'PEI': 'PE', 'PRINCE_EDWARD_ISLAND': 'PE', 'PRINCE EDWARD ISLAND': 'PE',
    'NT': 'NT', 'NORTHWEST_TERRITORIES': 'NT', 'NORTHWEST TERRITORIES': 'NT',
    'YT': 'YT', 'YUKON': 'YT',
    'NU': 'NU', 'NUNAVUT': 'NU',
  };

  return provinceMap[normalized] ?? null;
}
