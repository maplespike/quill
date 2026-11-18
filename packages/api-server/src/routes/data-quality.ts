// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/data/quality
 *
 * Data quality monitoring endpoint that feeds the Grafana dashboard.
 * Returns module health probes, freshness tracking, and error aggregation
 * for all pipeline modules.
 *
 * Response is cached for 5 minutes (300s) to avoid hammering upstream APIs.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { getDataQualityReport, getModuleQualityReport } from '../data-quality.js';

export const dataQualityHandler: RouteHandler = async (request, ctx) => {
  try {
    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module');

    if (moduleParam) {
      // Single-module quality report
      const report = await getModuleQualityReport(moduleParam);
      if (!report) {
        return jsonResponse(
          buildError('NOT_FOUND', `Module "${moduleParam}" not found in registry`, ctx),
          404,
        );
      }
      return jsonResponse(buildSuccess(report, ctx));
    }

    // Full quality summary
    const summary = await getDataQualityReport();
    return jsonResponse(buildSuccess(summary, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('DATA_QUALITY_ERROR', message, ctx), 500);
  }
};
