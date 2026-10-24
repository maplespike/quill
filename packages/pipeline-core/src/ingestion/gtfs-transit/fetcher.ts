// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { GTFS_AGENCIES, GTFS_FEED_URLS, GTFS_TIMEOUT_MS, GTFS_USER_AGENT } from './constants.js';

export interface GtfsFetchResult {
  agencyId: string;
  agencyName: string;
  fetchUrl: string;
  error?: string;
  body?: Buffer;
}

export async function fetchGtfsFeed(agencyId: string): Promise<GtfsFetchResult> {
  const agency = GTFS_AGENCIES.find(a => a.id === agencyId);
  if (!agency) {
    return { agencyId, agencyName: agencyId, fetchUrl: '', error: `Unknown agency: ${agencyId}` };
  }

  const url = GTFS_FEED_URLS[agencyId];
  if (!url) {
    return { agencyId, agencyName: agency.name, fetchUrl: '', error: `No feed URL for: ${agencyId}` };
  }

  try {
    const resp = await httpGet(url, {
      timeoutMs: GTFS_TIMEOUT_MS,
      headers: { 'User-Agent': GTFS_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { agencyId, agencyName: agency.name, fetchUrl: url, error: `HTTP ${resp.statusCode}` };
    }

    const body = Buffer.from(resp.body, 'binary');
    return { agencyId, agencyName: agency.name, fetchUrl: url, body };
  } catch (err) {
    return { agencyId, agencyName: agency.name, fetchUrl: url, error: String(err) };
  }
}

export async function fetchAllGtfsFeeds(): Promise<GtfsFetchResult[]> {
  const results: GtfsFetchResult[] = [];
  for (const agency of GTFS_AGENCIES) {
    const result = await fetchGtfsFeed(agency.id);
    results.push(result);
  }
  return results;
}
