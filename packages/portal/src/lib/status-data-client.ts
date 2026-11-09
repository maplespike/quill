/**
 * Fill the status-page data panels from the public API.
 * Aggregate responses only. No API key. No record bodies.
 */
import {
  renderCoverageInner,
  renderFreshnessInner,
  renderHealthInner,
  type CoveragePayload,
  type HealthPayload,
  type StatusLang,
  type StatusPayload,
} from './status-panel';

const POLL_MS = 30_000;

function lang(): StatusLang {
  return window.__LANG === 'fr' ? 'fr' : 'en';
}

function apiBase(): string {
  const cfg = (window as Window & { MAPLESPIKE?: { apiBase?: string } }).MAPLESPIKE;
  const base = cfg?.apiBase || 'https://api.maplespike.ca';
  return base.replace(/\/$/, '');
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function loadData(path: string): Promise<unknown | null> {
  try {
    const resp = await fetch(apiBase() + path, { signal: withTimeout(8000) });
    if (!resp.ok) return null;
    const body = await resp.json() as { data?: unknown };
    if (body && typeof body === 'object' && body.data && typeof body.data === 'object') {
      return body.data;
    }
    return body;
  } catch {
    return null;
  }
}

async function refresh(): Promise<void> {
  const root = document.getElementById('status-data-root');
  if (!root || !root.isConnected) return;
  const locale = lang();
  const [status, health, coverage] = await Promise.all([
    loadData('/v1/status'),
    loadData(`/v1/municipal/health?lang=${locale}`),
    loadData('/v1/municipal/coverage'),
  ]);
  if (!root.isConnected) return;
  const freshness = document.getElementById('freshness-panel');
  const healthEl = document.getElementById('municipal-health-panel');
  const coverageEl = document.getElementById('municipal-coverage-panel');
  if (freshness) freshness.innerHTML = renderFreshnessInner(status as StatusPayload | null, locale);
  if (healthEl) healthEl.innerHTML = renderHealthInner(health as HealthPayload | null, locale);
  if (coverageEl) coverageEl.innerHTML = renderCoverageInner(coverage as CoveragePayload | null, locale);
}

let interval: ReturnType<typeof setInterval> | null = null;
let listeners = false;

export function bootStatusData(): void {
  const root = document.getElementById('status-data-root');
  if (!root || root.dataset.bound === 'true') return;
  root.dataset.bound = 'true';
  void refresh();
  if (interval) clearInterval(interval);
  interval = setInterval(() => { void refresh(); }, POLL_MS);
  if (!listeners) {
    listeners = true;
    document.addEventListener('astro:before-swap', () => {
      if (interval) clearInterval(interval);
      interval = null;
    });
    document.addEventListener('astro:page-load', () => { bootStatusData(); });
  }
}

if (typeof document !== 'undefined') {
  bootStatusData();
}
