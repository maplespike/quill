// SPDX-License-Identifier: AGPL-3.0-only
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

export const auditGetHandler: RouteHandler = async (request, ctx) => {
  try {
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation') || undefined;
    const successParam = url.searchParams.get('success');
    const success = successParam === 'true' ? true : successParam === 'false' ? false : undefined;
    const since = url.searchParams.get('since') || undefined;
    const until = url.searchParams.get('until') || undefined;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 1000);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const results = await ctx.db.queryAudit({
      tenantId: ctx.tenant.id,
      operation,
      success,
      since,
      until,
      limit,
      offset,
    });

    return jsonResponse(buildSuccess({
      entries: results,
      total: results.length,
      query: { operation, success, since, until, limit, offset },
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('AUDIT_QUERY_FAILED', message, ctx), 500);
  }
};
