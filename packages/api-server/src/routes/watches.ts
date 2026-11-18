// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Watchlist alerts routes (watchlist-alerts-v1)
 *
 * Tenant-scoped CRUD over watches plus a per-watch event log. Delivery of a
 * matched change is a durable watch_event record (always) plus webhook
 * dispatch (when the watch asks for it) — see watches-engine.ts for why v1
 * does not email directly.
 *
 * Routes (all authenticated; tenant comes from ctx.tenant):
 *   POST   /v1/watches          — create a watch (?dry_run=1 previews matches)
 *   GET    /v1/watches          — list watches + plan usage
 *   DELETE /v1/watches/:id      — remove a watch
 *   GET    /v1/watches/:id/events — recent events with provenance evidence
 */
import type { RouteContext, RouteHandler, WatchDelivery } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { getChangeLog, getWatcherStore } from '@maplespike/pipeline-core';
import {
  CHANGE_EVENT_TYPE,
  previewMatches,
  watchLimitForTier,
} from '../watches-engine.js';

function ctxToBuildContext(ctx: RouteContext): BuildContext {
  return { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
}

const VALID_DELIVERIES: ReadonlySet<string> = new Set(['events', 'webhook']);

interface ParsedWatchInput {
  sources: string[];
  events: string[];
  keyword?: string;
  delivery: WatchDelivery;
  label?: string;
}

type ParseResult = { ok: true; value: ParsedWatchInput } | { ok: false; message: string };

/** Validate the create-watch body. Unknown fields are ignored. */
function parseWatchInput(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, message: 'Body must be a JSON object.' };
  }
  const body = raw as Record<string, unknown>;

  const sources = body.sources ?? [];
  if (!Array.isArray(sources) || sources.some((s) => typeof s !== 'string' || s.trim() === '')) {
    return { ok: false, message: 'sources must be an array of non-empty source id strings.' };
  }
  if (sources.length > 50) {
    return { ok: false, message: 'sources supports at most 50 entries.' };
  }

  const events = body.events ?? [];
  if (!Array.isArray(events) || events.some((e) => e !== CHANGE_EVENT_TYPE)) {
    return { ok: false, message: `events may only contain "${CHANGE_EVENT_TYPE}".` };
  }

  let keyword: string | undefined;
  if (body.keyword !== undefined && body.keyword !== null && body.keyword !== '') {
    if (typeof body.keyword !== 'string' || body.keyword.trim().length > 200) {
      return { ok: false, message: 'keyword must be a string of at most 200 characters.' };
    }
    keyword = body.keyword.trim();
  }

  const delivery = (body.delivery ?? 'events') as string;
  if (!VALID_DELIVERIES.has(delivery)) {
    return { ok: false, message: 'delivery must be "events" or "webhook".' };
  }

  let label: string | undefined;
  if (body.label !== undefined && body.label !== null && body.label !== '') {
    if (typeof body.label !== 'string' || body.label.trim().length > 120) {
      return { ok: false, message: 'label must be a string of at most 120 characters.' };
    }
    label = body.label.trim();
  }

  return {
    ok: true,
    value: {
      sources: sources.map((s) => (s as string).trim()),
      events: events as string[],
      keyword,
      delivery: delivery as WatchDelivery,
      label,
    },
  };
}

export const watchCreateHandler: RouteHandler = async (request, ctx) => {
  const bc = ctxToBuildContext(ctx);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(buildError('INVALID_REQUEST', 'Request body must be valid JSON.', bc), 400);
  }

  const parsed = parseWatchInput(raw);
  if (!parsed.ok) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.message, bc), 400);
  }

  const limit = watchLimitForTier(ctx.tenant.tier);
  const dryRun = new URL(request.url).searchParams.get('dry_run') === '1';

  if (dryRun) {
    // Read-only preview against the recent change log. No persistence, no dispatch.
    const changes = getChangeLog(200, getWatcherStore()).filter((c) => c.changed);
    const preview = previewMatches(
      { active: true, sources: parsed.value.sources, events: parsed.value.events, keyword: parsed.value.keyword },
      changes,
      // Watched-source registry is embedded in each change's sourceId; URLs are
      // resolved by the engine at record time. Preview reports matches only.
      [],
    );
    return jsonResponse(buildSuccess({
      persisted: false,
      preview,
      limits: { tier: ctx.tenant.tier, max: limit },
    }, bc));
  }

  const used = await ctx.db.countActiveWatches(ctx.tenant.id);
  if (used >= limit) {
    return jsonResponse(buildError(
      'RATE_LIMITED',
      `Watch limit reached for the ${ctx.tenant.tier} plan (${limit} active watches). Delete a watch or upgrade your plan.`,
      bc,
      429,
    ), 429);
  }

  const watch = await ctx.db.createWatch({
    tenantId: ctx.tenant.id,
    sources: parsed.value.sources,
    events: parsed.value.events,
    keyword: parsed.value.keyword,
    delivery: parsed.value.delivery,
    label: parsed.value.label,
  });

  return jsonResponse(buildSuccess({
    watch,
    limits: { tier: ctx.tenant.tier, used: used + 1, max: limit },
  }, bc), 201);
};

export const watchListHandler: RouteHandler = async (_request, ctx) => {
  const bc = ctxToBuildContext(ctx);
  const watches = await ctx.db.listWatches(ctx.tenant.id);
  const used = watches.filter((w) => w.active).length;
  return jsonResponse(buildSuccess({
    watches,
    total: watches.length,
    limits: { tier: ctx.tenant.tier, used, max: watchLimitForTier(ctx.tenant.tier) },
  }, bc));
};

export const watchDeleteHandler: RouteHandler = async (_request, ctx, params) => {
  const bc = ctxToBuildContext(ctx);
  const id = params.id;
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Watch ID required', bc), 400);

  const deleted = await ctx.db.deleteWatch(id, ctx.tenant.id);
  if (!deleted) return jsonResponse(buildError('NOT_FOUND', 'Watch not found', bc), 404);
  return jsonResponse(buildSuccess({ deleted: true, id }, bc));
};

export const watchEventsHandler: RouteHandler = async (request, ctx, params) => {
  const bc = ctxToBuildContext(ctx);
  const id = params.id;
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Watch ID required', bc), 400);

  const watch = await ctx.db.getWatch(id, ctx.tenant.id);
  if (!watch) return jsonResponse(buildError('NOT_FOUND', 'Watch not found', bc), 404);

  const rawLimit = Number(new URL(request.url).searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50;
  const events = await ctx.db.listWatchEvents(id, ctx.tenant.id, limit);

  return jsonResponse(buildSuccess({ watch, events, total: events.length }, bc));
};
