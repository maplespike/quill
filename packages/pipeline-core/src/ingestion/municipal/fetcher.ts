/**
 * Municipal Council Data Fetcher — MapleSpike Pipeline
 *
 * Fetches meeting data from Canadian city council sources.  Each city is
 * different — this module tries city-specific HTML scraping first, then
 * falls back to vendor API calls (eScribe, iCompass, CivicWeb) if the
 * vendor is known for that city.
 *
 * Currently implemented: Toronto, Vancouver
 * Framework-ready stubs: Montreal, Calgary, Edmonton, Ottawa, Winnipeg,
 *                        Quebec City, Hamilton, Halifax
 */

import { httpGet } from '../../utils/http.js';
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

  return resp.json<T>();
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
/*  Vendor API Fetchers (Framework Stubs)                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch meetings via eScribe vendor API.
 *
 * eScribe (escribemeetings.com) is used by many Ontario and Alberta
 * cities: Calgary, Edmonton, Ottawa, Hamilton.  The exact API surface
 * varies by deployment — some expose JSON endpoints, others require
 * HTML scraping with specific query parameters.
 */
async function fetchEscribeMeetings(
  baseUrl: string,
  year: number,
): Promise<RawCouncilRecord[]> {
  // eScribe typically has a /Meetings endpoint with date filtering
  // Format: https://pub-{city}.escribemeetings.com/Meetings?year={year}
  const url = `${baseUrl}/Meetings?year=${year}`;

  try {
    const html = await fetchText(url);
    return [{
      rawHtml: html,
      sourceUrl: url,
    }];
  } catch {
    // Try alternative URL pattern
    const altUrl = `${baseUrl}`;
    const html = await fetchText(altUrl);
    return [{
      rawHtml: html,
      sourceUrl: altUrl,
    }];
  }
}

/**
 * Fetch meetings via iCompass vendor API (BC cities).
 */
async function fetchICompassMeetings(
  baseUrl: string,
  year: number,
): Promise<RawCouncilRecord[]> {
  // iCompass API endpoint pattern varies by municipality
  const url = `${baseUrl}/api/meetings?year=${year}`;
  try {
    const data = await fetchJson<unknown[]>(url);
    return [{
      rawJson: JSON.stringify(data),
      sourceUrl: url,
    }];
  } catch {
    // Fall back to HTML scraping
    const html = await fetchText(baseUrl);
    return [{
      rawHtml: html,
      sourceUrl: baseUrl,
    }];
  }
}

/**
 * Fetch meetings via CivicWeb vendor API.
 */
async function fetchCivicWebMeetings(
  baseUrl: string,
  year: number,
): Promise<RawCouncilRecord[]> {
  const url = `${baseUrl}/Meetings`;
  const html = await fetchText(url);
  return [{
    rawHtml: html,
    sourceUrl: url,
  }];
}


/* ------------------------------------------------------------------ */
/*  Main Fetcher — Dispatches by City                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch council meeting data for a given city and year.
 *
 * Strategy:
 *   1. Use the city-specific scraper if implemented (Toronto, Vancouver)
 *   2. Fall back to vendor API detection and calling
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
      /* ---------- Implemented Cities ---------- */
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

      /* ---------- Framework Stubs — Not Yet Implemented ---------- */
      case 'montreal': {
        sourcesTried.push('montreal-custom');
        const config = getCityConfig(city);
        const html = await fetchText(config.meetingsUrl, config.customHeaders);
        records = [{ city, rawHtml: html, sourceUrl: config.meetingsUrl }];
        break;
      }

      case 'calgary':
      case 'edmonton':
      case 'ottawa':
      case 'hamilton': {
        sourcesTried.push('escribe');
        const config = getCityConfig(city);
        const escribeBase = config.apiEndpoints.escribeBase ?? config.meetingsUrl;
        records = await fetchEscribeMeetings(escribeBase, year);
        records = records.map(r => ({ ...r, city }));
        break;
      }

      case 'winnipeg':
      case 'halifax': {
        sourcesTried.push('civicweb');
        const config = getCityConfig(city);
        records = await fetchCivicWebMeetings(config.baseUrl, year);
        records = records.map(r => ({ ...r, city }));
        break;
      }

      case 'quebec-city': {
        sourcesTried.push('montreal-custom');
        const config = getCityConfig(city);
        const html = await fetchText(config.meetingsUrl, config.customHeaders);
        records = [{ city, rawHtml: html, sourceUrl: config.meetingsUrl }];
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
      default:
        throw new NotYetImplementedError(city);
    }
  } catch (err) {
    return null;
  }
}
