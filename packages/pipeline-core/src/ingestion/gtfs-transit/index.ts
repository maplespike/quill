// SPDX-License-Identifier: AGPL-3.0-only

import { GTFS_AGENCIES, GTFS_TIMEOUT_MS, GTFS_USER_AGENT, GTFS_FEED_URLS } from './constants.js';
import { fetchGtfsFeed } from './fetcher.js';
import { parseGtfsZip } from './parser.js';
import type { GTFSRoute, GTFSStop, GTFSTrip, GTFSCalendar, GtfsIngestionResult } from './types.js';

export async function ingestGTFSAgency(agencyId: string): Promise<GtfsIngestionResult> {
  const start = Date.now();
  const agency = GTFS_AGENCIES.find(a => a.id === agencyId);

  if (!agency) {
    return {
      agencyId, agencyName: agencyId, province: '',
      routes: [], stops: [], trips: [], calendars: [],
      errors: [`Unknown agency: ${agencyId}`], durationMs: Date.now() - start,
    };
  }

  const feedUrl = GTFS_FEED_URLS[agencyId];
  if (!feedUrl) {
    return {
      agencyId, agencyName: agency.name, province: agency.province,
      routes: [], stops: [], trips: [], calendars: [],
      errors: [`No feed URL configured for: ${agencyId}`], durationMs: Date.now() - start,
    };
  }

  try {
    const result = await fetchGtfsFeed(agencyId);
    if (result.error || !result.body) {
      return {
        agencyId, agencyName: agency.name, province: agency.province,
        routes: [], stops: [], trips: [], calendars: [],
        errors: [result.error || 'Empty response'], durationMs: Date.now() - start,
      };
    }

    const parsed = parseGtfsZip(result.body, agency.name);
    return {
      agencyId, agencyName: agency.name, province: agency.province,
      ...parsed, errors: parsed.errors, durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      agencyId, agencyName: agency.name, province: agency.province,
      routes: [], stops: [], trips: [], calendars: [],
      errors: [String(err)], durationMs: Date.now() - start,
    };
  }
}

export async function ingestAllAgencies(): Promise<GtfsIngestionResult[]> {
  const results: GtfsIngestionResult[] = [];
  for (const agency of GTFS_AGENCIES) {
    const result = await ingestGTFSAgency(agency.id);
    results.push(result);
  }
  return results;
}

export { GTFS_AGENCIES, GTFS_FEED_URLS, GTFS_TIMEOUT_MS, GTFS_USER_AGENT } from './constants.js';
export { fetchGtfsFeed } from './fetcher.js';
export { parseGtfsRouteCsv, parseGtfsStopCsv, parseGtfsZip } from './parser.js';
export type { GTFSRoute, GTFSStop, GTFSTrip, GTFSCalendar, GtfsIngestionResult } from './types.js';
