import { deriveApiBase } from './api-base';

// One public API origin. PUBLIC_API_BASE (build time) or window.MAPLESPIKE.apiBase
// overrides it. Callers of this module use the /v1 prefix.
function getApiBase(): string {
  const fromEnv = import.meta.env.PUBLIC_API_BASE as string | undefined;
  if (fromEnv) return `${deriveApiBase({ apiBase: fromEnv })}/v1`;
  if (typeof window !== 'undefined' && window.MAPLESPIKE?.apiBase) {
    return `${deriveApiBase({ apiBase: window.MAPLESPIKE.apiBase })}/v1`;
  }
  return `${deriveApiBase({})}/v1`;
}
const API_BASE = getApiBase();

export interface HealthData {
  status: string; service: string; version: string; environment: string
  tenant: { id: string; name: string; tier: string }
  usage: { daily: number; monthly: number }
}

export interface Plan { id: string; name: string; priceUsd: number; requests: number; rateLimit: number }
export interface Chain { id: string; name: string; token: string; usdc: boolean; kind: string }

export async function getHealth(): Promise<HealthData | null> {
  try { const r = await fetch(`${API_BASE}/health`); const d = await r.json(); return d.data || d } catch { return null }
}

// ── Claim verification (public trust primitive) ──

export interface ClaimVerifyResult {
  verified: boolean;
  found: boolean;
  sha256: string;
  source?: string;
  source_name?: string;
  source_url?: string;
  retrieved_at?: string | null;
  license?: string | null;
  update_frequency?: string;
  claim?: string;
  verify_command?: string;
  recomputed_sha256?: string;
  matches_claimed?: boolean | null;
}

/**
 * Check a SHA-256 claim hash against the public Quill claim store.
 * No API key required — this is the journalist-facing trust primitive.
 */
export async function verifyClaimHash(hash: string): Promise<ClaimVerifyResult | null> {
  try {
    const clean = hash.trim().replace(/^sha256[:-]/, '');
    const r = await fetch(`${API_BASE}/claims/verify/${encodeURIComponent(clean)}`);
    const d = await r.json();
    if (!r.ok) {
      return { verified: false, found: false, sha256: clean, ...(d.error?.message ? { source: d.error.message } : {}) };
    }
    return d.data || d;
  } catch {
    return null;
  }
}

/**
 * Recompute the SHA-256 of arbitrary JSON data and compare to a claimed hash.
 * Pure computation — verifies claims without needing Quill to have seen them.
 */
export async function verifyClaimData(data: unknown, sha256?: string): Promise<ClaimVerifyResult | null> {
  try {
    const r = await fetch(`${API_BASE}/claims/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, sha256 }),
    });
    const d = await r.json();
    return d.data || d;
  } catch {
    return null;
  }
}

// ── Claims index (public discovery) ──

export interface RecentClaim {
  sha256: string;
  claim: string;
  source_name: string;
  source_url: string;
  retrieved_at?: string | null;
  license?: string | null;
  update_frequency?: string;
  created_at: string;
}

/**
 * List the most recently registered verifiable claim bundles.
 * Public — no API key required. Lets journalists discover what Quill has
 * attested, then deep-link into the verifier via /verify?hash=sha256:...
 */
export async function listRecentClaims(): Promise<{ count: number; claims: RecentClaim[] } | null> {
  try {
    const r = await fetch(`${API_BASE}/claims/latest`);
    const d = await r.json();
    if (!r.ok) return null;
    return d.data || d;
  } catch { return null }
}

export async function getUsage(): Promise<{ daily: number; monthly: number } | null> {
  try { const r = await fetch(`${API_BASE}/usage`); const d = await r.json(); return d.data || d } catch { return null }
}

export async function getPlans(): Promise<{ plans: Plan[]; chains: Chain[] }> {
  try { const r = await fetch(`${API_BASE}/billing/plans`); const d = await r.json(); return d.data || { plans: [], chains: [] } } catch { return { plans: [], chains: [] } }
}

// ── Watcher ──

export interface WatcherStatus {
  status: string;
  description: string;
  watchedSources: Array<{ id: string; name: string; type: string; intervalMs: number }>;
  totalSources: number;
}

export interface WatcherEvent {
  sourceId: string;
  sourceName: string;
  detectedAt: string;
  previousHash: string;
  currentHash: string;
  changed: boolean;
  summary: string;
  recordCount: number;
}

export async function getWatcherStatus(): Promise<WatcherStatus | null> {
  try { const r = await fetch(`${API_BASE}/watcher/status`); const d = await r.json(); return d.data || d } catch { return null }
}

export async function getWatcherEvents(sourceId?: string, limit = 50): Promise<{ events: WatcherEvent[]; total: number } | null> {
  try {
    const params = new URLSearchParams();
    if (sourceId) params.set('sourceId', sourceId);
    params.set('limit', String(limit));
    const r = await fetch(`${API_BASE}/watcher/events?${params}`);
    const d = await r.json(); return d.data || d;
  } catch { return null }
}

// ── Webhooks ──

export interface WebhookConfig {
  id: string;
  url: string;
  active: boolean;
  label: string;
  sourceFilter: string[];
  maxRetries: number;
  created_at: string;
}

export interface WebhookDelivery {
  webhookId: string;
  sourceId: string;
  success: boolean;
  statusCode: number | null;
  attemptedAt: string;
  error?: string;
}

export async function getWebhooks(): Promise<{ webhooks: WebhookConfig[]; total: number } | null> {
  try { const r = await fetch(`${API_BASE}/webhooks`); const d = await r.json(); return d.data || d } catch { return null }
}

export async function createWebhook(url: string, label: string, sourceFilter: string[]): Promise<WebhookConfig | null> {
  try {
    const r = await fetch(`${API_BASE}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, label, sourceFilter }),
    });
    const d = await r.json(); return d.data?.webhook || null;
  } catch { return null }
}

export async function deleteWebhook(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/webhooks/${id}`, { method: 'DELETE' });
    return r.ok;
  } catch { return false }
}

export async function getWebhookDeliveries(webhookId: string): Promise<{ deliveries: WebhookDelivery[]; total: number } | null> {
  try { const r = await fetch(`${API_BASE}/webhooks/${webhookId}/deliveries`); const d = await r.json(); return d.data || d } catch { return null }
}
