// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Change Watcher — Real-time Monitoring & Change Detection
 *
 * Polls data sources at configurable intervals, detects changes via hash
 * comparison, and logs changes to a change_log store.
 */

import { httpGet } from '../utils/http.js';
import { notifyWebhooks } from './webhooks.js';

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

export interface WatcherStore {
  getHash(sourceId: string): string | null;
  setHash(sourceId: string, hash: string): void;
  logEvent(event: ChangeEvent): void;
  getEvents(limit: number): ChangeEvent[];
}

/**
 * Callback type for re-ingestion triggers.
 * Called when a source change is detected.
 */
export type ReIngestCallback = (source: WatchedSource, event: ChangeEvent) => Promise<void> | void;

// ── In-memory store (default fallback) ──

export class InMemoryWatcherStore implements WatcherStore {
  private hashes = new Map<string, { hash: string; timestamp: number }>();
  private events: ChangeEvent[] = [];

  getHash(sourceId: string): string | null {
    return this.hashes.get(sourceId)?.hash ?? null;
  }

  setHash(sourceId: string, hash: string): void {
    this.hashes.set(sourceId, { hash, timestamp: Date.now() });
  }

  logEvent(event: ChangeEvent): void {
    this.events.push(event);
  }

  getEvents(limit: number): ChangeEvent[] {
    return this.events.slice(-limit);
  }

  get changesDetected(): number {
    return this.events.length;
  }

  get lastCheck(): string | null {
    return this.events.length > 0 ? this.events[this.events.length - 1].detectedAt : null;
  }
}

// ── SQLite-backed store ──

export class SqliteWatcherStore implements WatcherStore {
  private dbPath: string | null;
  private db: any = null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || null;
    if (this.dbPath) {
      this.initializeDb();
    }
  }

  private initializeDb() {
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS watcher_hashes (
          sourceId TEXT PRIMARY KEY,
          hash TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS watcher_changelog (
          id TEXT PRIMARY KEY,
          sourceId TEXT NOT NULL,
          sourceName TEXT NOT NULL,
          detectedAt TEXT NOT NULL,
          previousHash TEXT NOT NULL,
          currentHash TEXT NOT NULL,
          changed INTEGER NOT NULL,
          summary TEXT NOT NULL,
          recordCount INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_changelog_source ON watcher_changelog(sourceId);
        CREATE INDEX IF NOT EXISTS idx_changelog_detected ON watcher_changelog(detectedAt);
      `);
    } catch (err) {
      console.warn(`Failed to initialize SQLite watcher store: ${(err as Error).message}`);
      this.db = null;
    }
  }

  getHash(sourceId: string): string | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT hash FROM watcher_hashes WHERE sourceId = ?').get(sourceId);
      return row?.hash || null;
    } catch {
      return null;
    }
  }

  setHash(sourceId: string, hash: string): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO watcher_hashes (sourceId, hash, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(sourceId) DO UPDATE SET
          hash = excluded.hash,
          updatedAt = excluded.updatedAt
      `);
      stmt.run(sourceId, hash, new Date().toISOString());
    } catch (err) {
      console.warn(`Failed to set hash: ${(err as Error).message}`);
    }
  }

  logEvent(event: ChangeEvent): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO watcher_changelog (
          id, sourceId, sourceName, detectedAt, previousHash,
          currentHash, changed, summary, recordCount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        `${event.sourceId}-${event.detectedAt}-${Math.random().toString(36).substr(2, 9)}`,
        event.sourceId,
        event.sourceName,
        event.detectedAt,
        event.previousHash,
        event.currentHash,
        event.changed ? 1 : 0,
        event.summary,
        event.recordCount,
      );
    } catch (err) {
      console.warn(`Failed to log event: ${(err as Error).message}`);
    }
  }

  getEvents(limit: number): ChangeEvent[] {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare(`
        SELECT * FROM watcher_changelog
        ORDER BY detectedAt DESC
        LIMIT ?
      `).all(limit);

      return rows.map((row: any) => ({
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        detectedAt: row.detectedAt,
        previousHash: row.previousHash,
        currentHash: row.currentHash,
        changed: row.changed === 1,
        summary: row.summary,
        recordCount: row.recordCount,
      }));
    } catch {
      return [];
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ── Module-level store ──

let defaultStore: WatcherStore = new InMemoryWatcherStore();

export function setWatcherStore(store: WatcherStore): void {
  defaultStore = store;
}

export function getWatcherStore(): WatcherStore {
  return defaultStore;
}

// ── Watched sources ──

const WATCHED_SOURCES: WatchedSource[] = [
  { id: 'committees', name: 'House Committees', url: 'https://www.ourcommons.ca/Committees/en/Search?search=all', intervalMs: 86400000, type: 'committee' },
  { id: 'gazette', name: 'Canada Gazette Part I', url: 'https://www.gazette.gc.ca/rss/p1-eng.xml', intervalMs: 86400000, type: 'gazette' },
  { id: 'gazette-ii', name: 'Canada Gazette Part II', url: 'https://www.gazette.gc.ca/rss/p2-eng.xml', intervalMs: 86400000, type: 'gazette' },
  { id: 'lobbying', name: 'Federal Lobbying Registry', url: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml', intervalMs: 86400000, type: 'lobbying' },
  { id: 'ckan-canada', name: 'open.canada.ca CKAN', url: 'https://open.canada.ca/data/api/3/action/package_list', intervalMs: 43200000, type: 'ckan' },
  { id: 'procurement', name: 'CanadaBuys Tenders', url: 'https://canadabuys.canada.ca/dp/api/opportunities/search', intervalMs: 43200000, type: 'rss' },
];

export function getWatchedSources(): WatchedSource[] {
  return [...WATCHED_SOURCES];
}

async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function checkSource(
  source: WatchedSource,
  options?: {
    store?: WatcherStore;
    onChange?: ReIngestCallback;
    notify?: boolean;
  },
): Promise<ChangeEvent> {
  const store = options?.store ?? defaultStore;
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
    const previousHash = store.getHash(source.id) || '';
    const changed = previousHash ? currentHash !== previousHash : true;

    if (changed) {
      store.setHash(source.id, currentHash);
    }

    const event: ChangeEvent = {
      sourceId: source.id, sourceName: source.name, detectedAt: now,
      previousHash, currentHash, changed,
      summary: changed ? `Content changed (length: ${body.length})` : 'No changes detected',
      recordCount: body.length,
    };

    if (changed) {
      store.logEvent(event);
      if (options?.notify !== false) {
        notifyWebhooks(event).catch(err =>
          console.warn(`[Watcher] Webhook dispatch failed: ${(err as Error).message}`),
        );
      }
      if (options?.onChange) {
        await options.onChange(source, event);
      }
    }
    return event;
  } catch (err) {
    return { sourceId: source.id, sourceName: source.name, detectedAt: now, previousHash: '', currentHash: '', changed: false, summary: `Error: ${(err as Error).message}`, recordCount: 0 };
  }
}

export async function checkAllSources(
  options?: {
    store?: WatcherStore;
    onChange?: ReIngestCallback;
  },
): Promise<ChangeEvent[]> {
  return Promise.all(WATCHED_SOURCES.map(s => checkSource(s, options)));
}

export function getChangeLog(limit = 50, store?: WatcherStore): ChangeEvent[] {
  return (store ?? defaultStore).getEvents(limit);
}

export function getWatcherStatus(store?: WatcherStore) {
  const s = store ?? defaultStore;
  const events = s.getEvents(1);
  return {
    sourcesTracked: WATCHED_SOURCES.length,
    changesDetected: events.length > 0 ? 'stored' : 'none',
    lastCheck: events.length > 0 ? events[0].detectedAt : null,
  };
}
