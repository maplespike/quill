// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Webhook Notifications — Real-time Change Alert Dispatch
 *
 * Extends the watcher system with webhook delivery: when a source change
 * is detected, registered webhooks receive an HTTP POST with the change
 * event payload, signed with HMAC-SHA256 for authenticity.
 *
 * Features:
 *   - Per-webhook event type filtering (which sources to notify on)
 *   - HMAC-SHA256 signature in X-MapleSpike-Signature header
 *   - Automatic retry with exponential backoff on delivery failures
 *   - In-memory and SQLite-backed stores for webhook configs
 *   - Delivery status tracking for observability
 */

import { httpGet } from '../utils/http.js';
import type { ChangeEvent, WatchedSource } from './watcher.js';

// ── Types ──

export interface WebhookConfig {
  id: string;
  /** URL to POST change events to */
  url: string;
  /** HMAC-SHA256 secret for signing payloads (empty = no signing) */
  secret: string;
  /** Event type filter: '*' for all, or specific source IDs */
  sourceFilter: string[];
  /** Active flag — disabled webhooks are skipped */
  active: boolean;
  /** Human label for identification */
  label: string;
  /** Max retries on delivery failure (default: 3) */
  maxRetries: number;
  /** Timeout in ms for each delivery attempt (default: 10000) */
  timeoutMs: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  webhookId: string;
  sourceId: string;
  eventId: string;
  attemptedAt: string;
  statusCode: number | null;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface WebhookStore {
  list(): WebhookConfig[];
  get(id: string): WebhookConfig | null;
  create(config: Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'>): WebhookConfig;
  update(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null;
  delete(id: string): boolean;
  logDelivery(delivery: WebhookDelivery): void;
  getDeliveries(webhookId: string, limit: number): WebhookDelivery[];
}

// ── In-memory webhook store ──

export class InMemoryWebhookStore implements WebhookStore {
  private webhooks = new Map<string, WebhookConfig>();
  private deliveries: WebhookDelivery[] = [];

  list(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  get(id: string): WebhookConfig | null {
    return this.webhooks.get(id) ?? null;
  }

  create(config: Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'>): WebhookConfig {
    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const wh: WebhookConfig = { ...config, id, created_at: now, updated_at: now };
    this.webhooks.set(id, wh);
    return wh;
  }

  update(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null {
    const existing = this.webhooks.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    this.webhooks.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.webhooks.delete(id);
  }

  logDelivery(delivery: WebhookDelivery): void {
    this.deliveries.push(delivery);
  }

  getDeliveries(webhookId: string, limit: number): WebhookDelivery[] {
    return this.deliveries.filter(d => d.webhookId === webhookId).slice(-limit);
  }
}

// ── SQLite-backed webhook store ──

export class SqliteWebhookStore implements WebhookStore {
  private db: any;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.QUILL_DB_PATH || './quill.db';
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(path);
      this.db.pragma('journal_mode = WAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          secret TEXT NOT NULL DEFAULT '',
          source_filter TEXT NOT NULL DEFAULT '*',
          active INTEGER NOT NULL DEFAULT 1,
          label TEXT NOT NULL DEFAULT '',
          max_retries INTEGER NOT NULL DEFAULT 3,
          timeout_ms INTEGER NOT NULL DEFAULT 10000,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id TEXT PRIMARY KEY,
          webhook_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          attempted_at TEXT NOT NULL,
          status_code INTEGER,
          success INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          duration_ms INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_source ON webhook_deliveries(source_id);
      `);
    } catch (err) {
      console.warn(`[Webhooks] SQLite unavailable: ${(err as Error).message}`);
      throw err;
    }
  }

  list(): WebhookConfig[] {
    try {
      return this.db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all().map(this.rowToConfig);
    } catch { return []; }
  }

  get(id: string): WebhookConfig | null {
    try {
      const row = this.db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
      return row ? this.rowToConfig(row) : null;
    } catch { return null; }
  }

  create(config: Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'>): WebhookConfig {
    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const wh: WebhookConfig = { ...config, id, created_at: now, updated_at: now };
    try {
      this.db.prepare(`
        INSERT INTO webhooks (id, url, secret, source_filter, active, label, max_retries, timeout_ms, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, wh.url, wh.secret, wh.sourceFilter.join(','), wh.active ? 1 : 0, wh.label, wh.maxRetries, wh.timeoutMs, now, now);
    } catch (err) {
      console.warn(`[Webhooks] Failed to create: ${(err as Error).message}`);
    }
    return wh;
  }

  update(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null {
    try {
      const existing = this.db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
      if (!existing) return null;
      const now = new Date().toISOString();
      const merged = { ...this.rowToConfig(existing), ...updates, updated_at: now };
      this.db.prepare(`
        UPDATE webhooks SET url=?, secret=?, source_filter=?, active=?, label=?, max_retries=?, timeout_ms=?, updated_at=? WHERE id=?
      `).run(merged.url, merged.secret, merged.sourceFilter.join(','), merged.active ? 1 : 0, merged.label, merged.maxRetries, merged.timeoutMs, now, id);
      return merged;
    } catch { return null; }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
      return result.changes > 0;
    } catch { return false; }
  }

  logDelivery(delivery: WebhookDelivery): void {
    try {
      this.db.prepare(`
        INSERT INTO webhook_deliveries (id, webhook_id, source_id, event_id, attempted_at, status_code, success, error, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `${delivery.webhookId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        delivery.webhookId, delivery.sourceId, delivery.eventId,
        delivery.attemptedAt, delivery.statusCode, delivery.success ? 1 : 0,
        delivery.error || null, delivery.durationMs,
      );
    } catch (err) {
      console.warn(`[Webhooks] logDelivery failed: ${(err as Error).message}`);
    }
  }

  getDeliveries(webhookId: string, limit: number): WebhookDelivery[] {
    try {
      return this.db.prepare(
        'SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY attempted_at DESC LIMIT ?',
      ).all(webhookId, limit).map((r: any) => ({
        webhookId: r.webhook_id,
        sourceId: r.source_id,
        eventId: r.event_id,
        attemptedAt: r.attempted_at,
        statusCode: r.status_code,
        success: r.success === 1,
        error: r.error || undefined,
        durationMs: r.duration_ms,
      }));
    } catch { return []; }
  }

  private rowToConfig(row: any): WebhookConfig {
    return {
      id: row.id,
      url: row.url,
      secret: row.secret || '',
      sourceFilter: row.source_filter === '*' ? ['*'] : row.source_filter.split(','),
      active: row.active === 1,
      label: row.label || '',
      maxRetries: row.max_retries,
      timeoutMs: row.timeout_ms,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ── Module-level store ──

let activeStore: WebhookStore = new InMemoryWebhookStore();

export function setWebhookStore(store: WebhookStore): void {
  activeStore = store;
}

export function getWebhookStore(): WebhookStore {
  return activeStore;
}

// ── HMAC signing ──

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Dispatch ──

export interface DispatchResult {
  webhookId: string;
  url: string;
  success: boolean;
  statusCode: number | null;
  error?: string;
  durationMs: number;
}

export async function dispatchToWebhook(
  webhook: WebhookConfig,
  event: ChangeEvent,
): Promise<DispatchResult> {
  const payload = JSON.stringify({
    event: 'source_changed',
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    detectedAt: event.detectedAt,
    previousHash: event.previousHash,
    currentHash: event.currentHash,
    summary: event.summary,
    recordCount: event.recordCount,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'MapleSpike-Webhook/1.0',
    'X-MapleSpike-Event': 'source_changed',
    'X-MapleSpike-Source': event.sourceId,
  };

  if (webhook.secret) {
    const signature = await signPayload(payload, webhook.secret);
    headers['X-MapleSpike-Signature'] = `sha256=${signature}`;
  }

  const startTime = Date.now();
  let lastError: string | undefined;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt <= webhook.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);
      const resp = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      lastStatus = resp.status;
      if (resp.ok) {
        const durationMs = Date.now() - startTime;
        return { webhookId: webhook.id, url: webhook.url, success: true, statusCode: resp.status, durationMs };
      }
      lastError = `HTTP ${resp.status}`;
    } catch (err: any) {
      lastError = err.name === 'AbortError' ? 'timeout' : err.message;
    }

    if (attempt < webhook.maxRetries) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  const durationMs = Date.now() - startTime;
  return { webhookId: webhook.id, url: webhook.url, success: false, statusCode: lastStatus, error: lastError, durationMs };
}

// ── Notify all matching webhooks ──

export async function notifyWebhooks(
  event: ChangeEvent,
  store?: WebhookStore,
): Promise<DispatchResult[]> {
  const s = store ?? activeStore;
  const webhooks = s.list().filter(w => {
    if (!w.active) return false;
    if (w.sourceFilter.includes('*')) return true;
    return w.sourceFilter.includes(event.sourceId);
  });

  const results = await Promise.allSettled(
    webhooks.map(wh => dispatchToWebhook(wh, event)),
  );

  const dispatchResults: DispatchResult[] = [];
  for (let i = 0; i < webhooks.length; i++) {
    const result = results[i];
    const wh = webhooks[i];
    if (result.status === 'fulfilled') {
      dispatchResults.push(result.value);
      s.logDelivery({
        webhookId: wh.id,
        sourceId: event.sourceId,
        eventId: `${event.sourceId}-${event.detectedAt}`,
        attemptedAt: new Date().toISOString(),
        statusCode: result.value.statusCode,
        success: result.value.success,
        error: result.value.error,
        durationMs: result.value.durationMs,
      });
    } else {
      dispatchResults.push({ webhookId: wh.id, url: wh.url, success: false, statusCode: null, error: result.reason?.message, durationMs: 0 });
    }
  }

  return dispatchResults;
}

// ── Preset webhook for common integrations ──

export function createWebhook(
  config: Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'>,
): WebhookConfig {
  return activeStore.create(config);
}

export function deleteWebhook(id: string): boolean {
  return activeStore.delete(id);
}

export function listWebhooks(): WebhookConfig[] {
  return activeStore.list();
}

export function getWebhook(id: string): WebhookConfig | null {
  return activeStore.get(id);
}
