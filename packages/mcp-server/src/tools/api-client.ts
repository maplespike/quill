/**
 * MapleSpike — Unified API Client for MCP Tools
 *
 * SINGLE data access layer for all MCP tools.
 * All data comes from the live API server — no local file fallbacks.
 */

const API_BASE = process.env.MAPLESPIKE_API_URL || 'http://maplespike-api:8084/v1';
const API_KEY = process.env.MAPLESPIKE_API_KEY || 'maplespike-dev-key';
const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

// ── API Server calls ──────────────────────────────────────────────

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
      'User-Agent': USER_AGENT,
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

// ── API endpoints ─────────────────────────────────────────────────

export async function getPipelineReleases(limit = 20, category?: string) {
  return callApi<{ releases: Record<string, unknown>[]; total: number }>(
    '/gov/releases',
    { limit, category: category || '', _format: 'compact' },
  );
}

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

export async function getCitation(hash: string) {
  return callApi<Record<string, unknown>>(`/citation/${hash}`);
}

export async function getHealth() {
  return callApi<{
    status: string;
    service: string;
    version: string;
    environment: string;
    tenant: { id: string; name: string; tier: string };
    usage: { daily: number; monthly: number };
    dependencies: Array<{
      name: string;
      status: 'ok' | 'degraded' | 'down';
      latencyMs: number;
      error?: string;
    }>;
    timestamp: string;
  }>('/health');
}

export async function getUsage() {
  return callApi<{
    periodCalls: number;
    periodLimit: number;
    tier: string;
    daily: { count: number; limit: number };
    monthly: { count: number; limit: number };
  }>('/usage');
}

export async function listKeys() {
  return callApi<{ keys: { label: string; prefix: string; createdAt: string }[] }>('/keys');
}
