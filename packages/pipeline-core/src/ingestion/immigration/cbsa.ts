// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CBSA Connector — Quill
 *
 * Fetches Canada Border Services Agency enforcement data:
 *   - Administrative Monetary Penalty System (AMPS) statistics
 *   - CBSA proactive disclosure data
 *
 * Note: CBSA has limited open data compared to IRCC/IRB.
 * Most enforcement data requires ATIP requests.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  IMMIGRATION_SOURCES,
  CBSA_DATASETS,
  ImmigrationFetchError,
  DEFAULT_MAX_RECORDS,
} from './constants.js';
import type { CbsaEnforcement, CbsaPenalty, ImmigrationIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  AMPS Statistics CSV Fetch                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch AMPS (Administrative Monetary Penalty System) statistics.
 * These are penalties issued by CBSA for trade and customs violations.
 * Covers 2012-2014 period in the existing dataset.
 */
export async function fetchAmpsStats(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CbsaPenalty[]> {
  const url = IMMIGRATION_SOURCES.CBSA.AMPS_DATA;
  const records: CbsaPenalty[] = [];

  try {
    const resp = await httpGet(url, { timeoutMs: 15_000 });
    if (resp.statusCode >= 400) return records;

    const lines = resp.body.split('\n').filter(l => l.trim().length > 0);
    // Skip header
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      if (records.length >= maxRecords) break;

      const fields = parseCbsaCsvLine(line);
      if (fields.length < 3) continue;

      try {
        records.push({
          id: await computeHash(`cbsa-amps-${fields.join('-')}`, 'sha256'),
          year: parseInt(fields[0], 10) || 0,
          violationType: fields[1] ?? '',
          penaltyAmount: parseFloat(fields[2]) || 0,
          count: parseInt(fields[3], 10) || 1,
          sourceUrl: url,
          ingestedAt: new Date().toISOString(),
        });
      } catch {
        continue;
      }
    }
  } catch {
    return records;
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Simple CSV Parser for CBSA files                                   */
/* ------------------------------------------------------------------ */

function parseCbsaCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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
/*  CKAN Metadata for CBSA Datasets                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch CBSA dataset info from CKAN.
 */
export async function fetchCbsaCkanMetadata(): Promise<{
  datasets: { title: string; resources: number }[];
}> {
  const datasets: { title: string; resources: number }[] = [];

  for (const [key, ds] of Object.entries(CBSA_DATASETS)) {
    try {
      const resp = await httpGet(
        `${IMMIGRATION_SOURCES.CKAN.SHOW}?id=${ds.id}`,
        { headers: { Accept: 'application/json' }, timeoutMs: 15_000 },
      );

      if (resp.statusCode >= 400) continue;
      const parsed = await resp.json<{ success: boolean; result: { title: string; resources: any[] } }>();

      if (parsed.success) {
        datasets.push({
          title: parsed.result.title,
          resources: parsed.result.resources.length,
        });
      }
    } catch {
      continue;
    }
  }

  return { datasets };
}

/* ------------------------------------------------------------------ */
/*  Search CBSA Records                                                */
/* ------------------------------------------------------------------ */

/**
 * Search across CBSA enforcement data for a term.
 */
export async function searchCbsaData(
  query: string,
  maxResults = 10,
): Promise<CbsaPenalty[]> {
  const q = query.toLowerCase();
  const amps = await fetchAmpsStats();
  return amps.filter(p =>
    p.violationType.toLowerCase().includes(q),
  ).slice(0, maxResults);
}
