// SPDX-License-Identifier: AGPL-3.0-only
/**
 * IRB Connector — Quill
 *
 * Fetches Refugee Protection Division (RPD) decisions from
 * the Immigration and Refugee Board of Canada.
 *
 * Data sources:
 *   - IRB quarterly CSV files at irb-cisr.gc.ca/en/transparency/rpd-statistics/
 *   - CKAN dataset 6e47f705-71ed-41f0-8fd5-d1a8508a3b63 for historical
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  IMMIGRATION_SOURCES,
  IRB_DATASETS,
  rpdDecisionsUrl,
  ImmigrationFetchError,
  DEFAULT_MAX_RECORDS,
} from './constants.js';
import type { RefugeeDecision, ImmigrationIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Quarterly RPD Decisions CSV Fetch                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse a single RPD decision CSV line.
 * Columns vary by year but generally include:
 *   Year, Quarter, Country of Origin, Language, Decision, Representation, Gender, Age
 */
function parseRpdLine(fields: string[]): Partial<RefugeeDecision> | null {
  if (fields.length < 3) return null;

  const year = parseInt(fields[0], 10);
  if (!year || year < 1985 || year > 2030) return null;

  const outcomeStr = fields[4]?.toLowerCase() ?? '';
  let outcome: RefugeeDecision['outcome'] = 'other';
  if (outcomeStr.includes('accept') || outcomeStr.includes('grant')) outcome = 'accepted';
  else if (outcomeStr.includes('reject') || outcomeStr.includes('deny')) outcome = 'rejected';
  else if (outcomeStr.includes('abandon')) outcome = 'abandoned';
  else if (outcomeStr.includes('withdraw')) outcome = 'withdrawn';

  return {
    year,
    quarter: parseInt(fields[1], 10) || null,
    countryOfOrigin: fields[2] || null,
    language: fields[3] || null,
    outcome,
    represented: fields[5] ? fields[5].toLowerCase() === 'yes' : null,
    gender: fields[6] || null,
    ageGroup: fields[7] || null,
    hearingType: fields[8] || null,
  };
}

/**
 * Fetch RPD decisions for a specific quarter.
 * Returns structured decision records.
 */
export async function fetchRpdDecisionsQuarter(
  year: number,
  quarter: number,
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<RefugeeDecision[]> {
  const url = rpdDecisionsUrl(year, quarter);
  const records: RefugeeDecision[] = [];

  try {
    const resp = await httpGet(url, { timeoutMs: 15_000 });
    if (resp.statusCode >= 400) return records;

    const lines = resp.body.split('\n').filter(l => l.trim().length > 0);
    // Skip header row
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      if (records.length >= maxRecords) break;

      // Simple CSV parse (RPD files use comma-delimited, may have quoted fields)
      const fields = parseRpdCsvLine(line);
      const parsed = parseRpdLine(fields);
      if (!parsed) continue;

      records.push({
        id: await computeHash(`rpd-${year}-q${quarter}-${fields.join('-')}`, 'sha256'),
        decisionId: null,
        year: parsed.year!,
        quarter: parsed.quarter ?? null,
        countryOfOrigin: parsed.countryOfOrigin ?? null,
        language: parsed.language ?? null,
        outcome: parsed.outcome!,
        represented: parsed.represented ?? null,
        gender: parsed.gender ?? null,
        ageGroup: parsed.ageGroup ?? null,
        hearingType: parsed.hearingType ?? null,
        sourceUrl: url,
        ingestedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Quarterly files may not exist for all quarters — return empty
    return records;
  }

  return records;
}

/**
 * Simple CSV line parser for IRB decision files.
 * Handles quoted fields and escaped quotes.
 */
function parseRpdCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/* ------------------------------------------------------------------ */
/*  Batch RPD Decisions Fetch (recent 8 quarters)                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch RPD decisions for the last 2 years (8 quarters).
 * This is the primary batch fetch function.
 */
export async function fetchRecentRpdDecisions(
  endYear = new Date().getFullYear(),
  endQuarter = Math.ceil((new Date().getMonth() + 1) / 3),
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<RefugeeDecision[]> {
  const allRecords: RefugeeDecision[] = [];

  // Fetch quarters backwards from current
  for (let yearOffset = 0; yearOffset < 2; yearOffset++) {
    const year = endYear - yearOffset;
    const startQ = yearOffset === 0 ? endQuarter : 4;
    const endQ = 1;

    for (let q = startQ; q >= endQ; q--) {
      if (allRecords.length >= maxRecords) break;
      const records = await fetchRpdDecisionsQuarter(year, q, maxRecords - allRecords.length);
      allRecords.push(...records);
    }
    if (allRecords.length >= maxRecords) break;
  }

  return allRecords;
}

/* ------------------------------------------------------------------ */
/*  Search RPD Decisions                                               */
/* ------------------------------------------------------------------ */

/**
 * Search RPD decisions across recent quarters for a term.
 */
export async function searchRpdDecisions(
  query: string,
  maxResults = 10,
): Promise<RefugeeDecision[]> {
  const q = query.toLowerCase();
  const decisions = await fetchRecentRpdDecisions();
  return decisions.filter(d =>
    d.countryOfOrigin?.toLowerCase().includes(q) ||
    d.outcome?.toLowerCase().includes(q) ||
    d.language?.toLowerCase().includes(q) ||
    d.gender?.toLowerCase().includes(q) ||
    d.hearingType?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}

/* ------------------------------------------------------------------ */
/*  Statistics & Summaries                                             */
/* ------------------------------------------------------------------ */

/**
 * Generate acceptance vs rejection stats by country for a set of decisions.
 */
export function computeRpdStats(
  decisions: RefugeeDecision[],
): {
  total: number;
  accepted: number;
  rejected: number;
  abandoned: number;
  withdrawn: number;
  byCountry: Record<string, { accepted: number; rejected: number; total: number }>;
  acceptanceRate: number;
} {
  const total = decisions.length;
  const accepted = decisions.filter(d => d.outcome === 'accepted').length;
  const rejected = decisions.filter(d => d.outcome === 'rejected').length;
  const abandoned = decisions.filter(d => d.outcome === 'abandoned').length;
  const withdrawn = decisions.filter(d => d.outcome === 'withdrawn').length;

  const byCountry: Record<string, { accepted: number; rejected: number; total: number }> = {};
  for (const d of decisions) {
    const country = d.countryOfOrigin ?? 'Unknown';
    if (!byCountry[country]) byCountry[country] = { accepted: 0, rejected: 0, total: 0 };
    byCountry[country].total++;
    if (d.outcome === 'accepted') byCountry[country].accepted++;
    if (d.outcome === 'rejected') byCountry[country].rejected++;
  }

  return {
    total,
    accepted,
    rejected,
    abandoned,
    withdrawn,
    byCountry,
    acceptanceRate: total > 0 ? accepted / total : 0,
  };
}
