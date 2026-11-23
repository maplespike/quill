import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { RealtimeRecord, RealtimeIngestionResult } from './types.js';
import type { SourceOutcome } from '../run-log.js';
import {
  REALTIME_SOURCES, REALTIME_FETCH_TIMEOUT_MS,
  REALTIME_USER_AGENT, MAX_REALTIME_RECORDS, REALTIME_CACHE_TTL_MS,
  ECCC_ALERTS_GEOAPI_URL, CBSA_BWT_HTML_URL,
} from './constants.js';
import { ensureAmqpsSubscription, getAmqpsCache } from './amqps-subscriber.js';

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

/**
 * Fetch text, classifying failures (GH#921): returns `{ ok: true, body }` on
 * success, `{ ok: false, error }` otherwise — the caller surfaces the error
 * as a per-source outcome instead of an empty array that reads as "no data".
 */
async function fetchText(url: string): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': REALTIME_USER_AGENT }, timeoutMs: REALTIME_FETCH_TIMEOUT_MS });
    if (resp.statusCode === 0) {
      return { ok: false, error: `network error GET ${url} (all attempts failed)` };
    }
    if (resp.statusCode >= 400) {
      return { ok: false, error: `HTTP ${resp.statusCode} GET ${url}` };
    }
    return { ok: true, body: resp.body };
  } catch (err) {
    return { ok: false, error: `${err instanceof Error ? err.message : String(err)} GET ${url}` };
  }
}

/* ── ECCC Weather Alerts (GeoAPI JSON — GH#921 repair) ─ */

/**
 * Parse a GeoAPI weather-alerts FeatureCollection into realtime records.
 * Exported for fixture tests — no network.
 */
export function parseGeoApiAlerts(payload: unknown): RealtimeRecord[] {
  if (!payload || typeof payload !== 'object') return [];
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];
  for (const feature of features.slice(0, MAX_REALTIME_RECORDS)) {
    if (!feature || typeof feature !== 'object') continue;
    const props = (feature as { properties?: Record<string, unknown> }).properties;
    if (!props) continue;
    const nameEn = typeof props['alert_name_en'] === 'string' ? props['alert_name_en'] : '';
    const areaEn = typeof props['feature_name_en'] === 'string' ? props['feature_name_en'] : '';
    const title = [areaEn, nameEn].filter(s => s.length > 0).join(' — ') || 'Weather Alert';
    const publishedAt = typeof props['publication_datetime'] === 'string' ? props['publication_datetime'] : now;
    const expiresAt = typeof props['expiration_datetime'] === 'string' ? props['expiration_datetime'] : null;
    const text = typeof props['alert_text_en'] === 'string' ? props['alert_text_en'] : '';
    const alertType = typeof props['alert_type'] === 'string' ? props['alert_type'] : '';
    const riskColour = typeof props['risk_colour_en'] === 'string' ? props['risk_colour_en'] : '';
    const severity = alertType.includes('warning') ? 'high'
      : alertType.includes('watch') ? 'moderate'
        : riskColour === 'red' ? 'high'
          : riskColour === 'orange' ? 'moderate'
            : 'low';
    const summary = expiresAt ? `${text} (expires ${expiresAt})` : text;
    records.push({
      source: 'eccc-weather-alerts',
      title,
      url: 'https://weather.gc.ca/warnings/index_e.html',
      publishedAt,
      region: areaEn,
      severity,
      summary: summary.substring(0, 500),
      hash: '', // hashed by the caller (async) — see fetchEcccAlerts
      ingestedAt: now,
    });
  }
  return records;
}

async function fetchEcccAlerts(): Promise<{ records: RealtimeRecord[]; error: string | null }> {
  // AMQPS push cache first; fall back to HTTPS polling when stale/unavailable.
  const amqpsCache = getAmqpsCache();
  if (amqpsCache) return { records: amqpsCache, error: null };

  const cached = getCached('eccc-alerts');
  if (cached && cached.length > 0) return { records: cached, error: null };

  const resp = await fetchText(`${ECCC_ALERTS_GEOAPI_URL}${MAX_REALTIME_RECORDS}`);
  if (!resp.ok) return { records: [], error: resp.error };
  try {
    const parsed = parseGeoApiAlerts(JSON.parse(resp.body));
    const hashed = await Promise.all(parsed.map(async r => ({
      ...r,
      hash: await computeHash(`eccc-alert-${r.title}-${r.publishedAt}`, 'sha256'),
    })));
    return { records: hashed, error: null };
  } catch (err) {
    return { records: [], error: `GeoAPI parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── CBSA Border Wait Times (HTML table — GH#921 repair) ─ */

/**
 * Parse the CBSA `#bwttaf` HTML table into realtime records. Row shape
 * (verified live 2026-09-23):
 * `<tr><th><b>Port</b><br />Crossing</th><td>Commercial</td><td>Travellers</td><td><time datetime="…">…</time></td></tr>`
 * Exported for fixture tests — no network.
 */
export function parseCbsaBordersHtml(html: string): RealtimeRecord[] {
  const now = new Date().toISOString();
  const records: RealtimeRecord[] = [];
  const tableMatch = html.match(/<table[^>]*id="bwttaf"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return records;
  const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  for (const row of rows.slice(0, MAX_REALTIME_RECORDS)) {
    const cells = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) ?? [];
    if (cells.length < 4) continue;
    const stripTags = (s: string) => s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Port cell: `<b>Port name</b><br />Crossing, XX/Crossing, YY<br />`.
    // Pull the <b> block out first — tag-stripping collapses the separator.
    const portCellRaw = cells[0] ?? '';
    const portName = stripTags(portCellRaw.match(/<b>([\s\S]*?)<\/b>/i)?.[1] ?? '');
    const crossing = stripTags(portCellRaw.replace(/<b>[\s\S]*?<\/b>/i, ''));
    if (!portName && !crossing) continue;
    if (/port of entry/i.test(`${portName} ${crossing}`)) continue; // header row
    const commercial = stripTags(cells[1] ?? '');
    const travellers = stripTags(cells[2] ?? '');
    const updatedMatch = (cells[3] ?? '').match(/datetime="([^"]+)"/i);
    const updatedAt = updatedMatch ? updatedMatch[1] : now;
    const waitMinutes = /no delay/i.test(travellers) ? '0'
      : /not applicable|^n\/?a$|^--$/i.test(travellers) ? 'N/A'
        : (travellers.match(/(\d+)\s*min/i)?.[1] ?? 'N/A');
    const severity = waitMinutes === 'N/A' ? 'info' : parseInt(waitMinutes, 10) > 30 ? 'high' : 'low';
    records.push({
      source: 'cbsa-border-wait-times',
      title: `${portName} — travellers ${travellers}, commercial ${commercial}`,
      url: CBSA_BWT_HTML_URL,
      publishedAt: updatedAt,
      region: crossing,
      severity,
      summary: `${portName} border crossing (${crossing}): travellers ${travellers}, commercial ${commercial}`,
      hash: '', // hashed by the caller (async) — see fetchCbsaBorders
      ingestedAt: now,
    });
  }
  return records;
}

async function fetchCbsaBorders(): Promise<{ records: RealtimeRecord[]; error: string | null }> {
  const cached = getCached('cbsa-borders');
  if (cached && cached.length > 0) return { records: cached, error: null };

  const resp = await fetchText(CBSA_BWT_HTML_URL);
  if (!resp.ok) return { records: [], error: resp.error };
  const parsed = parseCbsaBordersHtml(resp.body);
  if (parsed.length === 0) {
    return { records: [], error: 'CBSA #bwttaf table parse produced 0 rows (page structure changed?)' };
  }
  const hashed = await Promise.all(parsed.map(async r => ({
    ...r,
    hash: await computeHash(`cbsa-${r.title}-${r.publishedAt}`, 'sha256'),
  })));
  return { records: hashed, error: null };
}

/* ── Parole Board Decisions (HTML) ──────────────────── */

const PAROLE_REGISTRY_URL = 'https://www.canada.ca/en/parole-board/services/decision-registry.html';

function stripChrome(html: string): string {
  let out = html;
  const block = /<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi;
  for (let i = 0; i < 8; i++) {
    const next = out.replace(block, ' ');
    if (next === out) break;
    out = next;
  }
  return out;
}

function paroleLinkText(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * An individual decision document, not a canada.ca menu link or a registry
 * explainer ("What is the decision registry?"). The registry landing page
 * does not list decisions.
 */
function looksLikeParoleDecision(href: string, title: string): boolean {
  const path = href.split(/[?#]/)[0].toLowerCase();
  if (!path || path.startsWith('#') || path.startsWith('javascript:')) return false;
  if (/\/(what-is|how-do-i|how-to|faq|frequently|contact|about)[-/]/.test(path)) return false;
  if (/decision-registry\/?$/.test(path)) return false;
  if (/\.pdf$/.test(path)) return true;
  if (/\/decisions?\/[^/]+$/.test(path)) return true;
  if (/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/.test(title) && /\bdecision\b/i.test(title)) return true;
  if (/\bdecision\s*(?:no\.?|number|#)\s*\d+/i.test(title)) return true;
  return false;
}

function absoluteParoleUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('/')) return `https://www.canada.ca${href}`;
  return `https://www.canada.ca/${href}`;
}

/**
 * Parse Parole Board HTML into decision records. Navigation and registry
 * explainers are not decisions. Exported for fixture tests — no network.
 * Hash is filled by the caller.
 */
export function parseParoleBoardHtml(html: string, now = new Date().toISOString()): RealtimeRecord[] {
  const scoped = stripChrome(html);
  const records: RealtimeRecord[] = [];
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(scoped)) !== null && records.length < 30) {
    const title = paroleLinkText(m[2]);
    const href = m[1].trim();
    if (title.length < 10 || !looksLikeParoleDecision(href, title)) continue;
    records.push({
      source: 'parole-board-decisions',
      title,
      url: absoluteParoleUrl(href),
      publishedAt: now,
      summary: 'Parole Board decision',
      severity: 'info',
      region: '',
      hash: '',
      ingestedAt: now,
    });
  }
  return records;
}

async function fetchParoleDecisions(): Promise<{ records: RealtimeRecord[]; error: string | null }> {
  const resp = await fetchText(PAROLE_REGISTRY_URL);
  if (!resp.ok) return { records: [], error: resp.error };
  const now = new Date().toISOString();
  const parsed = parseParoleBoardHtml(resp.body, now);
  const hashed = await Promise.all(parsed.map(async (record) => ({
    ...record,
    hash: await computeHash(`pbc-${record.title}`, 'sha256'),
  })));
  return { records: hashed, error: null };
}

/* ── Main Orchestrator ──────────────────────────────── */

export async function fetchAllRealtime(): Promise<RealtimeIngestionResult> {
  const start = Date.now();
  const allRecords: RealtimeRecord[] = [];
  const errors: { source: string; error: string }[] = [];
  const sourceOutcomes: SourceOutcome[] = [];

  // Lazily init AMQPS subscriber (no-op if already running or disabled).
  await ensureAmqpsSubscription();

  const results = await Promise.allSettled([
    fetchEcccAlerts().then(r => ({ source: 'eccc-weather-alerts' as const, ...r })),
    fetchCbsaBorders().then(r => ({ source: 'cbsa-border-wait-times' as const, ...r })),
    fetchParoleDecisions().then(r => ({ source: 'parole-board-decisions' as const, ...r })),
  ]);

  let succeeded = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { source, records, error } = r.value;
      allRecords.push(...records);
      setCache(source, records);
      if (error) {
        errors.push({ source, error });
        sourceOutcomes.push({ source, status: 'error', records: records.length, error });
      } else {
        succeeded++;
        sourceOutcomes.push({
          source,
          status: records.length > 0 ? 'ok' : 'empty',
          records: records.length,
          error: null,
        });
      }
    } else {
      const error = r.reason?.message ?? 'unknown';
      errors.push({ source: 'unknown', error });
      sourceOutcomes.push({ source: 'unknown', status: 'error', records: 0, error });
    }
  }

  return {
    records: allRecords, sourcesAttempted: REALTIME_SOURCES.length,
    sourcesSucceeded: succeeded, errors, durationMs: Date.now() - start,
    sources: sourceOutcomes,
  };
}
