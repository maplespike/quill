/**
 * Polling watcher that detects data changes and triggers notification emails.
 *
 * Architecture:
 *   1. Query MapleSpike API for recently changed data sources
 *   2. Match changes against active subscriptions
 *   3. Record pending notification events in the database
 *   4. Deliver emails via the Mailer
 *   5. Update event status (delivered / failed)
 */

import type { NotificationConfig } from "./config.js";
import { Mailer } from "./mailer.js";
import { SubscriptionStore } from "./subscriptions.js";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

export interface DataChangeEvent {
  sourceId: string;
  eventType: string;
  summary: string;
  timestamp: string;
}

export interface WatcherDeps {
  db: Database.Database;
  config: NotificationConfig;
  mailer: Mailer;
  subscriptionStore: SubscriptionStore;
  /** Fetch recent changes from the API — override for testing */
  fetchChanges?: (since: string) => Promise<DataChangeEvent[]>;
}

export class Watcher {
  private db: Database.Database;
  private config: NotificationConfig;
  private mailer: Mailer;
  private subscriptionStore: SubscriptionStore;
  private fetchChangesFn: (since: string) => Promise<DataChangeEvent[]>;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp: string;

  constructor(deps: WatcherDeps) {
    this.db = deps.db;
    this.config = deps.config;
    this.mailer = deps.mailer;
    this.subscriptionStore = deps.subscriptionStore;
    this.fetchChangesFn = deps.fetchChanges ?? this.defaultFetchChanges.bind(this);
    this.lastPollTimestamp = new Date().toISOString();
  }

  /** Start the polling loop. */
  start(): void {
    if (this.intervalHandle) return;

    console.log(`[watcher] Starting — polling every ${this.config.pollIntervalMs}ms`);

    // Run first poll immediately
    this.poll().catch((err) => {
      console.error("[watcher] Initial poll failed:", err);
    });

    this.intervalHandle = setInterval(() => {
      this.poll().catch((err) => {
        console.error("[watcher] Poll failed:", err);
      });
    }, this.config.pollIntervalMs);
  }

  /** Stop the polling loop. */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("[watcher] Stopped");
    }
  }

  /** Execute a single poll cycle. Exposed for testing. */
  async poll(): Promise<{ changes: number; notifications: number; delivered: number; failed: number }> {
    const since = this.lastPollTimestamp;
    this.lastPollTimestamp = new Date().toISOString();

    // 1. Fetch recent changes
    const changes = await this.fetchChangesFn(since);
    if (changes.length === 0) {
      return { changes: 0, notifications: 0, delivered: 0, failed: 0 };
    }

    // 2. Match changes to subscriptions and create events
    let notifications = 0;
    const pendingEvents: { id: string; subscriptionId: string; change: DataChangeEvent }[] = [];

    for (const change of changes) {
      const subs = this.subscriptionStore.listActive(change.sourceId);
      for (const sub of subs) {
        if (this.subscriptionStore.matchesSubscription(sub, change.sourceId, change.eventType)) {
          const eventId = randomUUID();
          this.db.prepare(`
            INSERT INTO notification_events (id, subscription_id, source_id, event_type, summary, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
          `).run(eventId, sub.id, change.sourceId, change.eventType, change.summary);

          pendingEvents.push({ id: eventId, subscriptionId: sub.id, change });
          notifications++;
        }
      }
    }

    // 3. Deliver emails (capped by maxEmailsPerCycle)
    const toDeliver = pendingEvents.slice(0, this.config.maxEmailsPerCycle);
    let delivered = 0;
    let failed = 0;

    for (const event of toDeliver) {
      const sub = this.subscriptionStore.getById(event.subscriptionId);
      if (!sub) continue;

      const result = await this.mailer.sendNotification({
        email: sub.email,
        label: sub.label,
        sourceId: event.change.sourceId,
        eventType: event.change.eventType,
        summary: event.change.summary,
      });

      if (result.success) {
        this.db.prepare(`
          UPDATE notification_events SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?
        `).run(event.id);
        delivered++;
      } else {
        this.db.prepare(`
          UPDATE notification_events SET status = 'failed', error = ? WHERE id = ?
        `).run(result.error ?? "unknown error", event.id);
        failed++;
      }
    }

    console.log(`[watcher] Poll: ${changes.length} changes → ${notifications} notifications → ${delivered} delivered, ${failed} failed`);
    return { changes: changes.length, notifications, delivered, failed };
  }

  /** Default implementation: fetch recent changes from MapleSpike API. */
  private async defaultFetchChanges(since: string): Promise<DataChangeEvent[]> {
    try {
      const url = `${this.config.apiBaseUrl}/v1/changes?since=${encodeURIComponent(since)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (!res.ok) {
        console.error(`[watcher] API returned ${res.status} — skipping this cycle`);
        return [];
      }
      const data = await res.json() as { changes?: DataChangeEvent[] };
      return data.changes ?? [];
    } catch (err) {
      console.error("[watcher] Failed to fetch changes:", err);
      return [];
    }
  }
}
