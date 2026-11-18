// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { parseCrtcReports, parseCrtcOwnership, parseCmfData, parseTelefilm } from './parser.js';
import type { MediaRecord, MediaIngestionResult } from './types.js';
import { MEDIA_SOURCES, MEDIA_FETCH_TIMEOUT_MS, MEDIA_USER_AGENT, MAX_MEDIA_RECORDS } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': MEDIA_USER_AGENT }, timeoutMs: MEDIA_FETCH_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

async function fetchAndParseCrtcReports(): Promise<MediaRecord[]> {
  const html = await fetchText('https://crtc.gc.ca/eng/publications/reports/policymonitoring/cmrd.htm');
  if (!html) return [];
  return parseCrtcReports(html, MAX_MEDIA_RECORDS);
}

async function fetchAndParseCrtcOwnership(): Promise<MediaRecord[]> {
  const html = await fetchText('https://crtc.gc.ca/ownership/eng/');
  if (!html) return [];
  return parseCrtcOwnership(html, MAX_MEDIA_RECORDS);
}

async function fetchAndParseCmfData(): Promise<MediaRecord[]> {
  const html = await fetchText('https://www.cmf-fmc.ca/open-data');
  if (!html) return [];
  return parseCmfData(html, MAX_MEDIA_RECORDS);
}

async function fetchAndParseTelefilm(): Promise<MediaRecord[]> {
  const html = await fetchText('https://telefilm.ca/en/studies-and-reports');
  if (!html) return [];
  return parseTelefilm(html, MAX_MEDIA_RECORDS);
}

export async function fetchAllMedia(): Promise<MediaIngestionResult> {
  const start = Date.now();
  const allRecords: MediaRecord[] = [];
  const errors: { source: string; error: string }[] = [];

  const results = await Promise.allSettled([
    fetchAndParseCrtcReports().then(r => ({ source: 'crtc-market-reports' as const, records: r })),
    fetchAndParseCrtcOwnership().then(r => ({ source: 'crtc-ownership' as const, records: r })),
    fetchAndParseCmfData().then(r => ({ source: 'canada-media-fund' as const, records: r })),
    fetchAndParseTelefilm().then(r => ({ source: 'telefilm' as const, records: r })),
  ]);

  let succeeded = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allRecords.push(...r.value.records);
      if (r.value.records.length > 0) succeeded++;
    } else {
      errors.push({ source: 'unknown', error: r.reason?.message ?? 'unknown' });
    }
  }

  return { records: allRecords, sourcesAttempted: MEDIA_SOURCES.length, sourcesSucceeded: succeeded, errors, durationMs: Date.now() - start };
}
