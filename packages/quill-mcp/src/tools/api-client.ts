// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Unified API Client for MCP Tools
 *
 * Single data access layer for all MCP tools.
 * Tries the live API server first. Falls back to direct upstream
 * fetches or cached data when the server is unreachable.
 *
 * Environment:
 *   QUILL_API_URL  — HTTP API server (optional, user-side mode without it)
 *   QUILL_API_KEY  — API key for the server
 */

// Normalize so callers can pass either `https://host` or `https://host/v1`.
const _rawApiBase = (process.env.QUILL_API_URL || '').replace(/\/+$/, '');
const API_BASE = _rawApiBase === ''
  ? ''
  : _rawApiBase.endsWith('/v1')
    ? _rawApiBase
    : `${_rawApiBase}/v1`;
const API_KEY = process.env.QUILL_API_KEY || 'maplespike-dev-key';
const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

let serverAvailable: boolean | null = null;
let lastServerCheck = 0;
const SERVER_CHECK_INTERVAL = 30_000;

async function checkServer(): Promise<boolean> {
  if (!API_BASE) return false;
  const now = Date.now();
  if (serverAvailable !== null && now - lastServerCheck < SERVER_CHECK_INTERVAL) {
    return serverAvailable;
  }
  try {
    const resp = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    serverAvailable = resp.ok;
  } catch {
    serverAvailable = false;
  }
  lastServerCheck = now;
  return serverAvailable;
}

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
 * Call the API server. Throws if server unreachable.
 */
export async function callApi<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  if (!API_BASE) {
    throw new ServerUnavailableError('No QUILL_API_URL configured — running in user-side mode');
  }
  if (!(await checkServer())) {
    throw new ServerUnavailableError('API server unreachable');
  }

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

export class ServerUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ServerUnavailableError';
  }
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
    scope: string;
    tenant: { id: string; name: string; tier: string };
    period: { date: string; yearMonth: string };
    usage: {
      daily: { calls: number; limit: number; remaining: number; percentUsed: number };
      monthly: { calls: number; limit: number; remaining: number; percentUsed: number };
    };
    resetDate: string;
  }>('/usage');
}

export async function listKeys() {
  return callApi<{ keys: { label: string; prefix: string; createdAt: string }[] }>('/keys');
}
