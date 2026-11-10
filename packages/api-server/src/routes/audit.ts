// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Audit Endpoints
 *
 * POST /v1/audit/query — Query audit log (Business tier+)
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { validateBody } from '../validate.js';

export const auditQueryHandler: RouteHandler = async (request, ctx) => {
  // Business tier+ check
  if (!['business', 'enterprise', 'internal'].includes(ctx.tenant.tier)) {
    return jsonResponse(
      buildError('UPGRADE_REQUIRED', 'Audit log access requires Business tier or higher', ctx),
      403,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonResponse(buildError('INVALID_JSON', 'Request body must be valid JSON', ctx), 400);
  }

  const errs = validateBody(body, {
    operation: { type: 'string' },
    success: { type: 'boolean' },
    since: { type: 'string' },
    until: { type: 'string' },
    limit: { type: 'number', min: 1, max: 1000 },
    offset: { type: 'number', min: 0 },
  });
  if (errs.length > 0) {
    return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), ctx), 400);
  }

  const filter = body;

  const startTime = Date.now();

  try {
    const results = await ctx.db.queryAudit({
      tenantId: ctx.tenant.id,
      operation: filter.operation as string | undefined,
      success: filter.success as boolean | undefined,
      since: filter.since as string | undefined,
      until: filter.until as string | undefined,
      limit: (filter.limit as number) || 50,
      offset: (filter.offset as number) || 0,
    });

    const durationMs = Date.now() - startTime;

    await ctx.db.logAudit({
      tenantId: ctx.tenant.id,
      apiKeyId: ctx.apiKeyId,
      operation: 'audit_query',
      endpoint: '/v1/audit/query',
      outputSummary: `Returned ${results.length} audit entries`,
      confidence: null,
      success: true,
      durationMs,
    });

    return jsonResponse(buildSuccess({
      entries: results,
      total: results.length,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('AUDIT_QUERY_FAILED', message, ctx), 500);
  }
};
