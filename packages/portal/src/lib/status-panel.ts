/**
 * Render the public status panels.
 *
 * The HTML is aggregate only: city totals, dataset names, record counts,
 * public source hosts, and timestamps. It does not render record bodies,
 * names, or email addresses. Callers pass the `data` object from
 * GET /v1/status, GET /v1/municipal/health, and GET /v1/municipal/coverage.
 */

export type StatusLang = 'en' | 'fr';

export interface StatusPayload {
  timestamp?: unknown;
  sla?: {
    uptime?: unknown;
    freshness?: unknown;
  };
  claims?: { stored?: unknown };
  publicEndpoints?: unknown;
}

export interface HealthCity {
  city_id?: unknown;
  label_preferred?: unknown;
  label_en?: unknown;
  label_fr?: unknown;
  province?: unknown;
  status?: unknown;
  cached_datasets?: unknown;
  cached_records?: unknown;
  freshest_age_seconds?: unknown;
  last_succeeded_at?: unknown;
  likely_blocked?: unknown;
}

export interface HealthPayload {
  threshold?: {
    stale_after_seconds?: unknown;
    cutoff_iso?: unknown;
  };
  summary?: {
    cities_total?: unknown;
    cities_by_status?: {
      cached?: unknown;
      stale?: unknown;
      uncached?: unknown;
    };
    total_cached_records?: unknown;
    last_check_at?: unknown;
  };
  cities?: unknown;
}

export interface CoverageDataset {
  dataset?: unknown;
  source?: unknown;
  record_count?: unknown;
  succeeded_at?: unknown;
  age_seconds?: unknown;
}

export interface CoverageCity {
  cityId?: unknown;
  datasets?: unknown;
  freshest_age_seconds?: unknown;
  oldest_age_seconds?: unknown;
  total_records?: unknown;
}

export interface CoveragePayload {
  fetched_at?: unknown;
  summary?: {
    cities_with_cache?: unknown;
    total_cached_datasets?: unknown;
    total_cached_records?: unknown;
    freshest_age_seconds?: unknown;
    oldest_age_seconds?: unknown;
  };
  cities?: unknown;
}

const MAX_ROWS = 80;

const COPY = {
  en: {
    unavailable: 'This source did not respond.',
    checked: 'Checked',
    uptime: 'Uptime',
    claims: 'Claims stored',
    windows: 'Freshness windows',
    endpoints: 'Public endpoints',
    cities: 'Cities',
    cached: 'Cached',
    stale: 'Stale',
    uncached: 'Uncached',
    records: 'Cached records',
    lastCheck: 'Last check',
    window: 'Freshness window',
    cutoff: 'Stale before',
    datasets: 'Datasets',
    age: 'Freshest age',
    oldest: 'Oldest age',
    lastSuccess: 'Last success',
    signal: 'Signal',
    fresh: 'Fresh',
    pastWindow: 'Past freshness window',
    noFetch: 'No successful fetch',
    likely: 'Likely blocked',
    coverageCities: 'Cities with cache',
    coverageDatasets: 'Cached datasets',
    fetched: 'Coverage read',
    source: 'Source',
    succeeded: 'Succeeded',
    note: 'Likely blocked means no successful fetch inside the freshness window. The figure is a city total. It is not a confirmed block.',
    omitted: 'Further rows are omitted.',
  },
  fr: {
    unavailable: 'Cette source n\'a pas répondu.',
    checked: 'Vérifié',
    uptime: 'Disponibilité',
    claims: 'Réclamations stockées',
    windows: 'Fenêtres de fraîcheur',
    endpoints: 'Points de terminaison publics',
    cities: 'Villes',
    cached: 'En cache',
    stale: 'Périmé',
    uncached: 'Sans cache',
    records: 'Enregistrements en cache',
    lastCheck: 'Dernière vérification',
    window: 'Fenêtre de fraîcheur',
    cutoff: 'Périmé avant',
    datasets: 'Jeux de données',
    age: 'Âge le plus récent',
    oldest: 'Âge le plus ancien',
    lastSuccess: 'Dernier succès',
    signal: 'Signal',
    fresh: 'Frais',
    pastWindow: 'Hors fenêtre de fraîcheur',
    noFetch: 'Aucun succès enregistré',
    likely: 'Blocage probable',
    coverageCities: 'Villes avec cache',
    coverageDatasets: 'Jeux en cache',
    fetched: 'Lecture de la couverture',
    source: 'Source',
    succeeded: 'Réussi',
    note: 'Blocage probable signifie qu\'aucun succès n\'est dans la fenêtre de fraîcheur. Le chiffre est un total par ville. Ce n\'est pas un blocage confirmé.',
    omitted: 'Les lignes suivantes sont omises.',
  },
} as const;

/** A city with no success inside the freshness window. */
export function likelyBlocked(city: HealthCity): boolean {
  if (typeof city.likely_blocked === 'boolean') return city.likely_blocked;
  return city.status === 'stale' || city.status === 'uncached';
}

export function formatAge(seconds: unknown, lang: StatusLang): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 90) return `${s}s`;
  const minutes = Math.round(s / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return lang === 'fr' ? `${hours} h` : `${hours} h`;
  const days = Math.round(hours / 24);
  return lang === 'fr' ? `${days} j` : `${days} d`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Public label. Rejects addresses and markup. Returns an empty string when unsafe. */
function safeText(value: unknown, max = 80): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return '';
  if (/[@<>]|[\r\n]/.test(trimmed)) return '';
  return escapeHtml(trimmed);
}

function safeId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(trimmed)) return '';
  return trimmed;
}

function safeCount(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  return String(Math.round(value));
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function timeHtml(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO.test(value)) {
    return `<span data-field="${field}">—</span>`;
  }
  return `<time data-field="${field}" datetime="${value}">${value}</time>`;
}

function publicHost(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300) return '';
  try {
    const url = new URL(value);
    if (url.username || url.password) return '';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.search || url.hash) return '';
    return safeText(url.host, 120);
  } catch {
    return '';
  }
}

function row(parts: string): string {
  return `<div class="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">${parts}</div>`;
}

function stat(label: string, field: string, valueHtml: string): string {
  return `<div class="flex justify-between gap-4 text-sm"><span class="text-muted-foreground">${escapeHtml(label)}</span><span data-field="${field}" class="font-mono text-xs text-right">${valueHtml}</span></div>`;
}

function signalCopy(city: HealthCity, lang: StatusLang): { blocked: 'yes' | 'no'; label: string; tone: string } {
  const copy = COPY[lang];
  if (!likelyBlocked(city)) {
    return { blocked: 'no', label: copy.fresh, tone: 'bg-green-500/10 text-green-600 border-green-500/20' };
  }
  if (city.status === 'uncached') {
    return { blocked: 'yes', label: copy.likely, tone: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
  }
  return { blocked: 'yes', label: copy.pastWindow, tone: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
}

export function renderFreshnessInner(payload: StatusPayload | null, lang: StatusLang): string {
  const copy = COPY[lang];
  if (!payload) return `<p class="text-sm text-muted-foreground" data-field="freshness-unavailable">${escapeHtml(copy.unavailable)}</p>`;

  const windows = payload.sla && payload.sla.freshness && typeof payload.sla.freshness === 'object'
    ? Object.entries(payload.sla.freshness as Record<string, unknown>)
    : [];
  const windowRows = windows.slice(0, MAX_ROWS).map(([name, cadence]) => {
    const label = safeText(name, 80);
    const value = safeText(cadence, 40);
    if (!label || !value) return '';
    return row(
      `<span class="flex-1 text-sm font-medium" data-field="freshness-window">${label}</span>` +
      `<span class="text-xs font-mono text-muted-foreground" data-field="freshness-cadence">${value}</span>`,
    );
  }).join('');

  const endpoints = payload.publicEndpoints && typeof payload.publicEndpoints === 'object'
    ? Object.entries(payload.publicEndpoints as Record<string, unknown>)
    : [];
  const endpointRows = endpoints.slice(0, MAX_ROWS).map(([name, path]) => {
    const label = safeText(name, 40);
    const value = safeText(path, 80);
    if (!label || !value || !value.startsWith('/')) return '';
    return row(
      `<span class="flex-1 text-sm font-medium" data-field="endpoint-name">${label}</span>` +
      `<code class="text-xs font-mono" data-field="endpoint-path">${value}</code>`,
    );
  }).join('');

  const uptime = safeText(payload.sla?.uptime, 80);

  return [
    `<div class="space-y-2">`,
    stat(copy.checked, 'status-checked', timeHtml(payload.timestamp, 'status-timestamp')),
    uptime ? stat(copy.uptime, 'sla-uptime', uptime) : '',
    stat(copy.claims, 'claims-stored', safeCount(payload.claims?.stored)),
    windowRows ? `<p class="pt-2 text-xs text-muted-foreground">${escapeHtml(copy.windows)}</p>${windowRows}` : '',
    endpointRows ? `<p class="pt-2 text-xs text-muted-foreground">${escapeHtml(copy.endpoints)}</p>${endpointRows}` : '',
    `</div>`,
  ].join('');
}

export function renderHealthInner(payload: HealthPayload | null, lang: StatusLang): string {
  const copy = COPY[lang];
  if (!payload) return `<p class="text-sm text-muted-foreground" data-field="health-unavailable">${escapeHtml(copy.unavailable)}</p>`;

  const summary = payload.summary ?? {};
  const by = summary.cities_by_status ?? {};
  const cities = Array.isArray(payload.cities) ? payload.cities as HealthCity[] : [];
  const shown = cities.slice(0, MAX_ROWS);
  const cityRows = shown.map((city) => {
    const id = safeId(city.city_id);
    const label = safeText(city.label_preferred, 80)
      || safeText(lang === 'fr' ? city.label_fr : city.label_en, 80)
      || id;
    if (!id || !label) return '';
    const status = city.status === 'cached' || city.status === 'stale' || city.status === 'uncached'
      ? city.status
      : '';
    const signal = signalCopy(city, lang);
    const detail = city.status === 'uncached' ? copy.noFetch : '';
    return row(
      `<span class="flex-1 text-sm font-medium" data-field="city-label" data-city="${id}">${label}</span>` +
      `<span class="text-xs font-mono text-muted-foreground" data-field="province">${safeText(city.province, 8) || '—'}</span>` +
      `<span class="text-xs font-mono" data-field="health-status">${status || '—'}</span>` +
      `<span class="text-xs font-mono" data-field="cached-datasets">${safeCount(city.cached_datasets)}</span>` +
      `<span class="text-xs font-mono" data-field="cached-records">${safeCount(city.cached_records)}</span>` +
      `<span class="text-xs font-mono" data-field="freshest-age">${formatAge(city.freshest_age_seconds, lang)}</span>` +
      timeHtml(city.last_succeeded_at, 'last-succeeded-at') +
      `<span class="text-xs rounded border px-1.5 py-0.5 ${signal.tone}" data-field="likely-blocked" data-blocked="${signal.blocked}">${escapeHtml(signal.label)}</span>` +
      (detail ? `<span class="text-xs text-muted-foreground" data-field="signal-detail">${escapeHtml(detail)}</span>` : ''),
    );
  }).join('');

  return [
    `<div class="space-y-2">`,
    stat(copy.cities, 'cities-total', safeCount(summary.cities_total)),
    stat(copy.cached, 'cities-cached', safeCount(by.cached)),
    stat(copy.stale, 'cities-stale', safeCount(by.stale)),
    stat(copy.uncached, 'cities-uncached', safeCount(by.uncached)),
    stat(copy.records, 'health-cached-records', safeCount(summary.total_cached_records)),
    stat(copy.lastCheck, 'last-check', timeHtml(summary.last_check_at, 'last-check-at')),
    stat(copy.window, 'stale-after', safeCount(payload.threshold?.stale_after_seconds) + 's'),
    stat(copy.cutoff, 'cutoff', timeHtml(payload.threshold?.cutoff_iso, 'cutoff-iso')),
    cityRows,
    cities.length > MAX_ROWS ? `<p class="text-xs text-muted-foreground">${escapeHtml(copy.omitted)}</p>` : '',
    `<p class="pt-2 text-xs text-muted-foreground">${escapeHtml(copy.note)}</p>`,
    `</div>`,
  ].join('');
}

export function renderCoverageInner(payload: CoveragePayload | null, lang: StatusLang): string {
  const copy = COPY[lang];
  if (!payload) return `<p class="text-sm text-muted-foreground" data-field="coverage-unavailable">${escapeHtml(copy.unavailable)}</p>`;

  const summary = payload.summary ?? {};
  const cities = Array.isArray(payload.cities) ? payload.cities as CoverageCity[] : [];
  const shown = cities.slice(0, MAX_ROWS);
  const cityRows = shown.map((city) => {
    const id = safeId(city.cityId);
    if (!id) return '';
    const datasets = Array.isArray(city.datasets) ? city.datasets as CoverageDataset[] : [];
    const datasetRows = datasets.slice(0, 12).map((dataset) => {
      const name = safeId(dataset.dataset) || safeText(dataset.dataset, 40);
      if (!name) return '';
      const host = publicHost(dataset.source);
      return row(
        `<span class="flex-1 text-sm" data-field="dataset" data-city="${id}">${escapeHtml(name)}</span>` +
        (host ? `<span class="text-xs font-mono text-muted-foreground" data-field="source-host">${host}</span>` : '') +
        `<span class="text-xs font-mono" data-field="dataset-records">${safeCount(dataset.record_count)}</span>` +
        `<span class="text-xs font-mono" data-field="dataset-age">${formatAge(dataset.age_seconds, lang)}</span>` +
        timeHtml(dataset.succeeded_at, 'succeeded-at'),
      );
    }).join('');
    return [
      row(
        `<span class="flex-1 text-sm font-medium" data-field="coverage-city" data-city="${id}">${id}</span>` +
        `<span class="text-xs font-mono" data-field="coverage-records">${safeCount(city.total_records)}</span>` +
        `<span class="text-xs font-mono" data-field="coverage-freshest">${formatAge(city.freshest_age_seconds, lang)}</span>` +
        `<span class="text-xs font-mono" data-field="coverage-oldest">${formatAge(city.oldest_age_seconds, lang)}</span>`,
      ),
      datasetRows,
    ].join('');
  }).join('');

  return [
    `<div class="space-y-2">`,
    stat(copy.coverageCities, 'cities-with-cache', safeCount(summary.cities_with_cache)),
    stat(copy.coverageDatasets, 'cached-datasets', safeCount(summary.total_cached_datasets)),
    stat(copy.records, 'coverage-cached-records', safeCount(summary.total_cached_records)),
    stat(copy.age, 'coverage-freshest-age', formatAge(summary.freshest_age_seconds, lang)),
    stat(copy.oldest, 'coverage-oldest-age', formatAge(summary.oldest_age_seconds, lang)),
    stat(copy.fetched, 'coverage-fetched', timeHtml(payload.fetched_at, 'fetched-at')),
    cityRows,
    cities.length > MAX_ROWS ? `<p class="text-xs text-muted-foreground">${escapeHtml(copy.omitted)}</p>` : '',
    `</div>`,
  ].join('');
}
