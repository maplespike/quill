// SPDX-License-Identifier: AGPL-3.0-only
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
 * ECCC weather alerts — GeoAPI items endpoint (GH#921 repair).
 * The old flat CAP index (dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml)
 * was removed when the datamart restructured to date-stamped directories;
 * the GeoAPI collection serves the same alerts as GeoJSON.
 */
export const ECCC_ALERTS_GEOAPI_URL =
  'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=';

/**
 * CBSA border wait times — HTML table (GH#921 repair).
 * The JSON feed (bwt-taf/bwt_taf-eng.json) was removed; the menu page's
 * `#bwttaf` table carries the same 29 crossings.
 */
export const CBSA_BWT_HTML_URL = 'https://www.cbsa-asfc.gc.ca/bwt-taf/menu-eng.html';

export const REALTIME_SOURCES: RealtimeSourceConfig[] = [
  {
    source: 'eccc-weather-alerts',
    name: 'Environment Canada Weather Alerts',
    url: 'https://api.weather.gc.ca/collections/weather-alerts/items',
    format: 'json',
    refreshSeconds: 300,
    description: 'Weather alerts — warnings, watches, statements across all provinces (GeoAPI)',
    enabled: true,
  },
  {
    source: 'cbsa-border-wait-times',
    name: 'CBSA Border Wait Times',
    url: CBSA_BWT_HTML_URL,
    format: 'html',
    refreshSeconds: 600,
    description: 'Live border wait times at major Canada-US land border crossings',
    enabled: true,
  },
  {
    source: 'alert-ready',
    name: 'Alert Ready — National Public Alerting System',
    url: 'https://www.alertready.ca/',
    format: 'html',
    refreshSeconds: 900,
    description: 'Canada\'s national public alerting system for imminent threats (Amber Alerts, tornado, floods)',
    enabled: true,
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
    url: 'https://dd.weather.gc.ca/observations/swob-ml/latest/',
    format: 'xml',
    refreshSeconds: 3600,
    description: 'Latest hourly weather observations from stations across Canada',
    enabled: true,
  },
  {
    source: 'eccc-aqhi',
    name: 'Environment Canada Air Quality Health Index',
    url: 'https://dd.weather.gc.ca/air_quality/aqhi/pollen/forecast/aqhi_forecast_hourly.csv',
    format: 'json',
    refreshSeconds: 3600,
    description: 'Air Quality Health Index readings and forecasts for Canadian cities. Includes PM2.5, ozone, NO2 levels.',
    enabled: true,
  },
  {
    source: 'water-survey-flood',
    name: 'Water Survey of Canada — Real-Time Hydrometric Data',
    url: 'https://dd.weather.gc.ca/hydrometric/csv/',
    format: 'json',
    refreshSeconds: 3600,
    description: 'Real-time river levels, streamflow, and water level data from monitoring stations. Flood warnings and high-flow alerts.',
    enabled: true,
  },
];

export const REALTIME_FETCH_TIMEOUT_MS = 15_000;
export const REALTIME_USER_AGENT = 'MapleSpike-Realtime/1.0 (+https://github.com/reverb256/quill)';
export const MAX_REALTIME_RECORDS = 200;
export const REALTIME_CACHE_TTL_MS = 60_000; // 1-minute cache for fast re-queries

// ── MSC AMQPS Configuration ─────────────────────────────
// GH#921 repair: the broker host q.weather.gc.ca no longer resolves. The MSC
// AMQP docs (eccc-msc.github.io/open-data/msc-datamart/amqp_en/) place the
// SSL broker at dd.weather.gc.ca with anonymous credentials; the queue name
// must follow the q_anonymous.* convention (the broker refuses arbitrary
// queue names for the anonymous user — verified live 2026-09-23).
export const MSC_AMQPS_URL = 'amqps://anonymous:anonymous@dd.weather.gc.ca:5671';
/** Sarracenia convention: exchange xpublic, topicPrefix v02.post. */
export const MSC_AMQPS_EXCHANGE = 'xpublic';
export const MSC_AMQPS_TOPIC = 'v02.post.*.WXO-DD.alerts.cap.#';
/** Queue name must start with q_anonymous. (broker policy, verified live). */
export const MSC_AMQPS_QUEUE = 'q_anonymous.subscribe.quill.maplespike';
export const MSC_AMQPS_ENABLED = process.env['MSC_AMQPS_ENABLED'] !== 'false'; // opt-out via env
