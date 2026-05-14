import { computeHash } from '../../verification/hashing.js';
import type { RealtimeRecord, RealtimeIngestionResult } from './types.js';
import {
  REALTIME_SOURCES, REALTIME_FETCH_TIMEOUT_MS,
  REALTIME_USER_AGENT, MAX_REALTIME_RECORDS, REALTIME_CACHE_TTL_MS,
} from './constants.js';

/* ── Shared Cache ───────────────────────────────────── */

const cache = new Map<string, { data: RealtimeRecord[]; ts: number }>();

function getCached(key: string): RealtimeRecord[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > REALTIME_CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: RealtimeRecord[]) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 50) { const first = cache.keys().next().value; if (first) cache.delete(first); }
}

/* ── HTTP ────────────────────────────────────────────── */

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REALTIME_FETCH_TIMEOUT_MS);
    const resp = await fetch(url, { headers: { 'User-Agent': REALTIME_USER_AGENT }, signal: ctrl.signal });
    clearTimeout(t);
    return resp.ok ? await resp.text() : null;
  } catch { return null; }
}

/** Try to fetch and return cached if fresh fails */
async function fetchWithCache(key: string, url: string): Promise<string | null> {
  const cached = getCached(key);
  if (cached && cached.length > 0) return JSON.stringify(cached); // return cached as "stale data" signal
  return fetchText(url);
}

/* ── ECCC Weather Alerts (CAP-CP XML) ───────────────── */

async function fetchEcccAlerts(): Promise<RealtimeRecord[]> {
  const xml = await fetchWithCache('eccc-alerts', 'https://dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml');
  if (!xml) return [];
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];

  // Parse CAP-CP alert entries from XML
  const entryRegex = /<entry>[\s\S]*?<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null && records.length < MAX_REALTIME_RECORDS) {
    const block = m[0];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Weather Alert';
    const link = block.match(/<link[^>]*href=["']([^"']+)["']/)?.[1] || '';
    const updated = block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1] || '';
    const summary = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const region = block.match(/<cap:areaDesc[^>]*>([\s\S]*?)<\/cap:areaDesc>/)?.[1] || '';
    const severity = block.match(/<cap:severity[^>]*>([\s\S]*?)<\/cap:severity>/)?.[1] || 'Unknown';

    records.push({
      source: 'eccc-weather-alerts', title, url: link,
      publishedAt: updated || now, region, severity, summary: summary.substring(0, 500),
      hash: await computeHash(`eccc-alert-${link || title}`, 'sha256'), ingestedAt: now,
    });
  }
  return records;
}

/* ── CBSA Border Wait Times (JSON) ──────────────────── */

async function fetchCbsaBorders(): Promise<RealtimeRecord[]> {
  const json = await fetchWithCache('cbsa-borders', 'https://www.cbsa-asfc.gc.ca/bwt-taf/bwt_taf-eng.json');
  if (!json) return [];
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];

  try {
    const data = JSON.parse(json);
    const crossings = Array.isArray(data) ? data : (data?.crossings ?? data?.ports ?? []);
    for (const port of crossings.slice(0, MAX_REALTIME_RECORDS)) {
      const name = port.portName || port.name || port.Port || 'Border Crossing';
      const wait = port.waitTime || port.WaitTime || port.wait || 'N/A';
      const lane = port.lane || port.Lane || 'All';
      records.push({
        source: 'cbsa-border-wait-times',
        title: `${name} — ${lane}: ${wait} min`,
        url: `https://www.cbsa-asfc.gc.ca/bwt-taf/${port.id || ''}`,
        publishedAt: port.updatedAt || port.UpdatedAt || now,
        region: port.province || port.Province || '',
        severity: wait === 'N/A' ? 'info' : parseInt(wait) > 30 ? 'high' : 'low',
        summary: `${name} border crossing ${lane} lane wait time: ${wait} minutes`,
        hash: await computeHash(`cbsa-${name}-${lane}`, 'sha256'), ingestedAt: now,
      });
    }
  } catch { /* JSON parse failed */ }
  return records;
}

/* ── Parole Board Decisions (HTML) ──────────────────── */

async function fetchParoleDecisions(): Promise<RealtimeRecord[]> {
  const html = await fetchText('https://www.canada.ca/en/parole-board/services/decision-registry.html');
  if (!html) return [];
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];

  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null && records.length < 30) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(decision|registry|hearing|appeal|parole)/i.test(t)) continue;
    records.push({
      source: 'parole-board-decisions', title: t,
      url: m[1].startsWith('http') ? m[1] : `https://www.canada.ca${m[1]}`,
      publishedAt: now, summary: 'Parole Board decision', severity: 'info', region: '',
      hash: await computeHash(`pbc-${t}`, 'sha256'), ingestedAt: now,
    });
  }
  return records;
}

/* ── Main Orchestrator ──────────────────────────────── */

export async function fetchAllRealtime(): Promise<RealtimeIngestionResult> {
  const start = Date.now();
  const allRecords: RealtimeRecord[] = [];
  const errors: { source: string; error: string }[] = [];

  const results = await Promise.allSettled([
    fetchEcccAlerts().then(r => ({ source: 'eccc-weather-alerts' as const, records: r })),
    fetchCbsaBorders().then(r => ({ source: 'cbsa-border-wait-times' as const, records: r })),
    fetchParoleDecisions().then(r => ({ source: 'parole-board-decisions' as const, records: r })),
  ]);

  let succeeded = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allRecords.push(...r.value.records);
      setCache(r.value.source, r.value.records);
      if (r.value.records.length > 0) succeeded++;
    } else {
      errors.push({ source: 'unknown', error: r.reason?.message ?? 'unknown' });
    }
  }

  return {
    records: allRecords, sourcesAttempted: REALTIME_SOURCES.length,
    sourcesSucceeded: succeeded, errors, durationMs: Date.now() - start,
  };
}
