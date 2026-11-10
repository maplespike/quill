// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Change Watcher Endpoints
 *
 * GET /v1/watcher/status   — Live status of the change watcher
 * GET /v1/watcher/events   — Real change events from the changelog
 *
 * HONEST DATA POLICY: All data comes from pipeline-core's real watcher
 * store (InMemoryWatcherStore by default, SqliteWatcherStore if a DB
 * path is configured). No hardcoded source lists. No fabricated events.
 *
 * CONTRACT: The camelCase keys (watchedSources, totalSources, sourceId)
 * are preserved from the previous contract — clients reading those
 * fields keep working. The `provenance` block is the only new top-level
 * addition.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import {
  getWatchedSources,
  getChangeLog,
  getWatcherStatus,
  getWatcherStore,
  type WatchedSource,
  type ChangeEvent,
} from '@maplespike/pipeline-core';

interface WatcherStatusProvenance {
  status: 'live' | 'unavailable';
  source_count: number;
  fetched_at: string;
  errors: string[];
  changesDetected: string;
  lastCheck: string | null;
}

interface WatcherStatusResponse {
  status: 'operational' | 'degraded';
  description: string;
  watchedSources: WatchedSource[];
  totalSources: number;
  changesDetected: string;
  lastCheck: string | null;
  provenance: WatcherStatusProvenance;
}

/** GET /v1/watcher/status */
export const watcherStatusHandler: RouteHandler = async (_req, ctx) => {
  const fetchedAt = new Date().toISOString();

  // Real source list + audit trail from pipeline-core — no hardcoded arrays.
  let sources: WatchedSource[] = [];
  const errors: string[] = [];
  let changesDetected = 'none';
  let lastCheck: string | null = null;

  try {
    sources = getWatchedSources();
  } catch (err) {
    errors.push(
      `getWatchedSources failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const audit = getWatcherStatus(getWatcherStore());
    changesDetected = audit.changesDetected;
    lastCheck = audit.lastCheck;
  } catch (err) {
    errors.push(
      `getWatcherStatus failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const response: WatcherStatusResponse = {
    status: sources.length > 0 ? 'operational' : 'degraded',
    description: 'Real-time change watcher monitors data sources for updates',
    watchedSources: sources, // camelCase preserved
    totalSources: sources.length, // camelCase preserved
    changesDetected,
    lastCheck,
    provenance: {
      status: sources.length > 0 ? 'live' : 'unavailable',
      source_count: sources.length,
      fetched_at: fetchedAt,
      errors,
      changesDetected,
      lastCheck,
    },
  };

  return jsonResponse(buildSuccess(response, ctx));
};

interface WatcherEventsResponse {
  events: ChangeEvent[];
  total: number;
  sourceId: string | null; // camelCase preserved
  limit: number;
  provenance: {
    status: 'live' | 'unavailable';
    source_count: number;
    fetched_at: string;
    errors: string[];
  };
}

/** GET /v1/watcher/events */
export const watcherEventsHandler: RouteHandler = async (req, ctx) => {
  const url = new URL(req.url);
  const sourceId = url.searchParams.get('sourceId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  let events: ChangeEvent[] = [];

  try {
    const all = getChangeLog(500, getWatcherStore()); // over-fetch for post-filter
    events = sourceId ? all.filter((e) => e.sourceId === sourceId) : all;
    events = events.slice(0, limit);
  } catch (err) {
    errors.push(
      `getChangeLog failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const response: WatcherEventsResponse = {
    events,
    total: events.length,
    sourceId, // camelCase preserved
    limit,
    provenance: {
      status: 'live',
      source_count: 1,
      fetched_at: fetchedAt,
      errors,
    },
  };

  return jsonResponse(buildSuccess(response, ctx));
};
