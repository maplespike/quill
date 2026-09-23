import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { RealtimeRecord, RealtimeIngestionResult, RealtimeSource } from './types.js';
import {
  REALTIME_SOURCES, REALTIME_FETCH_TIMEOUT_MS,
  REALTIME_USER_AGENT, MAX_REALTIME_RECORDS,
} from './constants.js';
import { ensureAmqpsSubscription, getAmqpsCache } from './amqps-subscriber.js';

/* ── Source URL lookup ──────────────────────────────── */

/**
 * Resolve a source's URL from the catalogue so no endpoint is duplicated here.
 * These three are the sources that have a fetcher (see fetchAllRealtime).
 */
function sourceUrl(source: RealtimeSource): string {
  const cfg = REALTIME_SOURCES.find(s => s.source === source);
  if (!cfg) throw new Error(`no REALTIME_SOURCES entry for "${source}"`);
  return cfg.url;
}

/** How many fetchers actually run — the number reported as sourcesAttempted. */
export const REALTIME_FETCHER_COUNT = 3;

/* ── HTTP ────────────────────────────────────────────── */

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': REALTIME_USER_AGENT }, timeoutMs: REALTIME_FETCH_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

/** Strip a UTF-8 BOM — cbsa-asfc.gc.ca serves one, and JSON.parse rejects it. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/* ── ECCC Weather Alerts (OGC API Features GeoJSON) ─── */

/**
 * Parse the MSC weather-alerts collection.
 *
 * The previous CAP index (`dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml`)
 * returns 404. The live feed is the OGC API Features collection on
 * api.weather.gc.ca, whose `features[].properties` carry the alert name,
 * risk colour, province and text.
 */
async function fetchEcccAlerts(): Promise<RealtimeRecord[]> {
  // Check AMQPS push cache first; fall back to HTTPS polling if stale or unavailable
  const amqpsCache = getAmqpsCache();
  if (amqpsCache) return amqpsCache;

  const raw = await fetchText(sourceUrl('eccc-weather-alerts'));
  if (!raw) return [];
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];

  try {
    const data: any = JSON.parse(stripBom(raw));
    const features: any[] = Array.isArray(data?.features) ? data.features : [];

    for (const feature of features.slice(0, MAX_REALTIME_RECORDS)) {
      const p = feature?.properties ?? {};
      const title = p.alert_name_en || p.alert_short_name_en || 'Weather alert';
      const area = [p.province, p.feature_name_en].filter(Boolean).join(' — ');
      const url = feature?.id
        ? `https://api.weather.gc.ca/collections/weather-alerts/items/${encodeURIComponent(String(feature.id))}`
        : 'https://weather.gc.ca/warnings/index_e.html';

      records.push({
        source: 'eccc-weather-alerts',
        title,
        url,
        publishedAt: p.publication_datetime || now,
        region: area,
        severity: p.risk_colour_en || p.alert_type || 'Unknown',
        summary: String(p.alert_text_en ?? '').replace(/<[^>]+>/g, '').trim().substring(0, 500),
        hash: await computeHash(`eccc-alert-${feature?.id ?? title}`, 'sha256'),
        ingestedAt: now,
      });
    }
  } catch { /* malformed payload — treat as no alerts */ }

  return records;
}

/* ── CBSA Border Wait Times (JSON) ──────────────────── */

/**
 * Parse the CBSA border wait-time file.
 *
 * `bwt_taf-eng.json` 404s; the live file is `bwt-eng.json`, shaped
 * `{ waitTimes: [{ "poe-name", "poe-loc", "poe-comm-status", "poe-comm-delay",
 * "poe-trav-status", "poe-trav-delay", "poe-updated" }] }`, served with a BOM.
 */
async function fetchCbsaBorders(): Promise<RealtimeRecord[]> {
  const raw = await fetchText(sourceUrl('cbsa-border-wait-times'));
  if (!raw) return [];
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];

  try {
    const data = JSON.parse(stripBom(raw));
    const crossings: any[] = Array.isArray(data?.waitTimes)
      ? data.waitTimes
      : Array.isArray(data) ? data : (data?.crossings ?? []);

    for (const port of crossings.slice(0, MAX_REALTIME_RECORDS)) {
      const name = port['poe-name'] || port.portName || port.name || 'Border Crossing';
      const location = port['poe-loc'] || '';
      const updated = port['poe-updated'] || now;
      const lanes: { lane: string; status: string; delay: number }[] = [
        {
          lane: 'commercial',
          status: port['poe-comm-status'] ?? 'Unknown',
          delay: Number(port['poe-comm-delay']),
        },
        {
          lane: 'traveller',
          status: port['poe-trav-status'] ?? 'Unknown',
          delay: Number(port['poe-trav-delay']),
        },
      ];

      for (const { lane, status, delay } of lanes) {
        const numeric = isNaN(delay) ? null : delay;
        records.push({
          source: 'cbsa-border-wait-times',
          title: `${name} — ${lane}: ${status}${numeric !== null && numeric >= 0 ? ` (${numeric} min)` : ''}`,
          url: 'https://www.cbsa-asfc.gc.ca/bwt-taf/menu-eng.html',
          publishedAt: updated,
          region: location,
          severity: numeric === null ? 'info' : numeric > 30 ? 'high' : 'low',
          summary: `${name}${location ? ` (${location})` : ''} ${lane} lane: ${status}`,
          hash: await computeHash(`cbsa-${name}-${lane}`, 'sha256'),
          ingestedAt: now,
        });
      }
    }
  } catch { /* malformed payload — treat as no wait times */ }

  return records;
}

/* ── Parole Board Decisions (HTML) ──────────────────── */

async function fetchParoleDecisions(): Promise<RealtimeRecord[]> {
  const html = await fetchText(sourceUrl('parole-board-decisions'));
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

  // Lazily init AMQPS subscriber (no-op unless MSC_AMQPS_ENABLED=true)
  await ensureAmqpsSubscription();

  const fetchers: { source: RealtimeSource; run: () => Promise<RealtimeRecord[]> }[] = [
    { source: 'eccc-weather-alerts', run: fetchEcccAlerts },
    { source: 'cbsa-border-wait-times', run: fetchCbsaBorders },
    { source: 'parole-board-decisions', run: fetchParoleDecisions },
  ];

  const results = await Promise.allSettled(
    fetchers.map(f => f.run().then(records => ({ source: f.source, records }))),
  );

  let succeeded = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allRecords.push(...r.value.records);
      if (r.value.records.length > 0) succeeded++;
    } else {
      errors.push({ source: 'unknown', error: r.reason?.message ?? 'unknown' });
    }
  }

  return {
    // Report what actually ran. This used to be REALTIME_SOURCES.length (7),
    // which claimed four sources that have no fetcher at all.
    records: allRecords, sourcesAttempted: REALTIME_FETCHER_COUNT,
    sourcesSucceeded: succeeded, errors, durationMs: Date.now() - start,
  };
}
