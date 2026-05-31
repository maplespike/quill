/**
 * Change Watcher — Real-time Monitoring & Change Detection
 *
 * Polls data sources at configurable intervals, detects changes via hash
 * comparison, and logs changes to a change_log store.
 */

import { httpGet } from '../utils/http.js';

export interface WatchedSource {
  id: string;
  name: string;
  url: string;
  intervalMs: number;
  type: 'committee' | 'gazette' | 'lobbying' | 'ckan' | 'rss';
}

export interface ChangeEvent {
  sourceId: string;
  sourceName: string;
  detectedAt: string;
  previousHash: string;
  currentHash: string;
  changed: boolean;
  summary: string;
  recordCount: number;
}

const WATCHED_SOURCES: WatchedSource[] = [
  { id: 'committees', name: 'House Committees', url: 'https://www.ourcommons.ca/Committees/en/Search?search=all', intervalMs: 86400000, type: 'committee' },
  { id: 'gazette', name: 'Canada Gazette Part I', url: 'https://www.gazette.gc.ca/rss/p1-eng.xml', intervalMs: 86400000, type: 'gazette' },
  { id: 'gazette-ii', name: 'Canada Gazette Part II', url: 'https://www.gazette.gc.ca/rss/p2-eng.xml', intervalMs: 86400000, type: 'gazette' },
  { id: 'lobbying', name: 'Federal Lobbying Registry', url: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml', intervalMs: 86400000, type: 'lobbying' },
  { id: 'ckan-canada', name: 'open.canada.ca CKAN', url: 'https://open.canada.ca/data/api/3/action/package_list', intervalMs: 43200000, type: 'ckan' },
  { id: 'procurement', name: 'CanadaBuys Tenders', url: 'https://canadabuys.canada.ca/dp/api/opportunities/search', intervalMs: 43200000, type: 'rss' },
];

const hashStore = new Map<string, { hash: string; timestamp: number }>();
const changeLog: ChangeEvent[] = [];

export function getWatchedSources(): WatchedSource[] {
  return [...WATCHED_SOURCES];
}

async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function checkSource(source: WatchedSource): Promise<ChangeEvent> {
  const now = new Date().toISOString();
  try {
    const resp = await httpGet(source.url, {
      timeoutMs: 15000,
      headers: { 'User-Agent': 'MapleSpike-Watcher/1.0' },
    });
    if (resp.statusCode >= 400) {
      return { sourceId: source.id, sourceName: source.name, detectedAt: now, previousHash: '', currentHash: '', changed: false, summary: `HTTP ${resp.statusCode}`, recordCount: 0 };
    }

    const body = resp.body || '';
    const currentHash = await computeHash(body);
    const previous = hashStore.get(source.id);
    const previousHash = previous?.hash || '';
    const changed = previous ? currentHash !== previousHash : true;

    if (changed) {
      hashStore.set(source.id, { hash: currentHash, timestamp: Date.now() });
    }

    const event: ChangeEvent = {
      sourceId: source.id, sourceName: source.name, detectedAt: now,
      previousHash, currentHash, changed,
      summary: changed ? `Content changed (length: ${body.length})` : 'No changes detected',
      recordCount: body.length,
    };

    if (changed) changeLog.push(event);
    return event;
  } catch (err) {
    return { sourceId: source.id, sourceName: source.name, detectedAt: now, previousHash: '', currentHash: '', changed: false, summary: `Error: ${(err as Error).message}`, recordCount: 0 };
  }
}

export async function checkAllSources(): Promise<ChangeEvent[]> {
  return Promise.all(WATCHED_SOURCES.map(checkSource));
}

export function getChangeLog(limit = 50): ChangeEvent[] {
  return changeLog.slice(-limit);
}

export function getWatcherStatus() {
  return {
    sourcesTracked: WATCHED_SOURCES.length,
    changesDetected: changeLog.length,
    lastCheck: changeLog.length > 0 ? changeLog[changeLog.length - 1].detectedAt : null,
  };
}
