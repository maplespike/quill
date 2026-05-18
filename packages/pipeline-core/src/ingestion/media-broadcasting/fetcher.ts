import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { MediaRecord, MediaIngestionResult } from './types.js';
import { MEDIA_SOURCES, MEDIA_FETCH_TIMEOUT_MS, MEDIA_USER_AGENT, MAX_MEDIA_RECORDS } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': MEDIA_USER_AGENT }, timeoutMs: MEDIA_FETCH_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

async function fetchAndParseCrtcReports(): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const html = await fetchText('https://crtc.gc.ca/eng/publications/reports/policymonitoring/cmrd.htm');
  if (!html) return records;
  const now = new Date().toISOString();
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(communication|broadcasting|telecom|media|internet|wireless|revenue|audience)/i.test(t)) continue;
    const year = t.match(/\b(20\d{2})\b/)?.[1];
    records.push({
      source: 'crtc-market-reports', title: t, url: m[1].startsWith('http') ? m[1] : `https://crtc.gc.ca${m[1]}`,
      year: year ? parseInt(year) : new Date().getFullYear(), description: 'CRTC market report', hash: await computeHash(`crtc-${t}`, 'sha256'), ingestedAt: now,
    });
  }
  return records.slice(0, MAX_MEDIA_RECORDS);
}

async function fetchAndParseCrtcOwnership(): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const html = await fetchText('https://crtc.gc.ca/ownership/eng/');
  if (!html) return records;
  const now = new Date().toISOString();
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 5 || !/(ownership|group|radio|tv|cable|satellite|broadcaster|publisher)/i.test(t)) continue;
    records.push({
      source: 'crtc-ownership', title: t, url: m[1].startsWith('http') ? m[1] : `https://crtc.gc.ca${m[1]}`,
      year: new Date().getFullYear(), description: 'CRTC ownership chart', hash: await computeHash(`crtc-own-${t}`, 'sha256'), ingestedAt: now,
    });
  }
  return records.slice(0, MAX_MEDIA_RECORDS);
}

async function fetchAndParseCmfData(): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const html = await fetchText('https://www.cmf-fmc.ca/open-data');
  if (!html) return records;
  const now = new Date().toISOString();
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(csv|data|investment|production|funding|report)/i.test(t)) continue;
    records.push({
      source: 'canada-media-fund', title: t, url: m[1].startsWith('http') ? m[1] : `https://www.cmf-fmc.ca${m[1]}`,
      year: t.match(/\b(20\d{2})\b/)?.[0] ? parseInt(t.match(/\b(20\d{2})\b/)![0]) : new Date().getFullYear(),
      description: 'CMF open data', hash: await computeHash(`cmf-${t}`, 'sha256'), ingestedAt: now,
    });
  }
  return records.slice(0, MAX_MEDIA_RECORDS);
}

async function fetchAndParseTelefilm(): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const html = await fetchText('https://telefilm.ca/en/studies-and-reports');
  if (!html) return records;
  const now = new Date().toISOString();
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(report|study|funding|production|data)/i.test(t)) continue;
    records.push({
      source: 'telefilm', title: t, url: m[1].startsWith('http') ? m[1] : `https://telefilm.ca${m[1]}`,
      year: t.match(/\b(20\d{2})\b/)?.[0] ? parseInt(t.match(/\b(20\d{2})\b/)![0]) : new Date().getFullYear(),
      description: 'Telefilm report', hash: await computeHash(`telefilm-${t}`, 'sha256'), ingestedAt: now,
    });
  }
  return records.slice(0, MAX_MEDIA_RECORDS);
}

/** Fetch all media sources in parallel */
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
