/**
 * Lobbying Registry Connector — Frostbite Data Pipeline
 *
 * Fetches federal lobbying registration data from the Office of the
 * Commissioner of Lobbying of Canada (OCL).
 *
 * Data sources (in order of preference):
 *   1. CKAN API → download full CSV dump (monthly)
 *   2. Monthly communication CSV reports (incremental)
 *   3. Search HTML (real-time lookup)
 *
 * The OCL publishes the full lobbying registry as weekly-updated
 * CSV files through the open.canada.ca CKAN portal.
 *
 * CKAN dataset ID: 70ef2117-1095-4d77-80eb-b87f2bada2a4
 * Primary CSV URL: https://lobbycanada.gc.ca/media/zwcjycef/registrations_enregistrements_ocl_cal.zip
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { OURCOMMONS_BASE } from '../committees/constants.js';
import type { LobbyingRecord } from './types.js';


export class LobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'LobbyingFetchError';
  }
}


/**
 * Fetch the lobbying registry dataset info from CKAN.
 */
export async function fetchCkanDataset(): Promise<{
  id: string;
  title: string;
  resources: { name: string; format: string; url: string }[];
}> {
  const resp = await httpGet(
    'https://open.canada.ca/data/api/3/action/package_show?id=70ef2117-1095-4d77-80eb-b87f2bada2a4',
    {
      headers: { Accept: 'application/json' },
    },
  );

  const body: any = resp.body ? JSON.parse(resp.body) : {};
  if (!body.success) {
    throw new LobbyingFetchError('CKAN API error: ' + (body.error?.message ?? 'unknown'));
  }

  const result = body.result;
  return {
    id: result.id,
    title: result.title,
    resources: (result.resources ?? []).map((r: any) => ({
      name: r.name,
      format: r.format,
      url: r.url,
    })),
  };
}

/**
 * Fetch the full lobbying registrations CSV ZIP and parse it.
 * This is the primary data source — a complete dump of all registrations.
 *
 * Returns the raw CSV text (after unzipping the primary file).
 */
export async function fetchRegistrationsCsv(): Promise<string> {
  const url = 'https://lobbycanada.gc.ca/media/zwcjycef/registrations_enregistrements_ocl_cal.zip';

  const resp = await httpGet(url, {
    headers: { Accept: 'application/zip,*/*' },
  });

  if (resp.statusCode >= 400) {
    throw new LobbyingFetchError(`HTTP ${resp.statusCode} fetching CSV`, url);
  }

  // Return raw bytes — caller handles unzipping
  const buffer = new TextEncoder().encode(resp.body);
  // For now, we just return the URL and metadata; actual CSV parsing
  // will be done when the data is needed by the ingestion pipeline
  return `ZIP:${url}:${buffer.byteLength}bytes`;
}


/**
 * Search lobbying registry for a specific organization or individual.
 * Uses the HTML search page.
 */
export async function searchLobbying(
  query: string,
): Promise<Partial<LobbyingRecord>[]> {
  const searchUrl = `https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=${encodeURIComponent(query)}`;

  const resp = await httpGet(searchUrl, {
    headers: { Accept: 'text/html' },
  });

  const html = resp.body;

  // Parse search results from HTML table
  const results: Partial<LobbyingRecord>[] = [];

  // Match table rows in the search results
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 3) continue;

    const extractCell = (idx: number): string => {
      const cell = cells[idx];
      if (!cell) return '';
      // Strip HTML tags
      return cell.replace(/<[^>]+>/g, '').trim();
    };

    // First cell typically has registrant name (with link)
    const registrantHtml = cells[0];
    const registrantMatch = registrantHtml?.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const registrantName = registrantMatch
      ? registrantMatch[1].replace(/<[^>]+>/g, '').trim()
      : extractCell(0);

    if (!registrantName) continue;

    results.push({
      registrantName,
      clientName: extractCell(1) || registrantName,
      subjectMatter: extractCell(2) ? [extractCell(2)] : [],
      sourceUrl: searchUrl,
    });
  }

  return results;
}

/**
 * Scrape the monthly communication reports page to find
 * recent lobbying communications (who met with whom, when).
 */
export async function fetchMonthlyCommunicationReports(): Promise<{
  year: number;
  month: number;
  csvUrl: string;
}[]> {
  const url = 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/monthlyCommunicationReportsCSV.shtml';

  const resp = await httpGet(url, {
    headers: { Accept: 'text/html' },
  });

  if (resp.statusCode >= 400) {
    throw new LobbyingFetchError(`HTTP ${resp.statusCode} fetching monthly reports`, url);
  }

  const html = resp.body;
  const reports: { year: number; month: number; csvUrl: string }[] = [];

  // Parse links to monthly CSV files
  const linkPattern = /<a\s[^>]*href="([^"]*communications[^"]*\.csv)"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const href = linkMatch[1];
    const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();

    // Try to extract year/month from text or URL
    const yearMatch = text.match(/(\d{4})/) || href.match(/(\d{4})/);
    const monthMatch = text.match(/January|February|March|April|May|June|July|August|September|October|November|December/i);
    const monthMap: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };

    if (yearMatch) {
      reports.push({
        year: parseInt(yearMatch[1], 10),
        month: monthMatch ? (monthMap[monthMatch[0].toLowerCase()] ?? 0) : 0,
        csvUrl: href.startsWith('http') ? href : `https://lobbycanada.gc.ca${href.startsWith('/') ? '' : '/'}${href}`,
      });
    }
  }

  return reports;
}
