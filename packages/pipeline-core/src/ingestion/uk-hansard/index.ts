// SPDX-License-Identifier: AGPL-3.0-only
/**
 * UK Hansard API Ingestion Module (1803-2005)
 *
 * Ingests historic UK parliamentary debates from Hansard API.
 * No authentication required - public data.
 *
 * Data includes:
 * - Parliamentary debates (House of Commons, House of Lords)
 * - Member contributions
 * - Daily debates 1803-2005
 *
 * API Documentation: https://api.parliament.uk/historic-hansard/api
 */

import { httpGet } from '../../utils/http.js';

const HANSARD_API_BASE = 'https://api.parliament.uk/historic-hansard/api';
const HANSARD_TIMEOUT_MS = 20_000;
const HANSARD_USER_AGENT = 'MapleSpike-Hansard/1.0 (+https://github.com/reverb256/quill)';

interface HansardDebate {
  id: string;
  date: string;
  house: 'commons' | 'lords';
  title: string;
  volume: string;
  column: string;
  members?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

interface HansardMember {
  id: string;
  name: string;
  titles: string[];
  constituency: string;
  party: string;
  years: {
    start: number;
    end: number;
  };
}

interface HansardDailyHansard {
  date: string;
  house: 'commons' | 'lords';
  debates: HansardDebate[];
}

/**
 * Search debates by keyword across all years.
 * @param query - Search query string
 * @param house - House to search ('commons', 'lords', or 'both')
 * @param yearStart - Start year (default: 1803)
 * @param yearEnd - End year (default: 2005)
 * @returns Array of matching debates
 */
export async function searchDebates(
  query: string,
  house: 'commons' | 'lords' | 'both' = 'both',
  yearStart = 1803,
  yearEnd = 2005,
): Promise<HansardDebate[]> {
  const url = `${HANSARD_API_BASE}/search?query=${encodeURIComponent(query)}&house=${house}&yearFrom=${yearStart}&yearTo=${yearEnd}`;

  const resp = await httpGet(url, {
    timeoutMs: HANSARD_TIMEOUT_MS,
    headers: {
      'User-Agent': HANSARD_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`Hansard API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);
  return data.results || [];
}

/**
 * Get debates for a specific date.
 * @param date - Date in format YYYY-MM-DD
 * @param house - House ('commons' or 'lords')
 * @returns Daily debates
 */
export async function getDebatesByDate(
  date: string,
  house: 'commons' | 'lords' = 'commons',
): Promise<HansardDailyHansard | null> {
  const url = `${HANSARD_API_BASE}/debates/${house}/${date}`;

  const resp = await httpGet(url, {
    timeoutMs: HANSARD_TIMEOUT_MS,
    headers: {
      'User-Agent': HANSARD_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode === 404) {
    return null;
  }

  if (resp.statusCode >= 400) {
    throw new Error(`Hansard API error: HTTP ${resp.statusCode}`);
  }

  return JSON.parse(resp.body);
}

/**
 * Get member information by ID.
 * @param memberId - Member identifier
 * @returns Member details
 */
export async function getMember(memberId: string): Promise<HansardMember | null> {
  const url = `${HANSARD_API_BASE}/members/${memberId}`;

  const resp = await httpGet(url, {
    timeoutMs: HANSARD_TIMEOUT_MS,
    headers: {
      'User-Agent': HANSARD_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode === 404) {
    return null;
  }

  if (resp.statusCode >= 400) {
    throw new Error(`Hansard API error: HTTP ${resp.statusCode}`);
  }

  return JSON.parse(resp.body);
}

/**
 * Search members by name.
 * @param name - Member name to search
 * @returns Array of matching members
 */
export async function searchMembers(name: string): Promise<HansardMember[]> {
  const url = `${HANSARD_API_BASE}/members/search?name=${encodeURIComponent(name)}`;

  const resp = await httpGet(url, {
    timeoutMs: HANSARD_TIMEOUT_MS,
    headers: {
      'User-Agent': HANSARD_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`Hansard API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);
  return data.results || [];
}

/**
 * Get debates by member ID.
 * @param memberId - Member identifier
 * @param limit - Maximum number of debates to return
 * @returns Array of debates
 */
export async function getDebatesByMember(memberId: string, limit = 50): Promise<HansardDebate[]> {
  const url = `${HANSARD_API_BASE}/members/${memberId}/debates?limit=${limit}`;

  const resp = await httpGet(url, {
    timeoutMs: HANSARD_TIMEOUT_MS,
    headers: {
      'User-Agent': HANSARD_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`Hansard API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);
  return data.results || [];
}

export interface GetDebatesByMemberResult {
  memberId: string;
  debates: HansardDebate[];
  total: number;
}