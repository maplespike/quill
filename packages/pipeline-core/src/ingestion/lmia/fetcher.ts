// SPDX-License-Identifier: AGPL-3.0-only
/**
 * LMIA Fetcher — Quill
 *
 * HTTP fetcher for Labour Market Impact Assessment (LMIA) data from
 * open.canada.ca (CKAN) and ESDC quarterly CSV exports.
 *
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 *
 * Sources:
 *   - Positive LMIA: https://open.canada.ca/data/dataset/90fed587-1364-4f33-a9ee-208181dc0b97
 *   - Negative LMIA: https://open.canada.ca/data/dataset/f82f66f2-a22b-4511-bccf-e1d74db39ae5
 */

import { httpGet } from '../../utils/http.js';
import {
  LMIA_CKAN_PACKAGE_IDS,
  LMIA_KNOWN_RESOURCES,
  lmiaCkanPackageUrl,
  lmiaDownloadUrl,
  LMIA_SOURCES,
} from './constants.js';
import { LmiaOutcome } from './types.js';


export class LmiaFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'LmiaFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'MapleSpike/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'text/csv,text/plain,application/json,*/*',
} as const;

/**
 * Fetch raw text from a URL using undici.
 */
export async function fetchUrl(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new LmiaFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };
}


/**
 * CKAN resource information as returned by package_show.
 */
export interface CkanResource {
  id: string;
  name: string;
  description: string | null;
  format: string;
  url: string;
  created: string;
  last_modified: string;
  /** Language of the resource (en/fr) — extracted from name or description */
  language?: string;
}

/**
 * CKAN package metadata response.
 */
export interface CkanPackageResponse {
  id: string;
  title: string;
  notes: string | null;
  resources: CkanResource[];
  organization: { name: string; title: string } | null;
}

/**
 * Fetch CKAN package metadata via the package_show API.
 *
 * Returns the full package metadata including all resources.
 * Use this to discover the latest resource ID for a given quarter.
 */
export async function fetchLmiaCkanMetadata(
  outcome: LmiaOutcome,
  options: { timeoutMs?: number } = {},
): Promise<CkanPackageResponse> {
  const url = lmiaCkanPackageUrl(outcome);
  const result = await fetchUrl(url, options);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result) {
      throw new LmiaFetchError(
        `CKAN API returned error for ${outcome}: ${parsed.error?.message ?? 'unknown error'}`,
        undefined,
        url,
      );
    }
    return parsed.result as CkanPackageResponse;
  } catch (err) {
    if (err instanceof LmiaFetchError) throw err;
    throw new LmiaFetchError(
      `Failed to parse CKAN metadata for ${outcome}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Discover the latest resource ID for a given LMIA outcome and quarter.
 *
 * Searches through the CKAN package resources to find the most recent
 * English CSV resource. Falls back to known resource IDs if discovery fails.
 *
 * @param outcome - Positive or Negative LMIA
 * @param quarter - Quarter string like "2025Q4"
 * @returns The resource ID and optionally the filename
 */
export async function discoverLatestResource(
  outcome: LmiaOutcome,
  quarter: string,
  options: { timeoutMs?: number } = {},
): Promise<{ resourceId: string; filename: string }> {
  try {
    const metadata = await fetchLmiaCkanMetadata(outcome, options);

    // Filter resources: look for English CSV resources matching the quarter
    const quarterUpper = quarter.toUpperCase();
    const matching = metadata.resources.filter((r) => {
      const name = (r.name || '').toUpperCase();
      const desc = (r.description || '').toUpperCase();
      return (
        r.format?.toUpperCase() === 'CSV' &&
        (name.includes(quarterUpper) || desc.includes(quarterUpper)) &&
        (name.includes('EN') || name.includes('ENG') || desc.includes('ENGLISH') ||
         name.endsWith('-e.csv') || name.includes('_E.'))
      );
    });

    if (matching.length > 0) {
      // Sort by last_modified descending, take the most recent
      matching.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
      const resource = matching[0];
      return {
        resourceId: resource.id,
        filename: resource.name || 'data.csv',
      };
    }

    // Fallback: try to find any English CSV resource
    const csvEnResources = metadata.resources.filter((r) => {
      const name = (r.name || '').toUpperCase();
      return r.format?.toUpperCase() === 'CSV' &&
        (name.includes('EN') || name.includes('ENG') || name.endsWith('-E.CSV'));
    });

    if (csvEnResources.length > 0) {
      csvEnResources.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
      const resource = csvEnResources[0];
      return {
        resourceId: resource.id,
        filename: resource.name || 'data.csv',
      };
    }

    // Last resort: use any CSV resource
    const anyCsv = metadata.resources.filter((r) => r.format?.toUpperCase() === 'CSV');
    if (anyCsv.length > 0) {
      anyCsv.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
      const resource = anyCsv[0];
      return {
        resourceId: resource.id,
        filename: resource.name || 'data.csv',
      };
    }

    // Fallback to known resources
    const known = LMIA_KNOWN_RESOURCES[outcome];
    if (known && known[quarter]) {
      return { resourceId: known[quarter]!, filename: 'data.csv' };
    }

    throw new LmiaFetchError(
      `No CSV resources found for ${outcome} ${quarter} and no known fallback available`,
    );
  } catch (err) {
    // If fetch/parse fails, try known fallback
    const known = LMIA_KNOWN_RESOURCES[outcome];
    if (known && known[quarter]) {
      return { resourceId: known[quarter]!, filename: 'data.csv' };
    }
    throw err;
  }
}


/**
 * Fetch LMIA CSV data for a specific outcome and quarter.
 *
 * Automatically discovers the latest resource ID via CKAN metadata,
 * then downloads the CSV data.
 */
export async function fetchLmiaByQuarter(
  outcome: LmiaOutcome,
  quarter: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const { resourceId, filename } = await discoverLatestResource(outcome, quarter, options);
  const url = lmiaDownloadUrl(outcome, resourceId, filename);

  // Try the constructed URL first
  try {
    const result = await fetchUrl(url, options);
    return result.body;
  } catch {
    // Fallback: try the resource's direct URL from CKAN metadata
    const metadata = await fetchLmiaCkanMetadata(outcome, options);
    const resource = metadata.resources.find((r) => r.id === resourceId);
    if (resource?.url) {
      const result = await fetchUrl(resource.url, options);
      return result.body;
    }
    throw new LmiaFetchError(
      `Failed to download LMIA data for ${outcome} ${quarter} via any URL`,
      undefined,
      url,
    );
  }
}

/**
 * Fetch the latest LMIA CSV data for a given outcome.
 *
 * Uses the latest known quarter (2025Q4) or discovers it from CKAN metadata.
 */
export async function fetchLatestLmiaRecords(
  outcome: LmiaOutcome,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const quarter = await discoverLatestQuarter(outcome, options);
  return fetchLmiaByQuarter(outcome, quarter, options);
}


/**
 * Discover the latest available quarter from CKAN metadata.
 *
 * Parses resource names looking for quarter patterns (e.g. "2025Q4", "2025-Q4")
 * and returns the most recent one.
 */
export async function discoverLatestQuarter(
  outcome: LmiaOutcome,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  try {
    const metadata = await fetchLmiaCkanMetadata(outcome, options);
    const quarterPattern = /(20\d{2})\s*[-_]?[Qq]([1-4])/;
    const quarters: string[] = [];

    for (const resource of metadata.resources) {
      const name = resource.name || '';
      const match = name.match(quarterPattern);
      if (match) {
        quarters.push(`${match[1]}Q${match[2]}`);
      }
    }

    if (quarters.length > 0) {
      // Sort descending and return the most recent
      quarters.sort().reverse();
      return quarters[0];
    }
  } catch {
    // Fall through to default
  }

  return '2025Q4';
}

/**
 * List all available quarters for a given LMIA outcome.
 */
export async function listAvailableQuarters(
  outcome: LmiaOutcome,
  options: { timeoutMs?: number } = {},
): Promise<string[]> {
  const metadata = await fetchLmiaCkanMetadata(outcome, options);
  const quarterPattern = /(20\d{2})\s*[-_]?[Qq]([1-4])/;
  const quarterSet = new Set<string>();

  for (const resource of metadata.resources) {
    const name = resource.name || '';
    const match = name.match(quarterPattern);
    if (match) {
      quarterSet.add(`${match[1]}Q${match[2]}`);
    }
  }

  return Array.from(quarterSet).sort();
}
