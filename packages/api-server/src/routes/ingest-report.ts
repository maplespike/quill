// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — POST /v1/internal/ingest-report
 *
 * Ingestion runs record their outcome here so the API can answer "is this data
 * current?" about data it did not fetch itself. Guarded by the internal service
 * token (X-Internal-Token, audience quill-internal) — never reachable by a
 * customer key, and the prefix is in the free-tier allowlist purely so the tier
 * gate does not 402 before this handler runs.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { requireInternalAuth } from '../middleware/internal-auth.js';
import { recordIngest } from '../ingest-ledger.js';

export const ingestReportHandler: RouteHandler = async (request, ctx) => {
  // ctx.env is the Workers-style env object; on Node the container value sits in
  // process.env (same idiom as the rest of index.ts: env.X || process.env.X).
  const internalSecret = ctx.env?.['INTERNAL_JWT_SECRET'] || process.env['INTERNAL_JWT_SECRET'];
  const guard = requireInternalAuth(internalSecret);
  const auth = guard(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(buildError('INVALID_JSON', 'Body must be JSON', ctx), 400);
  }

  const moduleName = typeof body['module'] === 'string' ? body['module'].trim() : '';
  const status = body['status'];
  if (!moduleName) return jsonResponse(buildError('MISSING_QUERY', 'module is required', ctx), 400);
  if (status !== 'success' && status !== 'failure') {
    return jsonResponse(buildError('INVALID_REQUEST', "status must be 'success' or 'failure'", ctx), 400);
  }

  const entry = recordIngest({
    module: moduleName,
    status,
    at: typeof body['at'] === 'string' ? body['at'] : undefined,
    records: typeof body['records'] === 'number' ? body['records'] : undefined,
    error: typeof body['error'] === 'string' ? body['error'] : undefined,
  });

  return jsonResponse(buildSuccess({ recorded: true, module: moduleName, entry }, ctx));
};
