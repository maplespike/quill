/**
 * MapleSpike — Audit Endpoints
 *
 * POST /v1/audit/query — Query audit log (Business tier+)
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { validateBody, auditQuerySchema } from '../validation.js';

export const auditQueryHandler: RouteHandler = async (request, ctx) => {
  // Business tier+ check
  if (!['business', 'enterprise', 'internal'].includes(ctx.tenant.tier)) {
    return jsonResponse(
      buildError('UPGRADE_REQUIRED', 'Audit log access requires Business tier or higher', ctx),
      403,
    );
  }

  const parsed = await validateBody(request, auditQuerySchema);
  if ('error' in parsed) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.error, ctx), parsed.status);
  }
  const filter = parsed.data;

  const startTime = Date.now();

  try {
    const results = await ctx.db.queryAudit({
      tenantId: ctx.tenant.id,
      operation: filter.operation,
      success: filter.success,
      since: filter.since,
      until: filter.until,
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
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
