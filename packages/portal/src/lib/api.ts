// Derive API base from hostname at runtime — no hardcoded URLs
function getApiBase(): string {
  if (import.meta.env.PUBLIC_API_BASE) return import.meta.env.PUBLIC_API_BASE;
  if (typeof window !== 'undefined') {
    if (window.MAPLESPIKE?.apiBase) return window.MAPLESPIKE.apiBase + '/v1';
    const host = window.location.hostname;
    const parts = host.split('.');
    const base = parts.length > 2 && ['api','portal','www','mcp','dev','data'].includes(parts[0])
      ? parts.slice(1).join('.') : host;
    return `${window.location.protocol}//api.${base}/v1`;
  }
  return 'https://api.maplespike.lan/v1';
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
