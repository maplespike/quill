// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Notification Bridge — Pipeline Watcher → Email Notifications
 *
 * Connects the pipeline-core change watcher to the notification-service
 * mailer. When the watcher detects a data source change, this bridge
 * looks up active subscriptions, builds an email, and sends it via
 * the Mailer.
 *
 * Usage:
 *   import { createNotificationHandler } from './notification-bridge.js';
 *   import { setWatcherStore, checkAllSources } from './watcher.js';
 *
 *   const handler = createNotificationHandler(mailer, subscriptionStore);
 *   await checkAllSources({ onChange: handler });
 *
 * Architecture:
 *   pipeline-core watcher  ──onChange──→  NotificationBridge
 *                                            │
 *                                            ▼
 *                                     subscriptionStore.listActive()
 *                                            │
 *                                            ▼
 *                                     Mailer.sendNotification()
 */

import type { ReIngestCallback } from './watcher.js';
import type { WatchedSource, ChangeEvent } from './watcher.js';

/* ------------------------------------------------------------------ */
/*  Notification Bridge Types                                         */
/* ------------------------------------------------------------------ */

/** Mailer-compatible interface for sending notifications */
export interface MailerLike {
  sendNotification(params: {
    to: string;
    unsubscribeToken: string;
    label?: string;
    sourceId: string;
    eventType: string;
    summary: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;

  init(): Promise<void>;
  close(): Promise<void>;
}

/** Subscription store interface compatible with notification-service */
export interface SubscriptionStoreLike {
  listActive(sourceId?: string): Array<{
    id: string;
    subjectHash: string;
    sourceFilter: string[];
    eventTypes: string[];
    active: boolean;
    label?: string;
    unsubscribeToken: string;
    createdAt: string;
    updatedAt: string;
  }>;
  getById(id: string): {
    id: string;
    subjectHash: string;
    sourceFilter: string[];
    eventTypes: string[];
    active: boolean;
    label?: string;
    unsubscribeToken: string;
    createdAt: string;
    updatedAt: string;
  } | undefined;
  matchesSubscription(
    sub: {
      id: string;
      subjectHash: string;
      sourceFilter: string[];
      eventTypes: string[];
      active: boolean;
      label?: string;
      unsubscribeToken: string;
    },
    sourceId: string,
    eventType: string,
  ): boolean;
}

/** Notification bridge configuration */
export interface NotificationBridgeConfig {
  /** Base URL of the MapleSpike API (for unsubscribe links) */
  apiBaseUrl: string;
  /** Whether to log notification events to console */
  verbose?: boolean;
  /** Default email to use when subscription has no label/address */
  fallbackEmail?: string;
}

/* ------------------------------------------------------------------ */
/*  Change Handler Factory                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a change handler that sends email notifications.
 * Returns a ReIngestCallback compatible with pipeline-core's checkSource().
 *
 * @param mailer - An initialized Mailer instance
 * @param subscriptionStore - A SubscriptionStore instance
 * @param config - Bridge configuration
 * @returns onChange callback for the watcher
 */
export function createNotificationHandler(
  mailer: MailerLike,
  subscriptionStore: SubscriptionStoreLike,
  config: NotificationBridgeConfig = { apiBaseUrl: 'http://localhost:8082' },
): ReIngestCallback {
  const { apiBaseUrl, verbose = true, fallbackEmail } = config;
  const log = verbose ? ((msg: string) => console.log(`[notif-bridge] ${msg}`)) : () => {};

  return async (source: WatchedSource, event: ChangeEvent): Promise<void> => {
    if (!event.changed) return;

    log(`Change detected in "${source.name}" — checking subscriptions...`);

    try {
      // Look up active subscriptions for this source
      const subscriptions = subscriptionStore.listActive(source.id);

      if (subscriptions.length === 0) {
        log(`No active subscriptions for source "${source.id}"`);
        return;
      }

      log(`Found ${subscriptions.length} active subscription(s) for "${source.id}"`);

      // Send notification to each subscriber
      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        try {
          // Decision 0002: subscriptions no longer store plaintext email.
          // The `label` field is used as a delivery hint. If the application
          // layer hasn't resolved the email, fallbackEmail is tried.
          const recipientEmail = (sub.label && sub.label.includes('@'))
            ? sub.label
            : fallbackEmail;

          if (!recipientEmail) {
            log(`No delivery address for subscription ${sub.id} — skipping SMTP`);
            continue;
          }

          const result = await mailer.sendNotification({
            to: recipientEmail,
            unsubscribeToken: sub.unsubscribeToken,
            label: sub.label,
            sourceId: event.sourceId,
            eventType: 'data-change',
            summary: event.summary,
          });

          if (result.success) {
            sent++;
            log(`Email sent to ${recipientEmail} (${result.messageId})`);
          } else {
            failed++;
            console.error(`[notif-bridge] Failed to send to ${recipientEmail}: ${result.error}`);
          }
        } catch (err) {
          failed++;
          console.error(`[notif-bridge] Error sending to subscription ${sub.id}:`, err);
        }
      }

      log(`Notifications: ${sent} sent, ${failed} failed`);
    } catch (err) {
      console.error(`[notif-bridge] Error processing notifications for "${source.id}":`, err);
    }
  };
}

/**
 * Get the registered notification handler for use with the watcher.
 * This function integrates with the watcher API by providing an onChange
 * callback that checks for active subscriptions when data changes.
 *
 * Registration example:
 *
 *   import { checkAllSources, setWatcherStore } from './watcher.js';
 *   import { Mailer, SubscriptionStore } from '@maplespike/notification-service';
 *   import { createNotificationHandler } from './notification-bridge.js';
 *
 *   const mailer = new Mailer(config);
 *   await mailer.init();
 *   const subStore = new SubscriptionStore(db);
 *   const handler = createNotificationHandler(mailer, subStore);
 *   await checkAllSources({ onChange: handler });
 *
 * This is typically called once at application startup.
 */
