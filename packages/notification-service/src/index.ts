/**
 * MapleSpike Notification Service — standalone alerts microservice.
 *
 * Provides:
 *   - Subscription CRUD (create, read, update, delete notification preferences)
 *   - Polling watcher (detects data changes → sends email alerts)
 *   - Email delivery via nodemailer (SMTP) or dry-run mode
 *
 * Usage:
 *   import { NotificationService } from "@maplespike/notification-service";
 *   const service = new NotificationService(config);
 *   await service.start();
 */

export { Mailer } from "./mailer.js";
export type { MailResult } from "./mailer.js";

export { SubscriptionStore } from "./subscriptions.js";
export type { Subscription, CreateSubscriptionInput, UpdateSubscriptionInput } from "./subscriptions.js";

export { Watcher } from "./watcher.js";
export type { DataChangeEvent, WatcherDeps } from "./watcher.js";

export { loadConfig } from "./config.js";
export type { NotificationConfig } from "./config.js";

export { buildNotificationEmail } from "./templates/email.js";
export type { EmailPayload } from "./templates/email.js";

import Database from "better-sqlite3";
import { loadConfig, type NotificationConfig } from "./config.js";
import { Mailer } from "./mailer.js";
import { SubscriptionStore } from "./subscriptions.js";
import { Watcher } from "./watcher.js";

export class NotificationService {
  private config: NotificationConfig;
  private db: Database.Database;
  private mailer: Mailer;
  private subscriptionStore: SubscriptionStore;
  private watcher: Watcher;

  constructor(configOverrides?: Partial<NotificationConfig>, dbOverride?: Database.Database) {
    this.config = loadConfig(configOverrides);
    this.db = dbOverride ?? new Database(this.config.dbPath);

    // Ensure tables exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_subscriptions (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        source_filter TEXT NOT NULL DEFAULT '[]',
        event_types TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1,
        label TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notification_events (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL REFERENCES notification_subscriptions(id),
        source_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        delivered_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notification_events_subscription
        ON notification_events(subscription_id);

      CREATE INDEX IF NOT EXISTS idx_notification_events_status
        ON notification_events(status);
    `);

    this.mailer = new Mailer(this.config);
    this.subscriptionStore = new SubscriptionStore(this.db);
    this.watcher = new Watcher({
      db: this.db,
      config: this.config,
      subscriptionStore: this.subscriptionStore,
    });
  }

  /** Initialize SMTP transport and start the polling watcher. */
  async start(): Promise<void> {
    await this.mailer.init();
    this.watcher.start();
    console.log("[notification-service] Started");
  }

  /** Stop the watcher and close connections. */
  async stop(): Promise<void> {
    this.watcher.stop();
    await this.mailer.close();
    this.db.close();
    console.log("[notification-service] Stopped");
  }

  /** Access the subscription store for CRUD operations. */
  get subscriptions(): SubscriptionStore {
    return this.subscriptionStore;
  }

  /** Access the mailer for direct email sending. */
  get emailer(): Mailer {
    return this.mailer;
  }

  /** Access the watcher for testing or manual poll triggers. */
  get poller(): Watcher {
    return this.watcher;
  }
}
