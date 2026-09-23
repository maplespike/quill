import type { RealtimeSource } from './types.js';

export interface RealtimeSourceConfig {
  source: RealtimeSource;
  name: string;
  url: string;
  format: 'rss' | 'json' | 'xml' | 'html';
  refreshSeconds: number;
  description: string;
  enabled: boolean;
}

/**
 * Catalogue of real-time sources.
 *
 * `enabled` marks whether a fetcher exists AND the endpoint is reachable.
 * Only three sources have a fetcher today: `eccc-weather-alerts`,
 * `cbsa-border-wait-times`, `parole-board-decisions` — see fetchAllRealtime().
 * The rest are catalogued for future work and are marked disabled: every
 * `dd.weather.gc.ca/...` path returns 404 (the data server layout has moved),
 * so nothing is wired to them.
 *
 * URLs verified 2026-09-23; the dead ones this file used to carry:
 *   - dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml → 404
 *     (replaced by the OGC API Features endpoint on api.weather.gc.ca)
 *   - www.cbsa-asfc.gc.ca/bwt-taf/bwt_taf-eng.json → 404
 *     (the live file is bwt-eng.json)
 */
export const REALTIME_SOURCES: RealtimeSourceConfig[] = [
  {
    source: 'eccc-weather-alerts',
    name: 'Environment Canada Weather Alerts',
    url: 'https://api.weather.gc.ca/collections/weather-alerts/items?f=json',
    format: 'json',
    refreshSeconds: 300,
    description: 'Live weather alerts (advisories, watches, warnings) across all provinces, served as OGC API Features GeoJSON',
    enabled: true,
  },
  {
    source: 'cbsa-border-wait-times',
    name: 'CBSA Border Wait Times',
    url: 'https://www.cbsa-asfc.gc.ca/bwt-taf/bwt-eng.json',
    format: 'json',
    refreshSeconds: 600,
    description: 'Live border wait times at major Canada-US land border crossings (waitTimes[] with commercial and traveller lanes)',
    enabled: true,
  },
  {
    source: 'alert-ready',
    name: 'Alert Ready — National Public Alerting System',
    url: 'https://www.alertready.ca/',
    format: 'html',
    refreshSeconds: 900,
    description: "Canada's national public alerting system for imminent threats (Amber Alerts, tornado, floods)",
    // Endpoint reachable (200 HTML) but no fetcher is implemented.
    enabled: false,
  },
  {
    source: 'parole-board-decisions',
    name: 'Parole Board of Canada Decision Registry',
    url: 'https://www.canada.ca/en/parole-board/services/decision-registry.html',
    format: 'html',
    refreshSeconds: 86400,
    description: 'Published parole board decisions and registry of recent rulings',
    enabled: true,
  },
  {
    source: 'eccc-weather-observations',
    name: 'Environment Canada Weather Observations',
    url: 'https://api.weather.gc.ca/collections/swob-realtime/items?f=json',
    format: 'json',
    refreshSeconds: 3600,
    description: 'Latest hourly weather observations from stations across Canada',
    // Repointed from the 404 dd.weather.gc.ca tree; no fetcher implemented yet.
    enabled: false,
  },
  {
    source: 'eccc-aqhi',
    name: 'Environment Canada Air Quality Health Index',
    url: 'https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?f=json',
    format: 'json',
    refreshSeconds: 3600,
    description: 'Air Quality Health Index readings and forecasts for Canadian cities. Includes PM2.5, ozone, NO2 levels.',
    // Repointed from the 404 dd.weather.gc.ca tree; no fetcher implemented yet.
    enabled: false,
  },
  {
    source: 'water-survey-flood',
    name: 'Water Survey of Canada — Real-Time Hydrometric Data',
    url: 'https://api.weather.gc.ca/collections/hydrometric-realtime/items?f=json',
    format: 'json',
    refreshSeconds: 3600,
    description: 'Real-time river levels, streamflow, and water level data from monitoring stations. Flood warnings and high-flow alerts.',
    // Repointed from the 404 dd.weather.gc.ca tree; no fetcher implemented yet.
    enabled: false,
  },
];

export const REALTIME_FETCH_TIMEOUT_MS = 15_000;
export const REALTIME_USER_AGENT = 'MapleSpike-Realtime/1.0 (+https://github.com/reverb256/quill)';
export const MAX_REALTIME_RECORDS = 200;
export const REALTIME_CACHE_TTL_MS = 60_000; // 1-minute cache for fast re-queries

// ── MSC AMQPS Configuration ─────────────────────────────
// `q.weather.gc.ca` has no DNS record (ENOTFOUND, verified 2026-09-23), so the
// AMQPS push subscriber cannot connect. It is opt-IN via MSC_AMQPS_ENABLED=true
// rather than opt-out: defaulting it on spent every run on a host that does not
// resolve. Flip the default back once the broker answers.
export const MSC_AMQPS_URL = 'amqps://q.weather.gc.ca:5671';
export const MSC_AMQPS_QUEUE = 'v00.msc-alerts.cap';
export const MSC_AMQPS_TOPIC = 'v00.msc-alerts.cap';
export const MSC_AMQPS_ENABLED = process.env['MSC_AMQPS_ENABLED'] === 'true';
