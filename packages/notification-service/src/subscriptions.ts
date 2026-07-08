/**
 * Notification Subscription CRUD (Decision 0002 — PII Avoidance)
 *
 * Decision 0002: subscriptions no longer carry plaintext email.
 * `subjectHash` is HMAC-SHA256(secret, plaintext) used only for
 * server-side deduplication. Real delivery happens via the
 * user's client (web push from a browser-side worker, or wallet
 * attestation).
 *
 * An `unsubscribeToken` is generated per subscription and embedded
 * in the verification mail the user receives at signup; the user
 * keeps that opaque token to update prefs without authentication.
 */

import Database from "better-sqlite3";
import { randomUUID, createHmac, randomBytes } from "node:crypto";

let _cachedSecret: string | null = null;
function hashSecret(): string {
  if (_cachedSecret) return _cachedSecret;
  const env = process.env["QUILL_PII_HASH_SECRET"];
  if (env && env.length >= 16) {
    _cachedSecret = env;
    return _cachedSecret;
  }
  _cachedSecret = randomBytes(32).toString("hex");
  return _cachedSecret;
}

function hashPii(value: string): string {
  return createHmac("sha256", hashSecret()).update(value.trim().toLowerCase()).digest("hex");
}

export interface Subscription {
  id: string;
  /** HMAC-SHA256 of the original contact (email-or-wallet). */
  subjectHash: string;
  sourceFilter: string[];
  eventTypes: string[];
  active: boolean;
  label?: string;
  /** Random opaque token; user keeps this to update prefs offline. */
  unsubscribeToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  /** Plaintext contact that we hash once and discard. */
  plaintextContact: string;
  sourceFilter: string[];
  eventTypes: string[];
  label?: string;
}

export interface UpdateSubscriptionInput {
  sourceFilter?: string[];
  eventTypes?: string[];
  active?: boolean;
  label?: string;
}

export class SubscriptionStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrate();
  }

  /**
   * Decision 0002: the migration is in-band here so existing dev
   * DBs come forward without a manual `npm run db:migrate` step.
   * Production should run `drizzle-kit push` or equivalent.
   */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        subject_hash TEXT NOT NULL,
        source_filter TEXT NOT NULL,
        event_types TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        label TEXT,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  create(input: CreateSubscriptionInput): Subscription {
    const id = randomUUID();
    const unsubscribeToken = randomBytes(24).toString("hex");
    const now = new Date().toISOString();
    const subjectHash = hashPii(input.plaintextContact);

    const sub: Subscription = {
      id,
      subjectHash,
      sourceFilter: input.sourceFilter,
      eventTypes: input.eventTypes,
      active: true,
      label: input.label,
      unsubscribeToken,
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO notification_subscriptions (id, subject_hash, source_filter, event_types, active, label, unsubscribe_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sub.id,
      sub.subjectHash,
      JSON.stringify(sub.sourceFilter),
      JSON.stringify(sub.eventTypes),
      sub.active ? 1 : 0,
      sub.label ?? null,
      sub.unsubscribeToken,
      sub.createdAt,
      sub.updatedAt,
    );

    return sub;
  }

  getById(id: string): Subscription | undefined {
    const row = this.db.prepare(
      `SELECT * FROM notification_subscriptions WHERE id = ?`,
    ).get(id) as Record<string, unknown> | undefined;

    return row ? this.rowToSubscription(row) : undefined;
  }

  /** Lookup by the unsubscribe token — used by the no-auth /unsubscribe link. */
  getByUnsubscribeToken(token: string): Subscription | undefined {
    const row = this.db.prepare(
      `SELECT * FROM notification_subscriptions WHERE unsubscribe_token = ?`,
    ).get(token) as Record<string, unknown> | undefined;

    return row ? this.rowToSubscription(row) : undefined;
  }

  listActive(sourceId?: string): Subscription[] {
    let rows: Record<string, unknown>[];

    if (sourceId) {
      rows = this.db.prepare(`
        SELECT DISTINCT s.* FROM notification_subscriptions s
        WHERE s.active = 1 AND (
          s.source_filter = '[]' OR EXISTS (
            SELECT 1 FROM json_each(s.source_filter) WHERE value = ?
          )
        )
      `).all(sourceId) as Record<string, unknown>[];
    } else {
      rows = this.db.prepare(
        `SELECT * FROM notification_subscriptions WHERE active = 1`,
      ).all() as Record<string, unknown>[];
    }

    return rows.map((r) => this.rowToSubscription(r));
  }

  update(id: string, input: UpdateSubscriptionInput): Subscription | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const updated: Subscription = {
      ...existing,
      sourceFilter: input.sourceFilter ?? existing.sourceFilter,
      eventTypes: input.eventTypes ?? existing.eventTypes,
      active: input.active ?? existing.active,
      label: input.label ?? existing.label,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE notification_subscriptions
      SET source_filter = ?, event_types = ?, active = ?, label = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(updated.sourceFilter),
      JSON.stringify(updated.eventTypes),
      updated.active ? 1 : 0,
      updated.label ?? null,
      updated.updatedAt,
      id,
    );

    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare(
      `DELETE FROM notification_subscriptions WHERE id = ?`,
    ).run(id);
    return result.changes > 0;
  }

  matchesSubscription(sub: Subscription, sourceId: string, eventType: string): boolean {
    if (!sub.active) return false;
    const sourceMatch =
      sub.sourceFilter.length === 0 || sub.sourceFilter.includes(sourceId);
    const eventMatch =
      sub.eventTypes.length === 0 || sub.eventTypes.includes(eventType);
    return sourceMatch && eventMatch;
  }

  private rowToSubscription(row: Record<string, unknown>): Subscription {
    return {
      id: row.id as string,
      subjectHash: row.subject_hash as string,
      sourceFilter: JSON.parse(row.source_filter as string || "[]"),
      eventTypes: JSON.parse(row.event_types as string || "[]"),
      active: Boolean(row.active),
      label: (row.label as string) || undefined,
      unsubscribeToken: row.unsubscribe_token as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
