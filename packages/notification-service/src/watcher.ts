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
  subscriptionStore: SubscriptionStore;
  /** Fetch recent changes from the API — override for testing */
  fetchChanges?: (since: string) => Promise<DataChangeEvent[]>;
}

export class Watcher {
  private db: Database.Database;
  private config: NotificationConfig;
  private subscriptionStore: SubscriptionStore;
  private fetchChangesFn: (since: string) => Promise<DataChangeEvent[]>;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp: string;

  constructor(deps: WatcherDeps) {
    this.db = deps.db;
    this.config = deps.config;
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
  async poll(): Promise<{ changes: number; notifications: number; queued: number; failed: number }> {
    const since = this.lastPollTimestamp;
    this.lastPollTimestamp = new Date().toISOString();

    // 1. Fetch recent changes
    const changes = await this.fetchChangesFn(since);
    if (changes.length === 0) {
      return { changes: 0, notifications: 0, queued: 0, failed: 0 };
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

    // 3. Queue notifications for client-side delivery (Decision 0002)
    //
    // Decision 0002 removed plaintext email from subscriptions in favor of
    // subjectHash (HMAC-SHA256). Direct SMTP delivery is no longer possible
    // from the watcher — the Mailer requires a plaintext `to` address.
    // Events are left as 'pending' in the DB; the user's client-side worker
    // (web push or wallet attestation) picks them up via the unsubscribeToken.
    const toDeliver = pendingEvents.slice(0, this.config.maxEmailsPerCycle);
    let queued = 0;

    for (const event of toDeliver) {
      const sub = this.subscriptionStore.getById(event.subscriptionId);
      if (!sub) continue;

      // Event is already 'pending' from the INSERT above — mark it as
      // 'queued' so the delivery layer knows it's ready for client pickup.
      this.db.prepare(`
        UPDATE notification_events SET status = 'queued' WHERE id = ?
      `).run(event.id);
      queued++;
    }

    console.log(`[watcher] Poll: ${changes.length} changes → ${notifications} notifications → ${queued} queued for client delivery`);
    return { changes: changes.length, notifications, queued, failed: 0 };
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
