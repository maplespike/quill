/**
 * MapleSpike — Mock Data Middleware
 *
 * Intercepts GET requests to /v1/:agent/:action when ?_mock=true
 * and returns curated sample data from MOCK_DATA_MAP.
 *
 * Usage:
 *   curl 'http://localhost:3000/v1/committees/committee-membership?_mock=true'
 *   curl 'http://localhost:3000/v1/immigration/permanent-residents?_mock=true&_limit=3'
 */

import type { RouteHandler } from '../types.js';
import { jsonResponse, enrichCitation, buildQualityMeta } from '../response.js';
import type { CitationMeta, QualityMeta, BuildContext } from '../response.js';
import { MOCK_DATA_MAP } from '../mock-data.js';

/* ------------------------------------------------------------------ */
/*  Patterns                                                          */
/* ------------------------------------------------------------------ */

/** Regex matching /v1/:agent/:action — e.g. /v1/committees/committee-membership */
const AGENT_ACTION_PATTERN = /^\/v1\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)\/?$/i;

/* ------------------------------------------------------------------ */
/*  Mock Handler                                                      */
/* ------------------------------------------------------------------ */

export const mockHandler: RouteHandler = async (_request, ctx, params) => {
  const startTime = Date.now();
  const agent = params.agent || '';
  const action = params.action || '';
  const key = `${agent}/${action}`;
  const mockData = MOCK_DATA_MAP[key];

  const requestId = ctx.requestId;

  const bc: BuildContext = {
    tenant: ctx.tenant,
    requestId,
    startTime,
    metaOverrides: {
      agent,
      action,
      cacheStatus: 'mock' as const,
      durationMs: 0,
      creditsCharged: 0,
      authMethod: 'api-key',
    },
  };

  const citation: CitationMeta = enrichCitation({
    source_name: 'MapleSpike Mock Data',
    source_url: `https://api.maplespike.ca/v1/${agent}/${action}`,
    retrieved_at: new Date().toISOString(),
    data_hash: '',
    license: 'https://open.canada.ca/en/open-government-licence-canada',
    update_frequency: 'daily',
    original_format: 'JSON',
  });

  const quality: QualityMeta = buildQualityMeta(bc);

  if (!mockData) {
    return jsonResponse({
      success: true,
      data: { results: [], total: 0, message: `No mock data registered for "${agent}/${action}". Available actions are defined in MOCK_DATA_MAP.` },
      text: null,
      error: null,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        usage: { periodCalls: 0, periodLimit: 1000, tier: ctx.tenant.tier },
        agent,
        action,
        authMethod: 'api-key',
        creditsCharged: 0,
        cacheStatus: 'mock',
        durationMs: Date.now() - startTime,
      },
      quality,
      citation,
    }, 200);
  }

  return jsonResponse({
    success: true,
    data: mockData,
    text: null,
    error: null,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      usage: { periodCalls: 0, periodLimit: 1000, tier: ctx.tenant.tier },
      agent,
      action,
      authMethod: 'api-key',
      creditsCharged: 0,
      cacheStatus: 'mock',
      durationMs: Date.now() - startTime,
    },
    quality,
    citation,
  }, 200);
};

/* ------------------------------------------------------------------ */
/*  Parse agent/action from pathname                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract agent and action from a /v1/:agent/:action path.
 * Returns null if the path doesn't match.
 */
export function parseAgentAction(pathname: string): { agent: string; action: string } | null {
  const match = pathname.match(AGENT_ACTION_PATTERN);
  if (!match) return null;
  return { agent: match[1], action: match[2] };
}
