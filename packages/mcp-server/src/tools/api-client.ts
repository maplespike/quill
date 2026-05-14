/**
 * MapleSpike — Unified API Client for MCP Tools
 *
 * All MCP tools should use this client to call the API server,
 * ensuring MCP and REST always return the same data.
 *
 * The API base URL is configured via env var MAPLESPIKE_API_URL
 * (defaults to the K8s service URL).
 */

const API_BASE = process.env.MAPLESPIKE_API_URL || 'http://maplespike-api:8084/v1';
const API_KEY = process.env.MAPLESPIKE_API_KEY || 'maplespike-dev-key';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
  meta: {
    cacheStatus: string;
    durationMs: number;
    creditsCharged: number;
  };
  quality: {
    freshness_seconds: number;
    source_uptime_7d: number;
    confidence: string;
    certainty_score: number;
  };
  citation: Record<string, unknown> | null;
}

/**
 * Call the API server and return typed data.
 * Throws on network errors or non-200 status.
 */
export async function callApi<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    }
  }

  const resp = await fetch(url.toString(), {
    headers: {
      'X-API-Key': API_KEY,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${body.slice(0, 200)}`);
  }

  const json: ApiResponse<T> = await resp.json() as ApiResponse<T>;
  if (!json.success) {
    throw new Error(`API error: ${json.error?.message || 'unknown'}`);
  }

  return json.data;
}

/**
 * Get pipeline data from the API (all sources).
 */
export async function getPipelineReleases(limit = 20, category?: string) {
  return callApi<{ releases: Record<string, unknown>[]; total: number }>(
    '/gov/releases',
    { limit, category: category || '', _format: 'compact' },
  );
}

/**
 * Search across all government data sources.
 */
export async function searchGovData(
  query: string,
  jurisdiction?: string,
  limit = 10,
) {
  return callApi<{ results: Record<string, unknown>[]; total: number }>(
    '/gov/search',
    { q: query, jurisdiction: jurisdiction || '', limit },
  );
}

/**
 * Verify a citation hash.
 */
export async function getCitation(hash: string) {
  return callApi<Record<string, unknown>>(`/citation/${hash}`);
}

/**
 * Get API health.
 */
export async function getHealth() {
  return callApi<{
    status: string;
    service: string;
    version: string;
    tenant: { tier: string };
    usage: { daily: number; monthly: number };
  }>('/health');
}

/**
 * Get current usage stats.
 */
export async function getUsage() {
  return callApi<{
    periodCalls: number;
    periodLimit: number;
    tier: string;
    daily: { count: number; limit: number };
    monthly: { count: number; limit: number };
  }>('/usage');
}

/**
 * List API keys.
 */
export async function listKeys() {
  return callApi<{ keys: { label: string; prefix: string; createdAt: string }[] }>('/keys');
}
