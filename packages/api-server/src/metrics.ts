import { createHash } from 'node:crypto';

type Labels = Record<string, string>;

type Sample = {
  labels: Labels;
  count: number;
  sum: number;
  buckets: number[];
};

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const REGISTERED_ROUTES = new Set<string>();
const IDENTITY_WINDOW_MS = 5 * 60 * 1000;
const MAX_TRACKED_TENANTS = 4096;
const TIERS = ['free', 'pro', 'business', 'enterprise', 'internal'] as const;
// Mirrors the canonical alias map in pipeline-core. The parity test below
// keeps this bounded metric allowlist aligned without adding CLI code to the
// API process's runtime dependency graph.
const KNOWN_PIPELINE_ALIASES = new Set([
  'committees', 'committee', 'corporate', 'influence', 'gazette', 'gic',
  'elections', 'provincial-lobbying', 'oversight', 'canlii', 'lmia',
  'indigenous', 'defence', 'immigration', 'tribunals', 'veterans', 'fisheries',
  'agriculture', 'culture', 'ngo-rss', 'regional-authorities', 'media',
  'realtime', 'municipal-long-tail', 'universities', 'unions', 'corporate-filings',
  'provincial', 'federal', 'a2aj', 'legislation', 'goc-spending', 'ati',
  'cra-charity', 'criminal-justice', 'crown-corporations', 'federal-budget',
  'geospatial', 'provincial-legislatures', 'provincial-orgs',
  'provincial-regulators', 'social-programs', 'social', 'statcan',
  'transport-infrastructure',
]);

export function isKnownPipeline(pipeline: string, modules: ReadonlySet<string>): boolean {
  if (pipeline === 'all' || KNOWN_PIPELINE_ALIASES.has(pipeline) || modules.has(pipeline)) return true;
  return pipeline.startsWith('all:') && modules.has(pipeline.slice('all:'.length));
}

export function registerApiMetricRoute(route: string): string {
  if ((route === '/v1' || /^\/v1\/[a-zA-Z0-9_./:-]{1,240}$/.test(route)) && (REGISTERED_ROUTES.has(route) || REGISTERED_ROUTES.size < 512)) {
    REGISTERED_ROUTES.add(route);
  }
  return REGISTERED_ROUTES.has(route) ? route : 'unmatched';
}

function labelKey(labels: Labels): string {
  return JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function renderLabels(labels: Labels, extra?: Labels): string {
  const entries = Object.entries({ ...labels, ...extra });
  return entries.length
    ? `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`
    : '';
}

export class ApiMetrics {
  private readonly samples = new Map<string, Sample>();
  private readonly tenants = new Map<string, { expires: number; tier: string }>();
  private readonly windowMs: number;
  private readonly maxTenants: number;
  private readonly now: () => number;

  constructor(options: { windowMs?: number; maxTenants?: number; now?: () => number } = {}) {
    this.windowMs = options.windowMs ?? IDENTITY_WINDOW_MS;
    this.maxTenants = options.maxTenants ?? MAX_TRACKED_TENANTS;
    this.now = options.now ?? Date.now;
  }

  record(route: string, method: string, statusClass: string, durationSeconds: number): void {
    const safeRoute = REGISTERED_ROUTES.has(route) ? route : 'unmatched';
    const safeDuration = Number.isFinite(durationSeconds) ? Math.min(3600, Math.max(0, durationSeconds)) : 0;
    const safeStatusClass = ['2xx', '4xx', '5xx', 'other'].includes(statusClass) ? statusClass : 'other';
    const labels = { route: safeRoute, method: normalizeApiMethod(method), status_class: safeStatusClass };
    const key = labelKey(labels);
    let sample = this.samples.get(key);
    if (!sample) {
      sample = { labels, count: 0, sum: 0, buckets: BUCKETS.map(() => 0) };
      this.samples.set(key, sample);
    }
    sample.count++;
    sample.sum += safeDuration;
    BUCKETS.forEach((boundary, index) => {
      if (safeDuration <= boundary) sample!.buckets[index]++;
    });
  }

  /** Count an authenticated tenant once per request; the raw ID never leaves this object. */
  recordTenant(tenantId: string, tier: string): void {
    if (typeof tenantId !== 'string' || tenantId.length === 0) return;
    const now = this.now();
    this.pruneTenants(now);
    const key = createHash('sha256').update(tenantId).digest('hex');
    // Map preserves insertion order, so evicting the first key drops the
    // oldest tenant when the bounded set is full.
    if (!this.tenants.has(key) && this.tenants.size >= this.maxTenants) {
      const oldest = this.tenants.keys().next().value;
      if (oldest !== undefined) this.tenants.delete(oldest);
    }
    this.tenants.set(key, {
      expires: now + this.windowMs,
      tier: (TIERS as readonly string[]).includes(tier) ? tier : 'other',
    });
  }

  private pruneTenants(now: number): void {
    for (const [key, value] of this.tenants) {
      if (value.expires <= now) this.tenants.delete(key);
    }
  }

  private activeTenantCounts(): Map<string, number> {
    this.pruneTenants(this.now());
    const counts = new Map<string, number>();
    for (const { tier } of this.tenants.values()) {
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
    return counts;
  }

  render(): string {
    const lines = [
      '# HELP quill_api_http_requests_total Completed HTTP requests.',
      '# TYPE quill_api_http_requests_total counter',
      '# HELP quill_api_http_request_duration_seconds HTTP request duration in seconds.',
      '# TYPE quill_api_http_request_duration_seconds histogram',
    ];
    for (const sample of this.samples.values()) {
      lines.push(`quill_api_http_requests_total${renderLabels(sample.labels)} ${sample.count}`);
      BUCKETS.forEach((boundary, index) => {
        lines.push(`quill_api_http_request_duration_seconds_bucket${renderLabels(sample.labels, { le: String(boundary) })} ${sample.buckets[index]}`);
      });
      lines.push(`quill_api_http_request_duration_seconds_bucket${renderLabels(sample.labels, { le: '+Inf' })} ${sample.count}`);
      lines.push(`quill_api_http_request_duration_seconds_sum${renderLabels(sample.labels)} ${sample.sum}`);
      lines.push(`quill_api_http_request_duration_seconds_count${renderLabels(sample.labels)} ${sample.count}`);
    }
    const active = this.activeTenantCounts();
    const activeTotal = [...active.values()].reduce((sum, count) => sum + count, 0);
    lines.push(
      '# HELP quill_api_active_tenants Distinct authenticated tenants seen in the last five minutes.',
      '# TYPE quill_api_active_tenants gauge',
      `quill_api_active_tenants ${activeTotal}`,
      '# HELP quill_api_active_tenants_by_tier Active tenants by normalized billing tier.',
      '# TYPE quill_api_active_tenants_by_tier gauge',
    );
    for (const [tier, count] of [...active.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`quill_api_active_tenants_by_tier{tier="${tier}"} ${count}`);
    }
    return `${lines.join('\n')}\n`;
  }
}

export const apiMetrics = new ApiMetrics();

export function normalizeApiMethod(method: string): string {
  const normalized = method.toUpperCase();
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(normalized)
    ? normalized
    : 'OTHER';
}

export function normalizeApiStatus(status: number): string {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
}
