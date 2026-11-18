// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/status
 *
 * Public service status + informal free-tier SLA (M0/WS-0).
 *
 * Returns service identity, environment, best-effort uptime commitment,
 * per-module freshness windows, and a live claim-store count so ecosystem
 * partners can check the substrate's health before building on it.
 *
 * Auth-exempt (public observability), like /v1/health and /v1/version.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { loadConfig } from '../config.js';
import { citationStore } from '@maplespike/pipeline-core';

/** Informal free-tier SLA — best-effort, honest numbers. */
export const FREE_TIER_SLA = {
  uptime: '99% best-effort monthly',
  support: 'community / GitHub issues; no hard response-time guarantee on the free tier',
  rateLimit: '60 req/min burst per IP; monthly quota applies to data queries',
  freshness: {
    'committees / gazette': 'daily',
    'lobbying / corporate / gic': 'weekly',
    'statcan / immigration / lmia': 'monthly',
    'real-time feeds': 'continuous',
  },
  verification: 'SHA-256 claim bundles verifiable via get_citation / verify_claim / /v1/citation — independent of Quill uptime',
} as const;

export const statusHandler: RouteHandler = async (_request, ctx) => {
  const config = loadConfig(ctx.env);

  // Live claim-store size (best effort — in-memory fallback reports memory count).
  let claimsStored = 0;
  try {
    claimsStored = citationStore.size;
  } catch {
    // claim store unavailable in this runtime — report 0, don't fail the route
  }

  const body = {
    status: 'ok',
    service: config.name,
    version: config.version,
    environment: config.environment,
    sla: FREE_TIER_SLA,
    claims: {
      stored: claimsStored,
      note: 'SHA-256 claim bundles registered by live ingestion runs (SQLite-backed, shared with the pipeline).',
    },
    publicEndpoints: {
      health: '/v1/health',
      status: '/v1/status',
      citation: '/v1/citation/:hash',
      verify: '/v1/claims/verify',
      openapi: '/v1/openapi.json',
    },
    timestamp: new Date().toISOString(),
  };

  return jsonResponse(buildSuccess(body, ctx, {}));
};
