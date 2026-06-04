/**
 * CRUD operations for notification subscriptions.
 * Uses the shared database package for persistence.
 */

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Subscription {
  id: string;
  email: string;
  sourceFilter: string[];
  eventTypes: string[];
  active: boolean;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  email: string;
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
  }

  /** Create a new notification subscription. */
  create(input: CreateSubscriptionInput): Subscription {
    const id = randomUUID();
    const now = new Date().toISOString();
    const sub: Subscription = {
      id,
      email: input.email,
      sourceFilter: input.sourceFilter,
      eventTypes: input.eventTypes,
      active: true,
      label: input.label,
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO notification_subscriptions (id, email, source_filter, event_types, active, label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sub.id,
      sub.email,
      JSON.stringify(sub.sourceFilter),
      JSON.stringify(sub.eventTypes),
      sub.active ? 1 : 0,
      sub.label ?? null,
      sub.createdAt,
      sub.updatedAt,
    );

    return sub;
  }

  /** Get a subscription by ID. */
  getById(id: string): Subscription | undefined {
    const row = this.db.prepare(`
      SELECT * FROM notification_subscriptions WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    return row ? this.rowToSubscription(row) : undefined;
  }

  /** List all active subscriptions, optionally filtered by source. */
  listActive(sourceId?: string): Subscription[] {
    let rows: Record<string, unknown>[];

    if (sourceId) {
      rows = this.db.prepare(`
        SELECT * FROM notification_subscriptions
        WHERE active = 1 AND (
          source_filter = '[]' OR json_array_contains(source_filter, ?)
        )
      `).all(sourceId) as Record<string, unknown>[];
    } else {
      rows = this.db.prepare(`
        SELECT * FROM notification_subscriptions WHERE active = 1
      `).all() as Record<string, unknown>[];
    }

    return rows.map((r) => this.rowToSubscription(r));
  }

  /** Update a subscription. */
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

  /** Delete a subscription. */
  delete(id: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM notification_subscriptions WHERE id = ?
    `).run(id);
    return result.changes > 0;
  }

  /** Check if a subscription matches a given event source + type. */
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
      email: row.email as string,
      sourceFilter: JSON.parse(row.source_filter as string || "[]"),
      eventTypes: JSON.parse(row.event_types as string || "[]"),
      active: Boolean(row.active),
      label: (row.label as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
