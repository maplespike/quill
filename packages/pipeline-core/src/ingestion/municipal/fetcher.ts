/**
 * Municipal Council Data Fetcher — MapleSpike Pipeline
 *
 * Fetches meeting data from Canadian city council sources.  Each city is
 * different — this module tries city-specific HTML scraping first, then
 * falls back to vendor API calls (eScribe, iCompass, CivicWeb) if the
 * vendor is known for that city.
 *
 * Currently implemented: Toronto, Vancouver, Montreal, Calgary, Edmonton,
 *                        Ottawa, Winnipeg, Quebec City, Hamilton, Halifax
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  getCityConfig,
  meetingsListUrl,
  meetingDetailUrl,
  NotYetImplementedError,
  MunicipalCouncilError,
} from './constants.js';
import type { CityCode, RawCouncilRecord } from './types.js';


/* ------------------------------------------------------------------ */
/*  HTTP Client                                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_TIMEOUT = 30_000;

async function fetchText(
  url: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const resp = await httpGet(url, {
    headers: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
      Accept: 'text/html,application/xhtml+xml,*/*',
      ...headers,
    },
    timeoutMs: DEFAULT_TIMEOUT,
  });

  if (resp.statusCode >= 400) {
    throw new MunicipalCouncilError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
    );
  }

  return resp.body;
}

async function fetchJson<T = unknown>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const resp = await httpGet(url, {
    headers: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
      Accept: 'application/json,*/*',
      ...headers,
    },
    timeoutMs: DEFAULT_TIMEOUT,
  });

  if (resp.statusCode >= 400) {
    throw new MunicipalCouncilError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
    );
  }

  return JSON.parse(resp.body) as T;
}


/* ------------------------------------------------------------------ */
/*  City-Specific Fetchers                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch Toronto council meeting list page HTML.
 *
 * Toronto publishes meeting agendas and decisions on their city website
 * at toronto.ca/city-government/council/meeting-agendas/.
 */
async function fetchTorontoMeetings(year: number): Promise<RawCouncilRecord[]> {
  const config = getCityConfig('toronto');
  const url = config.apiEndpoints.meetingsList;
  const html = await fetchText(url, config.customHeaders);

  // Toronto meeting list — return the raw HTML for the parser
  return [{
    city: 'toronto',
    rawHtml: html,
    sourceUrl: url,
  }];

  // Future enhancement: also try the RSS calendar feed
  // const rssUrl = config.apiEndpoints.calendarRss;
  // const rssXml = await fetchText(rssUrl, config.customHeaders);
}

/**
 * Fetch Toronto meeting detail page.
 */
async function fetchTorontoMeetingDetail(meetingId: string): Promise<RawCouncilRecord> {
  const config = getCityConfig('toronto');
  const url = meetingDetailUrl('toronto', meetingId);
  if (!url) throw new MunicipalCouncilError('No meeting detail URL for Toronto');
  const html = await fetchText(url, config.customHeaders);

  return {
    city: 'toronto',
    rawHtml: html,
    meetingId,
    sourceUrl: url,
  };
}

/**
 * Fetch Vancouver council meeting list page HTML.
 *
 * Vancouver publishes at vancouver.ca/your-government/meeting-agendas-and-minutes.aspx
 * and also maintains meeting documents on council.vancouver.ca.
 */
async function fetchVancouverMeetings(year: number): Promise<RawCouncilRecord[]> {
  const config = getCityConfig('vancouver');
  const url = config.apiEndpoints.meetingsList;
  const html = await fetchText(url, config.customHeaders);

  return [{
    city: 'vancouver',
    rawHtml: html,
    sourceUrl: url,
  }];
}

/**
 * Fetch Vancouver meeting detail from council.vancouver.ca.
 */
async function fetchVancouverMeetingDetail(meetingId: string): Promise<RawCouncilRecord> {
  const config = getCityConfig('vancouver');
  // Vancouver uses council.vancouver.ca/YYYY/MeetingID/ for meeting details
  const url = `https://council.vancouver.ca/2025/Meeting${meetingId}/`;
  const html = await fetchText(url, config.customHeaders);

  return {
    city: 'vancouver',
    rawHtml: html,
    meetingId,
    sourceUrl: url,
  };
}


/* ------------------------------------------------------------------ */
/*  Montreal Fetcher — CKAN + HTML Fallback                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch Montreal council meetings using CKAN open data portal
 * (donnees.montreal.ca) with HTML fallback.
 *
 * Montreal publishes a calendar of council/executive/agglomeration sessions
 * as a CKAN CSV dataset. We query the CKAN API to find the resource URL,
 * fetch the CSV, and parse each row into a RawCouncilRecord.
 */
async function fetchMontrealMeetings(year: number): Promise<RawCouncilRecord[]> {
  const records: RawCouncilRecord[] = [];
  const config = getCityConfig('montreal');

  // Try CKAN API first
  try {
    const ckanUrl = 'https://donnees.montreal.ca/api/3/action/package_show?id=ef6ce312-9737-4253-8b25-94ba17eec23e';
    const ckanResp = await fetchJson<{
      success: boolean;
      result: { resources: Array<{ url: string; format: string }> };
    }>(ckanUrl);

    if (ckanResp.success && ckanResp.result?.resources?.length > 0) {
      // Find the CSV resource
      const csvResource = ckanResp.result.resources.find(
        (r: { format: string }) => r.format === 'CSV',
      );
      if (csvResource?.url) {
        const csvText = await fetchText(csvResource.url);
        // Parse CSV lines
        const lines = csvText.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
          const headers = parseCsvLine(lines[0]);
          for (let i = 1; i < lines.length; i++) {
            const row = parseCsvLine(lines[i]);
            const rowMap: Record<string, string> = {};
            headers.forEach((h, idx) => { rowMap[h.trim()] = (row[idx] ?? '').trim(); });

            const dateStr = rowMap['date'] || '';
            const title = rowMap['seance'] || 'Séance du conseil municipal';
            const videoLink = rowMap['lien_video_seance'] || '';
            const cityLink = rowMap['lien_site_ville'] || '';

            // Only include meetings from the requested year
            if (!dateStr.startsWith(String(year))) continue;

            const meetingId = await computeHash(
              `montreal:${dateStr}:${title}`,
              'sha256',
            );

            records.push({
              city: 'montreal',
              sourceUrl: cityLink || ckanUrl,
              date: dateStr,
              title,
              meetingId,
              meetingType: title.toLowerCase().includes('comité exécutif')
                ? 'committee'
                : title.toLowerCase().includes('commission')
                  ? 'standing-committee'
                  : 'council',
              videoUrl: videoLink || undefined,
              rawJson: JSON.stringify(rowMap),
            });
          }
        }
      }
    }
  } catch {
    // CKAN failed — fall through to HTML scraping
  }

  // HTML fallback: fetch the city council page
  if (records.length === 0) {
    try {
      const html = await fetchText(config.meetingsUrl, config.customHeaders);
      records.push({
        city: 'montreal',
        rawHtml: html,
        sourceUrl: config.meetingsUrl,
      });
    } catch {
      // Both methods failed — return empty
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  Quebec City Fetcher — CKAN + HTML Fallback                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch Quebec City council meetings using CKAN open data portal
 * (donnees.ville.quebec.qc.ca) with HTML fallback.
 */
async function fetchQuebecCityMeetings(year: number): Promise<RawCouncilRecord[]> {
  const records: RawCouncilRecord[] = [];
  const config = getCityConfig('quebec-city');

  // Try CKAN API for Quebec City open data
  try {
    const ckanUrl = 'https://donnees.ville.quebec.qc.ca/api/3/action/package_search?q=conseil+municipal+seance&rows=10';
    const ckanResp = await fetchJson<{
      success: boolean;
      result: { results: Array<{ title: string; resources: Array<{ url: string; format: string }> }> };
    }>(ckanUrl);

    if (ckanResp.success && ckanResp.result?.results?.length > 0) {
      for (const pkg of ckanResp.result.results) {
        for (const resource of pkg.resources ?? []) {
          if (resource.format === 'CSV' && resource.url) {
            try {
              const csvText = await fetchText(resource.url);
              const lines = csvText.split('\n').filter(l => l.trim());
              if (lines.length > 1) {
                const headers = parseCsvLine(lines[0]);
                for (let i = 1; i < lines.length; i++) {
                  const row = parseCsvLine(lines[i]);
                  const rowMap: Record<string, string> = {};
                  headers.forEach((h, idx) => { rowMap[h.trim()] = (row[idx] ?? '').trim(); });

                  const dateStr = Object.values(rowMap).find(v =>
                    /^\d{4}-\d{2}-\d{2}/.test(v),
                  ) || '';
                  if (!dateStr.startsWith(String(year))) continue;

                  const title = rowMap['titre'] || rowMap['title'] || pkg.title || 'Séance du conseil municipal';
                  const meetingId = await computeHash(
                    `quebec-city:${dateStr}:${title}`,
                    'sha256',
                  );

                  records.push({
                    city: 'quebec-city',
                    sourceUrl: resource.url,
                    date: dateStr,
                    title,
                    meetingId,
                    rawJson: JSON.stringify(rowMap),
                  });
                }
              }
            } catch {
              // Skip this resource
            }
          }
        }
      }
    }
  } catch {
    // CKAN failed — fall through to HTML scraping
  }

  // HTML fallback
  if (records.length === 0) {
    try {
      const html = await fetchText(config.meetingsUrl, config.customHeaders);
      records.push({
        city: 'quebec-city',
        rawHtml: html,
        sourceUrl: config.meetingsUrl,
      });
    } catch {
      // Both methods failed
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  Vendor API Fetchers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse eScribe meeting list HTML into structured RawCouncilRecord entries.
 *
 * eScribe (escribemeetings.com) is used by many Ontario and Alberta cities:
 * Calgary, Edmonton, Ottawa, Hamilton. The meeting list page typically
 * contains tables with columns: date, meeting name, and links to
 * agenda/minutes documents.
 */
function parseEscribeHtml(html: string, city: CityCode, baseUrl: string, sourceUrl: string): RawCouncilRecord[] {
  const records: RawCouncilRecord[] = [];

  // Pattern 1: eScribe table rows — typically <tr> elements in a meeting list table
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRowPattern.exec(html)) !== null) {
    const rowContent = match[1];
    const cells = rowContent.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (!cells || cells.length < 2) continue;

    const cellTexts = cells.map(c => c.replace(/<[^>]+>/g, '').trim());

    // Look for a date in any cell
    const dateStr = cellTexts.find(t => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(t))
      ?? cellTexts.find(t => /\b\d{4}\b/.test(t))
      ?? '';

    if (!dateStr) continue;

    // Find title (first non-date, non-empty cell with meaningful text)
    const title = cellTexts.find(t =>
      t.length > 3 && t.length < 200 && !/^\d{4}[-/]/.test(t),
    ) ?? 'Council Meeting';

    // Extract meeting links
    const linkMatches = rowContent.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
    const links = Array.from(linkMatches, m => m[1]);

    const agendaLink = links.find(l => /agenda/i.test(l));
    const minutesLink = links.find(l => /minutes/i.test(l));

    // Extract meeting ID from links
    const idLink = links.find(l => /[Ii][Dd]=\d+/.test(l));
    const idMatch = idLink ? idLink.match(/[Ii][Dd]=(\d+)/) : null;
    const meetingId = idMatch?.[1] ?? title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    records.push({
      city,
      rawHtml: rowContent,
      sourceUrl,
      date: dateStr,
      title,
      meetingType: /committee|standing|sub.?committee/i.test(title)
        ? 'standing-committee'
        : /budget/i.test(title)
          ? 'budget'
          : /board/i.test(title)
            ? 'board'
            : 'council',
      meetingId,
      agenda_url: agendaLink
        ? (agendaLink.startsWith('http') ? agendaLink : `${baseUrl}${agendaLink.startsWith('/') ? '' : '/'}${agendaLink}`)
        : undefined,
      minutes_url: minutesLink
        ? (minutesLink.startsWith('http') ? minutesLink : `${baseUrl}${minutesLink.startsWith('/') ? '' : '/'}${minutesLink}`)
        : undefined,
    });
  }

  // Pattern 2: eScribe meeting list items — <div> or <li> based layouts
  if (records.length === 0) {
    const itemPattern = /<(?:div|li|article)[^>]*class="[^"]*meeting[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li|article)>/gi;
    while ((match = itemPattern.exec(html)) !== null) {
      const content = match[1];
      const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      const dateMatch = textContent.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
      if (!dateMatch) continue;

      const titleMatch = textContent.match(/^(.{10,150}?)(?:\s*\d{4}|$)/);
      const title = titleMatch?.[1]?.trim() ?? 'Council Meeting';

      const linkMatches = content.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
      const links = Array.from(linkMatches, m => m[1]);
      const agendaLink = links.find(l => /agenda/i.test(l));
      const minutesLink = links.find(l => /minutes/i.test(l));

      records.push({
        city,
        rawHtml: content,
        sourceUrl,
        date: dateMatch[1],
        title,
        meetingType: 'council',
        meetingId: title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
        agenda_url: agendaLink
          ? (agendaLink.startsWith('http') ? agendaLink : `${baseUrl}${agendaLink.startsWith('/') ? '' : '/'}${agendaLink}`)
          : undefined,
        minutes_url: minutesLink
          ? (minutesLink.startsWith('http') ? minutesLink : `${baseUrl}${minutesLink.startsWith('/') ? '' : '/'}${minutesLink}`)
          : undefined,
      });
    }
  }

  return records;
}

/**
 * Fetch meetings via eScribe vendor API for a specific city.
 *
 * eScribe (escribemeetings.com) is used by many Ontario and Alberta
 * cities: Calgary, Edmonton, Ottawa, Hamilton.  We fetch the meeting list
 * HTML and parse it into structured records.
 */
async function fetchEscribeMeetings(
  baseUrl: string,
  year: number,
  city: CityCode,
): Promise<RawCouncilRecord[]> {
  const urlsToTry = [
    `${baseUrl}/Meetings?year=${year}`,
    `${baseUrl}/Meetings`,
    `${baseUrl}`,
  ];

  for (const url of urlsToTry) {
    try {
      const html = await fetchText(url);
      const records = parseEscribeHtml(html, city, baseUrl, url);
      if (records.length > 0) return records;
    } catch {
      // Try next URL
    }
  }

  // Ultimate fallback: try fetching with meeting list endpoint patterns
  try {
    const altUrl = `${baseUrl}/MeetingList/?year=${year}`;
    const html = await fetchText(altUrl);
    const records = parseEscribeHtml(html, city, baseUrl, altUrl);
    if (records.length > 0) return records;
  } catch {
    // Nothing worked — return empty
  }

  return [];
}

/**
 * Parse CivicWeb meeting list HTML into structured RawCouncilRecord entries.
 *
 * CivicWeb (civicweb.net) is used by Winnipeg and Halifax.
 * Meeting list pages typically show tables with meeting dates and links.
 */
function parseCivicWebHtml(html: string, city: CityCode, sourceUrl: string): RawCouncilRecord[] {
  const records: RawCouncilRecord[] = [];

  // Pattern 1: CivicWeb table-based meeting lists
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRowPattern.exec(html)) !== null) {
    const rowContent = match[1];
    const cells = rowContent.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (!cells || cells.length < 2) continue;

    const cellTexts = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
    const dateStr = cellTexts.find(t => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(t))
      ?? cellTexts.find(t => /\b\d{4}\b/.test(t))
      ?? '';

    if (!dateStr) continue;

    const title = cellTexts.find(t =>
      t.length > 3 && t.length < 200 && !/^\d{4}[-/]/.test(t),
    ) ?? 'Council Meeting';

    // Extract links
    const linkMatches = rowContent.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
    const links = Array.from(linkMatches, m => m[1]);

    const meetingLink = links[0] ?? '';
    const meetingId = meetingLink.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      || title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    records.push({
      city,
      rawHtml: rowContent,
      sourceUrl,
      date: dateStr,
      title,
      meetingType: /committee|standing|sub.?committee/i.test(title)
        ? 'standing-committee'
        : /budget/i.test(title)
          ? 'budget'
          : /board/i.test(title)
            ? 'board'
            : 'council',
      meetingId,
    });
  }

  // Pattern 2: CivicWeb meeting cards/items
  if (records.length === 0) {
    const itemPattern = /<(?:div|li|article)[^>]*class="[^"]*(?:meeting|calendar|event)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li|article)>/gi;
    while ((match = itemPattern.exec(html)) !== null) {
      const content = match[1];
      const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      const dateMatch = textContent.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
      if (!dateMatch) continue;

      const titleMatch = textContent.match(/^(.{10,150}?)(?:\s*\d{4}|$)/);
      const title = titleMatch?.[1]?.trim() ?? 'Council Meeting';

      records.push({
        city,
        rawHtml: content,
        sourceUrl,
        date: dateMatch[1],
        title,
        meetingType: 'council',
        meetingId: title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
      });
    }
  }

  return records;
}

/**
 * Fetch meetings via CivicWeb vendor API for a specific city.
 *
 * CivicWeb (civicweb.net) is used by Winnipeg and Halifax.
 * We fetch the meeting list HTML and parse it into structured records.
 */
async function fetchCivicWebMeetings(
  baseUrl: string,
  year: number,
  city: CityCode,
): Promise<RawCouncilRecord[]> {
  const urlsToTry = [
    `${baseUrl}/Meetings`,
    `${baseUrl}/meetings`,
    `${baseUrl}/calendar`,
    `${baseUrl}/Council/Meetings`,
    baseUrl,
  ];

  for (const url of urlsToTry) {
    try {
      const html = await fetchText(url);
      const records = parseCivicWebHtml(html, city, url);
      if (records.length > 0) return records;
    } catch {
      // Try next URL
    }
  }

  return [];
}

/**
 * Fetch meetings via iCompass vendor API.
 *
 * iCompass (icompass.ca) is used by some BC cities. We attempt to query
 * their JSON API first, then fall back to HTML scraping.
 */
async function fetchICompassMeetings(
  baseUrl: string,
  year: number,
  city: CityCode,
): Promise<RawCouncilRecord[]> {
  // Try iCompass API endpoint
  const apiUrl = `${baseUrl}/api/meetings?year=${year}`;
  try {
    const data = await fetchJson<unknown[]>(apiUrl);
    if (Array.isArray(data) && data.length > 0) {
      return (data as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
        city,
        rawJson: JSON.stringify(item),
        sourceUrl: apiUrl,
        date: typeof item['Date'] === 'string' ? item['Date'] as string
          : typeof item['date'] === 'string' ? item['date'] as string
            : typeof item['MeetingDate'] === 'string' ? item['MeetingDate'] as string
              : '',
        title: typeof item['Name'] === 'string' ? item['Name'] as string
          : typeof item['name'] === 'string' ? item['name'] as string
            : typeof item['Title'] === 'string' ? item['Title'] as string
              : 'Council Meeting',
        meetingId: typeof item['Id'] === 'string' ? item['Id'] as string
          : typeof item['id'] === 'string' ? item['id'] as string
            : typeof item['MeetingId'] === 'string' ? item['MeetingId'] as string
              : String(Math.random()).slice(2),
      }));
    }
  } catch {
    // API failed — fall through to HTML scraping
  }

  // Fall back to HTML scraping
  try {
    const html = await fetchText(baseUrl);
    return [{
      city,
      rawHtml: html,
      sourceUrl: baseUrl,
    }];
  } catch {
    return [];
  }
}


/* ------------------------------------------------------------------ */
/*  Main Fetcher — Dispatches by City                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch council meeting data for a given city and year.
 *
 * Strategy:
 *   1. Use the city-specific scraper if implemented (Toronto, Vancouver,
 *      Montreal, Quebec City)
 *   2. Fall back to vendor API detection and calling (eScribe, CivicWeb, iCompass)
 *   3. Return raw records for parsing
 */
export async function fetchCityMeetings(
  city: CityCode,
  year: number = new Date().getFullYear(),
): Promise<{
  source: string;
  records: RawCouncilRecord[];
  sourcesTried: string[];
  errors: string[];
}> {
  const sourcesTried: string[] = [];
  const errors: string[] = [];
  let records: RawCouncilRecord[] = [];

  try {
    switch (city) {
      /* ---------- Custom Implementation Cities ---------- */
      case 'toronto': {
        sourcesTried.push('toronto-custom');
        records = await fetchTorontoMeetings(year);
        break;
      }

      case 'vancouver': {
        sourcesTried.push('vancouver-custom');
        records = await fetchVancouverMeetings(year);
        break;
      }

      case 'montreal': {
        sourcesTried.push('montreal-custom');
        sourcesTried.push('montreal-ckan');
        records = await fetchMontrealMeetings(year);
        break;
      }

      case 'quebec-city': {
        sourcesTried.push('quebec-city-custom');
        sourcesTried.push('quebec-city-ckan');
        records = await fetchQuebecCityMeetings(year);
        break;
      }

      /* ---------- eScribe Vendor Cities ---------- */
      case 'calgary':
      case 'edmonton':
      case 'ottawa':
      case 'hamilton': {
        sourcesTried.push('escribe');
        const config = getCityConfig(city);
        const escribeBase = config.apiEndpoints.escribeBase ?? config.meetingsUrl;
        records = await fetchEscribeMeetings(escribeBase, year, city);
        records = records.map(r => ({ ...r, city }));
        break;
      }

      /* ---------- CivicWeb Vendor Cities ---------- */
      case 'winnipeg':
      case 'halifax': {
        sourcesTried.push('civicweb');
        const config = getCityConfig(city);
        records = await fetchCivicWebMeetings(config.baseUrl, year, city);
        records = records.map(r => ({ ...r, city }));
        break;
      }

      default:
        throw new MunicipalCouncilError(`Unsupported city: ${city}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`fetchCityMeetings(${city}): ${msg}`);
  }

  return {
    source: city,
    records,
    sourcesTried,
    errors,
  };
}

/**
 * Fetch detail for a specific meeting.
 */
export async function fetchMeetingDetail(
  city: CityCode,
  meetingId: string,
): Promise<RawCouncilRecord | null> {
  try {
    switch (city) {
      case 'toronto':
        return await fetchTorontoMeetingDetail(meetingId);
      case 'vancouver':
        return await fetchVancouverMeetingDetail(meetingId);
      case 'montreal': {
        const config = getCityConfig('montreal');
        const html = await fetchText(config.meetingsUrl, config.customHeaders);
        return { city, rawHtml: html, meetingId, sourceUrl: config.meetingsUrl };
      }
      case 'calgary':
      case 'edmonton':
      case 'ottawa':
      case 'hamilton': {
        const config = getCityConfig(city);
        const detailUrl = meetingDetailUrl(city, meetingId);
        if (!detailUrl) return null;
        const html = await fetchText(detailUrl, config.customHeaders);
        return { city, rawHtml: html, meetingId, sourceUrl: detailUrl };
      }
      case 'winnipeg': {
        const url = `https://www.winnipeg.ca/council/meetings/${meetingId}`;
        const html = await fetchText(url);
        return { city, rawHtml: html, meetingId, sourceUrl: url };
      }
      case 'halifax': {
        const url = `https://www.halifax.ca/city-hall/agendas-minutes/${meetingId}`;
        const html = await fetchText(url);
        return { city, rawHtml: html, meetingId, sourceUrl: url };
      }
      case 'quebec-city': {
        const config = getCityConfig('quebec-city');
        const html = await fetchText(config.meetingsUrl, config.customHeaders);
        return { city, rawHtml: html, meetingId, sourceUrl: config.meetingsUrl };
      }
      default:
        throw new NotYetImplementedError(city);
    }
  } catch (err) {
    return null;
  }
}
