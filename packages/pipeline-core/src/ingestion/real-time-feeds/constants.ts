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

export const REALTIME_SOURCES: RealtimeSourceConfig[] = [
  {
    source: 'eccc-weather-alerts',
    name: 'Environment Canada Weather Alerts',
    url: 'https://dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml',
    format: 'xml',
    refreshSeconds: 300,
    description: 'CAP-CP weather alert feed — warnings, watches, statements across all provinces',
    enabled: true,
  },
  {
    source: 'cbsa-border-wait-times',
    name: 'CBSA Border Wait Times',
    url: 'https://www.cbsa-asfc.gc.ca/bwt-taf/bwt_taf-eng.json',
    format: 'json',
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
export const MSC_AMQPS_URL = 'amqps://q.weather.gc.ca:5671';
export const MSC_AMQPS_QUEUE = 'v00.msc-alerts.cap';
export const MSC_AMQPS_TOPIC = 'v00.msc-alerts.cap';
export const MSC_AMQPS_ENABLED = process.env['MSC_AMQPS_ENABLED'] !== 'false'; // opt-out via env
