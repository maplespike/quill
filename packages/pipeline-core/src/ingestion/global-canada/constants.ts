/**
 * Global Canada (GAC / ECCC / CSIS) Constants — Quill
 *
 * Source URLs, department mappings, DDL, and defaults for the combined
 * Global Affairs Canada, Environment and Climate Change Canada, and
 * CSIS metadata tracking module.
 */

import type { GlobalCanadaSource, GlobalCanadaRecordType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const GLOBAL_CANADA_SOURCES: Record<string, Record<string, string>> = {
  GAC: {
    /** Main Global Affairs Canada portal */
    PORTAL: 'https://www.international.gc.ca',
    /** Trade agreements page */
    TRADE_AGREEMENTS: 'https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/index.aspx',
    /** International development projects */
    DEVELOPMENT: 'https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/priorities-priorites/index.aspx',
    /** Foreign policy */
    FOREIGN_POLICY: 'https://www.international.gc.ca/foreign_policy-politique_etrangere/index.aspx',
    /** Sanctions */
    SANCTIONS: 'https://www.international.gc.ca/sanctions/index.aspx',
    /** International assistance */
    ASSISTANCE: 'https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/priorities-priorites/where-ou.aspx',
    /** Open data (CKAN) for international development */
    CKAN_API: 'https://open.canada.ca/data/api/3/action',
  },
  ECCC: {
    /** Main ECCC portal */
    PORTAL: 'https://www.canada.ca/en/environment-climate-change.html',
    /** MSC GeoMet API — weather and climate data */
    MSC_GEOMET: 'https://geo.weather.gc.ca/geomet',
    /** Climate data portal */
    CLIMATE_DATA: 'https://climate.weather.gc.ca/index_e.html',
    /** Weather warnings */
    WEATHER_WARNINGS: 'https://weather.gc.ca/warnings/index_e.html',
    /** Greenhouse gas inventory */
    GHG_INVENTORY: 'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions.html',
    /** Environmental indicators */
    ENV_INDICATORS: 'https://www.canada.ca/en/environment-climate-change/services/environmental-indicators.html',
    /** Canadian Climate Data and Scenarios */
    CLIMATE_SCENARIOS: 'https://climate-scenarios.canada.ca',
  },
  CSIS: {
    /** Main CSIS portal */
    PORTAL: 'https://www.canada.ca/en/security-intelligence-service.html',
    /** Publications page */
    PUBLICATIONS: 'https://www.canada.ca/en/security-intelligence-service/corporate/publications.html',
    /** Annual reports */
    ANNUAL_REPORTS: 'https://www.canada.ca/en/security-intelligence-service/corporate/publications/annual-report.html',
    /** Public briefings */
    BRIEFINGS: 'https://www.canada.ca/en/security-intelligence-service/corporate/publications/public-briefings.html',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Source Configuration                                               */
/* ------------------------------------------------------------------ */

export interface GlobalCanadaSourceConfig {
  /** Human-readable label */
  label: string;
  /** Source system identifier used in DB */
  sourceSystem: GlobalCanadaSource;
  /** Default record type for the source */
  defaultRecordType: GlobalCanadaRecordType;
  /** Default department name */
  department: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const GLOBAL_CANADA_SOURCE_CONFIG: Record<GlobalCanadaSource, GlobalCanadaSourceConfig> = {
  gac: {
    label: 'Global Affairs Canada',
    sourceSystem: 'gac',
    defaultRecordType: 'trade_agreement',
    department: 'Global Affairs Canada',
    defaultLimit: 200,
  },
  eccc: {
    label: 'Environment and Climate Change Canada',
    sourceSystem: 'eccc',
    defaultRecordType: 'climate_data',
    department: 'Environment and Climate Change Canada',
    defaultLimit: 200,
  },
  csis: {
    label: 'Canadian Security Intelligence Service',
    sourceSystem: 'csis',
    defaultRecordType: 'annual_report',
    department: 'Canadian Security Intelligence Service',
    defaultLimit: 100,
  },
};

export const ALL_GLOBAL_CANADA_SOURCES: GlobalCanadaSource[] = ['gac', 'eccc', 'csis'];

/* ------------------------------------------------------------------ */
/*  Record Type Map                                                    */
/* ------------------------------------------------------------------ */

export const GLOBAL_CANADA_RECORD_TYPE_MAP: Record<string, GlobalCanadaRecordType> = {
  'trade agreement': 'trade_agreement',
  'trade_agreement': 'trade_agreement',
  'foreign policy': 'foreign_policy',
  'foreign_policy': 'foreign_policy',
  'development': 'development_project',
  'development project': 'development_project',
  'development_project': 'development_project',
  'aid': 'international_assistance',
  'international assistance': 'international_assistance',
  'international_assistance': 'international_assistance',
  'sanctions': 'sanctions',
  'treaty': 'treaty',
  'climate': 'climate_data',
  'climate data': 'climate_data',
  'climate_data': 'climate_data',
  'weather': 'weather_warning',
  'weather warning': 'weather_warning',
  'weather_warning': 'weather_warning',
  'environmental indicator': 'environmental_indicator',
  'environmental_indicator': 'environmental_indicator',
  'ghg': 'greenhouse_gas_inventory',
  'greenhouse gas': 'greenhouse_gas_inventory',
  'greenhouse_gas_inventory': 'greenhouse_gas_inventory',
  'climate adaptation': 'climate_adaptation',
  'climate_adaptation': 'climate_adaptation',
  'forecast': 'weather_forecast',
  'weather forecast': 'weather_forecast',
  'weather_forecast': 'weather_forecast',
  'annual report': 'annual_report',
  'annual_report': 'annual_report',
  'briefing': 'public_briefing',
  'public briefing': 'public_briefing',
  'public_briefing': 'public_briefing',
  'security advisory': 'security_advisory',
  'security_advisory': 'security_advisory',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const GLOBAL_CANADA_DDL = `
-- Global Canada — GAC / ECCC / CSIS combined metadata tracking
-- Lighter-weight module primarily tracking records with links to source URLs/full docs.
CREATE TABLE IF NOT EXISTS global_canada_records (
  id TEXT PRIMARY KEY,

  -- Source identity
  source_system TEXT NOT NULL CHECK(source_system IN ('gac', 'eccc', 'csis')),
  record_type TEXT NOT NULL CHECK(record_type IN (
    'trade_agreement', 'foreign_policy', 'development_project',
    'international_assistance', 'sanctions', 'treaty',
    'climate_data', 'weather_warning', 'environmental_indicator',
    'greenhouse_gas_inventory', 'climate_adaptation', 'weather_forecast',
    'annual_report', 'public_briefing', 'security_advisory', 'other'
  )),

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  url TEXT NOT NULL,

  -- Department / topic
  department TEXT NOT NULL,
  topic_area TEXT,
  geographic_focus TEXT,

  -- Reference
  reference_number TEXT,
  format TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(title, source_system, url)
);

CREATE INDEX IF NOT EXISTS idx_gc_source ON global_canada_records(source_system);
CREATE INDEX IF NOT EXISTS idx_gc_record_type ON global_canada_records(record_type);
CREATE INDEX IF NOT EXISTS idx_gc_title ON global_canada_records(title);
CREATE INDEX IF NOT EXISTS idx_gc_date ON global_canada_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_gc_department ON global_canada_records(department);
CREATE INDEX IF NOT EXISTS idx_gc_topic ON global_canada_records(topic_area);
CREATE INDEX IF NOT EXISTS idx_gc_geo_focus ON global_canada_records(geographic_focus);
CREATE INDEX IF NOT EXISTS idx_gc_source_type ON global_canada_records(source_system, record_type);
CREATE INDEX IF NOT EXISTS idx_gc_date_source ON global_canada_records(date DESC, source_system);
CREATE INDEX IF NOT EXISTS idx_gc_ingested ON global_canada_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class GlobalCanadaError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'GLOBAL_CANADA_ERROR',
    public readonly source?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'GlobalCanadaError';
  }
}
