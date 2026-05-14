/**
 * MapleSpike — Unified API Client for MCP Tools
 *
 * SINGLE data access layer for all MCP tools.
 * Tries API server first, falls back to local pipeline-data.json
 * when offline.
 *
 * All tools should use this client exclusively — no direct imports
 * of @maplespike/pipeline-core or pipeline-data.ts in tool files.
 */

const API_BASE = process.env.MAPLESPIKE_API_URL || 'http://maplespike-api:8084/v1';
const API_KEY = process.env.MAPLESPIKE_API_KEY || 'maplespike-dev-key';

// ── Local fallback: pipeline-data.json ────────────────────────────
let _pipelineData: Record<string, any> | null = null;

function getPipelineData(): Record<string, any> | null {
  if (_pipelineData) return _pipelineData;

  try {
    const { readFileSync, existsSync } = require('fs');
    const { resolve, dirname } = require('path');
    const __dirname = dirname(require('url').fileURLToPath(import.meta.url));

    const possiblePaths = [
      resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
      resolve('/data/projects/own/maplespike/packages/portal/assets/pipeline-data.json'),
    ];

    for (const dataPath of possiblePaths) {
      if (existsSync(dataPath)) {
        _pipelineData = JSON.parse(readFileSync(dataPath, 'utf-8'));
        return _pipelineData;
      }
    }
  } catch {
    // File not available — tools will get empty results
  }
  return null;
}

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
 * Falls back to pipeline-data.json if the API is unreachable.
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
 * Safely call the API with fallback to local data.
 * Returns null if both fail (caller handles the empty state).
 */
export async function safeFetch<T>(
  apiCall: () => Promise<T>,
  fallback: () => T | null,
): Promise<T | null> {
  try {
    return await apiCall();
  } catch {
    try { return fallback(); } catch { return null; }
  }
}

// ── Pipeline data search (local fallback) ─────────────────────────

/**
 * Search across pipeline data sources using local JSON file.
 * Performs case-insensitive substring matching.
 */
export function searchLocalRecords(
  sourceKeys: string[],
  query: string,
  limit: number,
): { results: any[]; total: number } {
  const data = getPipelineData();
  if (!data) return { results: [], total: 0 };

  const allRecords: any[] = [];
  const q = query.toLowerCase();

  for (const key of sourceKeys) {
    const source = data.sources?.[key];
    if (source?.data && Array.isArray(source.data)) {
      for (const record of source.data) {
        const searchText = JSON.stringify(record).toLowerCase();
        if (searchText.includes(q)) {
          allRecords.push({ ...record, _source: key });
        }
      }
    }
  }

  return {
    results: allRecords.slice(0, limit),
    total: allRecords.length,
  };
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
    tenant: { tier: string };
    usage: { daily: number; monthly: number };
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
