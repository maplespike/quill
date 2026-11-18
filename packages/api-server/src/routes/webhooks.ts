// SPDX-License-Identifier: AGPL-3.0-only
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';

// These functions are re-exported from pipeline-core's webhooks module.
// In production, they'd use the SqliteWebhookStore; here we use the in-memory store.
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  setWebhookStore,
  getWebhookStore,
  InMemoryWebhookStore,
  notifyWebhooks,
} from '@maplespike/pipeline-core';
import type { ChangeEvent } from '@maplespike/pipeline-core';

// Initialize in-memory store for the API server
setWebhookStore(new InMemoryWebhookStore());

export const webhookListHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const webhooks = listWebhooks();
  return jsonResponse(buildSuccess({ webhooks, total: webhooks.length }, bc));
};

export const webhookGetHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0];
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Webhook ID required', bc), 400);
  const webhook = getWebhook(id);
  if (!webhook) return jsonResponse(buildError('NOT_FOUND', 'Webhook not found', bc), 404);
  return jsonResponse(buildSuccess({ webhook }, bc));
};

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Allow only http/https; block localhost, loopback, and link-local
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('169.254.')) return false; // link-local
    if (hostname.startsWith('0.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    if (hostname.startsWith('172.')) {
      const second = parseInt(hostname.split('.')[1], 10);
      if (second >= 16 && second <= 31) return false;
    }
    if (hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) return false; // IPv6 private
    if (hostname.startsWith('ff00:')) return false; // IPv6 multicast
    if (hostname.startsWith('fe80:')) return false; // IPv6 link-local
    return true;
  } catch {
    return false;
  }
}

export const webhookCreateHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.url !== 'string' || !body.url) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'url is required', bc), 400);
    }
    if (!isValidWebhookUrl(body.url)) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'url must be a public http/https URL (private IPs and localhost are not allowed)', bc), 400);
    }
    const webhook = createWebhook({
      url: body.url as string,
      secret: (body.secret as string) || '',
      sourceFilter: Array.isArray(body.sourceFilter) ? body.sourceFilter as string[] : ['*'],
      active: body.active !== false,
      label: (body.label as string) || '',
      maxRetries: typeof body.maxRetries === 'number' ? body.maxRetries : 3,
      timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : 10000,
    });
    return jsonResponse(buildSuccess({ webhook }, bc), 201);
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body', bc), 400);
  }
};

export const webhookUpdateHandler: RouteHandler = async (request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0];
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Webhook ID required', bc), 400);
  try {
    const body = await request.json() as Record<string, unknown>;
    const store = getWebhookStore();
    const existing = store.get(id);
    if (!existing) return jsonResponse(buildError('NOT_FOUND', 'Webhook not found', bc), 404);
    const updates: Record<string, unknown> = {};
    if (body.url !== undefined) updates.url = body.url;
    if (body.secret !== undefined) updates.secret = body.secret;
    if (body.sourceFilter !== undefined) updates.sourceFilter = body.sourceFilter;
    if (body.active !== undefined) updates.active = body.active;
    if (body.label !== undefined) updates.label = body.label;
    if (body.maxRetries !== undefined) updates.maxRetries = body.maxRetries;
    if (body.timeoutMs !== undefined) updates.timeoutMs = body.timeoutMs;
    const updated = store.update(id, updates as any);
    return jsonResponse(buildSuccess({ webhook: updated }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body', bc), 400);
  }
};

export const webhookDeleteHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0];
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Webhook ID required', bc), 400);
  if (deleteWebhook(id)) return jsonResponse(buildSuccess({ deleted: id }, bc));
  return jsonResponse(buildError('NOT_FOUND', 'Webhook not found', bc), 404);
};

export const webhookTestHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0];
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Webhook ID required', bc), 400);
  const wh = getWebhook(id);
  if (!wh) return jsonResponse(buildError('NOT_FOUND', 'Webhook not found', bc), 404);

  const testEvent: ChangeEvent = {
    sourceId: '__test__',
    sourceName: 'Test Event',
    detectedAt: new Date().toISOString(),
    previousHash: '00000000',
    currentHash: 'test-hash-123',
    changed: true,
    summary: 'Webhook configuration test',
    recordCount: 1,
  };

  const results = await notifyWebhooks(testEvent);
  return jsonResponse(buildSuccess({ testEvent, results }, bc));
};

// Additional routes for delivery history
export const webhookDeliveriesHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0];
  if (!id) return jsonResponse(buildError('VALIDATION_ERROR', 'Webhook ID required', bc), 400);
  const store = getWebhookStore();
  const deliveries = store.getDeliveries(id, 50);
  return jsonResponse(buildSuccess({ deliveries, total: deliveries.length }, bc));
};
