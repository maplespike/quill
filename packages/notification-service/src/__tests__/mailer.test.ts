/**
 * Mailer + SubscriptionStore + Watcher tests (Decision 0002)
 *
 * Test fixtures updated to the new PII-free `Subscription`
 * interface: `plaintextContact` (consumed in-flight), `subjectHash`
 * (persisted), and `unsubscribeToken` (user-held opaque).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { Mailer } from "../mailer.js";
import { SubscriptionStore } from "../subscriptions.js";
import { Watcher, type DataChangeEvent } from "../watcher.js";
import type { NotificationConfig } from "../config.js";

const testConfig: NotificationConfig = {
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  fromEmail: "test@maplespike.ca",
  fromName: "Test Alerts",
  postalAddress: "Fixture Mailbox, Ottawa ON",
  pollIntervalMs: 999999,
  dbPath: ":memory:",
  apiBaseUrl: "http://localhost:8082",
  apiKey: "test-key",
  maxEmailsPerCycle: 50,
};

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      subject_hash TEXT NOT NULL,
      source_filter TEXT NOT NULL DEFAULT '[]',
      event_types TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      label TEXT,
      unsubscribe_token TEXT NOT NULL UNIQUE,
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
  `);
  return db;
}

describe("Mailer (dry-run)", () => {
  let mailer: Mailer;

  beforeEach(() => {
    mailer = new Mailer(testConfig, true);
  });

  it("sends notification in dry-run mode without SMTP", async () => {
    const result = await mailer.sendNotification({
      to: "test@example.com",
      unsubscribeToken: "tok-test-1",
      label: "Test User",
      sourceId: "statcan-gdp",
      eventType: "data_update",
      summary: "GDP figures updated for Q1 2026",
    });
    assert.ok(result.success);
    assert.ok(result.messageId?.startsWith("dry-run-"));
  });

  it("rejects empty `to` even in dry-run mode", async () => {
    const result = await mailer.sendNotification({
      to: "",
      unsubscribeToken: "tok-test-2",
      sourceId: "test",
      eventType: "update",
      summary: "test",
    });
    // Even in dry-run mode, an empty destination is rejected
    // (no notification should leak from upstream).
    assert.equal(result.success, false);
  });
});

describe("SubscriptionStore", () => {
  let db: Database.Database;
  let store: SubscriptionStore;

  beforeEach(() => {
    db = makeDb();
    store = new SubscriptionStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates a subscription and retrieves it", () => {
    const sub = store.create({
      plaintextContact: "user@example.com",
      sourceFilter: ["statcan-gdp", "cer-monthly"],
      eventTypes: ["data_update"],
      label: "Econ Watcher",
    });

    assert.ok(sub.id);
    // Decision 0002: subjectHash is exposed, plaintext is not.
    assert.match(sub.subjectHash, /^[0-9a-f]{64}$/);
    assert.deepEqual(sub.sourceFilter, ["statcan-gdp", "cer-monthly"]);
    assert.deepEqual(sub.eventTypes, ["data_update"]);
    assert.equal(sub.active, true);
    assert.equal(sub.label, "Econ Watcher");
    assert.match(sub.unsubscribeToken, /^[0-9a-f]{48}$/);

    const fetched = store.getById(sub.id);
    assert.ok(fetched);
    assert.equal(fetched!.subjectHash, sub.subjectHash);
  });

  it("generates a unique unsubscribe token per subscription", () => {
    const a = store.create({ plaintextContact: "a@example.com", sourceFilter: [], eventTypes: [] });
    const b = store.create({ plaintextContact: "b@example.com", sourceFilter: [], eventTypes: [] });
    assert.notEqual(a.unsubscribeToken, b.unsubscribeToken);
  });

  it("lists active subscriptions", () => {
    store.create({ plaintextContact: "a@example.com", sourceFilter: [], eventTypes: [] });
    store.create({ plaintextContact: "b@example.com", sourceFilter: ["statcan-gdp"], eventTypes: [] });

    const all = store.listActive();
    assert.equal(all.length, 2);
  });

  it("filters by source ID", () => {
    store.create({ plaintextContact: "a@example.com", sourceFilter: ["statcan-gdp"], eventTypes: [] });
    store.create({ plaintextContact: "b@example.com", sourceFilter: ["cer-monthly"], eventTypes: [] });
    store.create({ plaintextContact: "c@example.com", sourceFilter: [], eventTypes: [] });

    const matches = store.listActive("statcan-gdp");
    assert.ok(matches.length >= 1);
  });

  it("updates a subscription", () => {
    const sub = store.create({
      plaintextContact: "user@example.com",
      sourceFilter: [],
      eventTypes: [],
    });

    const updated = store.update(sub.id, { active: false, label: "Paused" });
    assert.ok(updated);
    assert.equal(updated!.active, false);
    assert.equal(updated!.label, "Paused");
  });

  it("deletes a subscription", () => {
    const sub = store.create({ plaintextContact: "user@example.com", sourceFilter: [], eventTypes: [] });
    const deleted = store.delete(sub.id);
    assert.equal(deleted, true);
    assert.equal(store.getById(sub.id), undefined);
  });

  it("matches subscription by source and event type", () => {
    const sub = store.create({
      plaintextContact: "user@example.com",
      sourceFilter: ["statcan-gdp"],
      eventTypes: ["data_update"],
    });

    assert.equal(store.matchesSubscription(sub, "statcan-gdp", "data_update"), true);
    assert.equal(store.matchesSubscription(sub, "other-source", "data_update"), false);
    assert.equal(store.matchesSubscription(sub, "statcan-gdp", "new_source"), false);
  });

  it("wildcard subscription matches all sources and events", () => {
    const sub = store.create({
      plaintextContact: "wild@example.com",
      sourceFilter: [],
      eventTypes: [],
    });

    assert.equal(store.matchesSubscription(sub, "anything", "anything"), true);
  });
});

describe("Watcher", () => {
  let db: Database.Database;
  let store: SubscriptionStore;

  beforeEach(() => {
    db = makeDb();
    store = new SubscriptionStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("poll detects changes and queues events for client delivery", async () => {
    store.create({
      plaintextContact: "user@example.com",
      sourceFilter: ["statcan-gdp"],
      eventTypes: ["data_update"],
    });

    const mockChanges: DataChangeEvent[] = [
      {
        sourceId: "statcan-gdp",
        eventType: "data_update",
        summary: "GDP figures updated",
        timestamp: new Date().toISOString(),
      },
    ];

    const watcher = new Watcher({
      db,
      config: testConfig,
      subscriptionStore: store,
      fetchChanges: async () => mockChanges,
    });

    const result = await watcher.poll();
    assert.equal(result.changes, 1);
    assert.equal(result.notifications, 1);
    assert.equal(result.queued, 1);
    assert.equal(result.failed, 0);

    // Decision 0002: events are queued for client-side delivery, not
    // delivered directly via SMTP.
    const events = db.prepare("SELECT * FROM notification_events WHERE status = 'queued'").all() as Record<string, unknown>[];
    assert.equal(events.length, 1);
    assert.equal(events[0].source_id, "statcan-gdp");
  });

  it("poll with no matching subscriptions creates no events", async () => {
    store.create({
      plaintextContact: "user@example.com",
      sourceFilter: ["other-source"],
      eventTypes: [],
    });

    const watcher = new Watcher({
      db,
      config: testConfig,
      subscriptionStore: store,
      fetchChanges: async () => [
        {
          sourceId: "statcan-gdp",
          eventType: "data_update",
          summary: "GDP updated",
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const result = await watcher.poll();
    assert.equal(result.changes, 1);
    assert.equal(result.notifications, 0);
  });

  it("poll with no changes returns zeroes", async () => {
    const watcher = new Watcher({
      db,
      config: testConfig,
      subscriptionStore: store,
      fetchChanges: async () => [],
    });

    const result = await watcher.poll();
    assert.equal(result.changes, 0);
    assert.equal(result.notifications, 0);
    assert.equal(result.queued, 0);
  });

  // Decision 0002: SMTP delivery is no longer possible from the watcher.
  // Events are always queued for client-side delivery (web push / wallet
  // attestation). The "failed" count is always 0 — delivery failures are
  // handled by the client-side layer, not the server-side watcher.
  it("queues events for client delivery (was: records failed delivery)", async () => {
    store.create({
      plaintextContact: "user@example.com",
      sourceFilter: [],
      eventTypes: [],
    });

    const watcher = new Watcher({
      db,
      config: testConfig,
      subscriptionStore: store,
      fetchChanges: async () => [
        {
          sourceId: "test",
          eventType: "update",
          summary: "test",
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const result = await watcher.poll();
    assert.equal(result.notifications, 1);
    assert.equal(result.queued, 1);
    assert.equal(result.failed, 0);

    const events = db.prepare("SELECT * FROM notification_events WHERE status = 'queued'").all() as Record<string, unknown>[];
    assert.equal(events.length, 1);
  });
});
