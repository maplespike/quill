// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Watchlist alerts engine (watchlist-alerts-v1)
 *
 * Matches recent registry changes (pipeline-core change log) against tenants'
 * watches, records a durable watch_event per match with a provenance
 * evidence block, and optionally dispatches webhook notification.
 *
 * Design notes:
 * - The engine is dependency-injected (`WatchCycleDeps`) so tests can drive it
 *   without touching the live watcher store or the network.
 * - Dedupe is structural: `watch_events` carries UNIQUE(watch_id, change_key);
 *   insertWatchEvent returns null for a duplicate, so re-running a cycle over
 *   an overlapping change window never double-fires an alert.
 * - Email delivery is intentionally NOT sent from here. Tenant records hold
 *   only `email_hash` (Decision 0002 PII policy) — there is no plaintext
 *   address to send to. V1 deliveries resolve to: durable event record always,
 *   plus webhook dispatch when the watch asks for it. Email opt-in arrives
 *   with the client-side pickup flow tracked in the watchlist spec.
 */
import {
  getChangeLog,
  getWatcherStore,
  getWatchedSources,
  notifyWebhooks,
  type ChangeEvent,
  type WatchedSource,
} from '@maplespike/pipeline-core';
import type { QuillStorage, Watch, WatchEventEvidence } from './types.js';

/** Event type recorded for every registry data change. */
export const CHANGE_EVENT_TYPE = 'data-change';

/** Active-watch cap per tenant tier. Single-sourced here until the
 *  pricing-transparency change moves plan data to one config surface. */
export const WATCH_LIMITS: Record<string, number> = {
  free: 1,
  pro: 10,
  business: 100,
  enterprise: 1000,
  internal: 1000,
};

export function watchLimitForTier(tier: string): number {
  return WATCH_LIMITS[tier] ?? WATCH_LIMITS.free;
}

/** Stable dedupe key for a change: source + post-change hash. */
export function changeKeyFor(change: Pick<ChangeEvent, 'sourceId' | 'currentHash'>): string {
  return `${change.sourceId}:${change.currentHash}`;
}

/**
 * Decide whether one watch matches one change.
 * Empty `sources` = every source; empty `events` = every event type.
 */
export function matchWatch(
  watch: Pick<Watch, 'active' | 'sources' | 'events' | 'keyword'>,
  change: Pick<ChangeEvent, 'sourceId' | 'summary' | 'changed'>,
): boolean {
  if (!watch.active || !change.changed) return false;
  if (watch.sources.length > 0 && !watch.sources.includes(change.sourceId)) return false;
  if (watch.events.length > 0 && !watch.events.includes(CHANGE_EVENT_TYPE)) return false;
  if (watch.keyword && !change.summary.toLowerCase().includes(watch.keyword.toLowerCase())) {
    return false;
  }
  return true;
}

export interface WatchCycleDeps {
  /** Change window to evaluate. Defaults to the live pipeline-core change log. */
  getChanges?: () => ChangeEvent[];
  /** Watched-source registry (for evidence.sourceUrl). Defaults to pipeline-core. */
  getSources?: () => WatchedSource[];
  /** Webhook dispatcher. Defaults to pipeline-core notifyWebhooks. */
  notify?: (change: ChangeEvent) => Promise<unknown>;
}

export interface WatchCycleSummary {
  changes: number;
  matched: number;
  recorded: number;
  delivered: number;
  failed: number;
}

/**
 * Run one matching cycle across every tenant's active watches.
 * Safe to re-run: overlapping change windows dedupe on (watch, changeKey).
 */
export async function runWatchCycle(
  db: QuillStorage,
  deps: WatchCycleDeps = {},
): Promise<WatchCycleSummary> {
  const changes = (deps.getChanges ?? (() => getChangeLog(500, getWatcherStore())))().filter(
    (c) => c.changed,
  );
  const sources = (deps.getSources ?? (() => getWatchedSources()))();
  const sourceUrl = new Map(sources.map((s) => [s.id, s.url]));
  const notify = deps.notify ?? ((change: ChangeEvent) => notifyWebhooks(change));

  await db.ensureWatchSchema();
  const watches = await db.listAllActiveWatches();

  const summary: WatchCycleSummary = {
    changes: changes.length,
    matched: 0,
    recorded: 0,
    delivered: 0,
    failed: 0,
  };

  for (const change of changes) {
    const changeKey = changeKeyFor(change);
    for (const watch of watches) {
      if (!matchWatch(watch, change)) continue;
      summary.matched += 1;

      const evidence: WatchEventEvidence = {
        sourceUrl: sourceUrl.get(change.sourceId) ?? null,
        detectedAt: change.detectedAt,
        previousHash: change.previousHash,
        currentHash: change.currentHash,
        recordCount: change.recordCount,
      };
      const event = await db.insertWatchEvent({
        watchId: watch.id,
        tenantId: watch.tenantId,
        changeKey,
        sourceId: change.sourceId,
        sourceName: change.sourceName,
        summary: change.summary,
        evidence,
      });
      if (!event) continue; // already recorded from an earlier cycle
      summary.recorded += 1;

      if (watch.delivery === 'webhook') {
        try {
          await notify(change);
          await db.updateWatchEventStatus(event.id, 'delivered');
          summary.delivered += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await db.updateWatchEventStatus(event.id, 'failed', message);
          summary.failed += 1;
        }
      }
    }
  }

  return summary;
}

/**
 * Dry-run preview: which of the recent changes WOULD this watch match?
 * Pure read — no persistence, no dispatch.
 */
export function previewMatches(
  watch: Pick<Watch, 'active' | 'sources' | 'events' | 'keyword'>,
  changes: ChangeEvent[],
  sources: WatchedSource[],
  max = 3,
): { wouldFire: number; sample: Array<{ sourceId: string; sourceName: string; summary: string; detectedAt: string; sourceUrl: string | null }> } {
  const urlById = new Map(sources.map((s) => [s.id, s.url]));
  const matched = changes.filter((c) => matchWatch(watch, c));
  return {
    wouldFire: matched.length,
    sample: matched.slice(0, max).map((c) => ({
      sourceId: c.sourceId,
      sourceName: c.sourceName,
      summary: c.summary,
      detectedAt: c.detectedAt,
      sourceUrl: urlById.get(c.sourceId) ?? null,
    })),
  };
}
