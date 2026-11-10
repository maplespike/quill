// SPDX-License-Identifier: AGPL-3.0-only
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

export const complianceHandler: RouteHandler = async (request, ctx) => {
  try {
    const url = new URL(request.url);
    const packageName = url.searchParams.get('package') || 'all';

    // Dynamic import — pipeline-core may not be built at test time
    const mod = await import('@maplespike/pipeline-core').catch(() => null);
    if (!mod) {
      return jsonResponse(
        buildError('NOT_AVAILABLE', 'Compliance module not available (pipeline-core not built)', ctx),
        503,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (packageName === 'all' ? (mod as any).getFullComplianceReport() : (mod as any).getComplianceCheck(packageName));

    return jsonResponse(buildSuccess({
      query: { package: packageName },
      results: Array.isArray(result) ? result : [result],
      totalCount: Array.isArray(result) ? result.length : 1,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('COMPLIANCE_CHECK_FAILED', message, ctx), 500);
  }
};
