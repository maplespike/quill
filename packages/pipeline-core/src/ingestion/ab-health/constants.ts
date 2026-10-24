// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Alberta Health Ingestion Constants — Quill
 *
 * Source URLs, data category enums, DDL, and defaults for ingesting
 * Alberta Health Services (AHS) and Alberta Health data from open.alberta.ca CKAN.
 *
 * Sources:
 *   - Alberta Health Services (AHS) operational metrics
 *   - Alberta Health reports and publications
 */

import type { AHSHealthCategory, AHSRecordType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const AB_HEALTH_SOURCES: Record<string, Record<string, string>> = {
  AHS: {
    BASE: 'https://open.alberta.ca',
    CKAN: 'https://open.alberta.ca/api/3',
    SEARCH: 'https://open.alberta.ca/en/search',
    METRICS: 'https://open.alberta.ca/dataset/alberta-health-services-metrics',
    EMERGENCY: 'https://open.alberta.ca/dataset/emergency-department-wait-times',
    SURGERY: 'https://open.alberta.ca/dataset/surgical-wait-times',
    INPATIENT: 'https://open.alberta.ca/dataset/inpatient-care-metrics',
  },
  ALBERTA_HEALTH: {
    BASE: 'https://www.albertahealthservices.ca',
    REPORTS: 'https://www.albertahealthservices.ca/reports',
    DATA: 'https://www.albertahealthservices.ca/data',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Record Type Configuration                                           */
/* ------------------------------------------------------------------ */

export interface ABHealthSourceConfig {
  /** Human-readable label */
  label: string;
  /** CKAN API base URL */
  ckanUrl: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const AB_HEALTH_TYPE_CONFIG: Record<AHSRecordType, ABHealthSourceConfig> = {
  surgery: {
    label: 'Surgical Wait Times',
    ckanUrl: AB_HEALTH_SOURCES.AHS.CKAN,
    sourceSystem: 'ab-ahs-surgery',
    defaultLimit: 500,
  },
  emergency: {
    label: 'Emergency Department Metrics',
    ckanUrl: AB_HEALTH_SOURCES.AHS.CKAN,
    sourceSystem: 'ab-ahs-emergency',
    defaultLimit: 500,
  },
  diagnostic: {
    label: 'Diagnostic Imaging Metrics',
    ckanUrl: AB_HEALTH_SOURCES.AHS.CKAN,
    sourceSystem: 'ab-ahs-diagnostic',
    defaultLimit: 300,
  },
  inpatient: {
    label: 'Inpatient Care Metrics',
    ckanUrl: AB_HEALTH_SOURCES.AHS.CKAN,
    sourceSystem: 'ab-ahs-inpatient',
    defaultLimit: 300,
  },
};

export const ALL_AHS_RECORD_TYPES: AHSRecordType[] = ['surgery', 'emergency', 'diagnostic', 'inpatient'];

/* ------------------------------------------------------------------ */
/*  Region Mappings                                                    */
/* ------------------------------------------------------------------ */

export const AHS_REGION_MAP: Record<string, string> = {
  'calgary': 'Calgary Zone',
  'edmonton': 'Edmonton Zone',
  'central': 'Central Zone',
  'north': 'North Zone',
  'south': 'South Zone',
  'calgary zone': 'Calgary Zone',
  'edmonton zone': 'Edmonton Zone',
  'central zone': 'Central Zone',
  'north zone': 'North Zone',
  'south zone': 'South Zone',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const AB_HEALTH_DDL = `
-- Alberta Health Services (AHS) operational metrics and Alberta Health data
-- Tracks surgical wait times, emergency department metrics, diagnostic imaging,
-- and inpatient care metrics from Alberta Health Services.
CREATE TABLE IF NOT EXISTS ab_health_records (
  id TEXT PRIMARY KEY,

  -- Record identity
  category TEXT NOT NULL CHECK(category IN (
    'surgery', 'emergency', 'diagnostic', 'inpatient'
  )),

  -- Health metric details
  measure TEXT NOT NULL,
  value TEXT NOT NULL,

  -- Geographic location
  region TEXT,

  -- Time period
  fiscal_year TEXT,
  quarter TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'ab-ahs-surgery',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(category, measure, region, fiscal_year, quarter, source_url)
);

CREATE INDEX IF NOT EXISTS idx_ab_health_category ON ab_health_records(category);
CREATE INDEX IF NOT EXISTS idx_ab_health_measure ON ab_health_records(measure);
CREATE INDEX IF NOT EXISTS idx_ab_health_region ON ab_health_records(region);
CREATE INDEX IF NOT EXISTS idx_ab_health_fiscal_year ON ab_health_records(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_ab_health_quarter ON ab_health_records(quarter);
CREATE INDEX IF NOT EXISTS idx_ab_health_category_region ON ab_health_records(category, region);
CREATE INDEX IF NOT EXISTS idx_ab_health_ingested ON ab_health_records(ingested_at DESC);

-- Table for Alberta Health general publications and reports
CREATE TABLE IF NOT EXISTS ab_health_publications (
  id TEXT PRIMARY KEY,

  -- Publication identity
  title TEXT NOT NULL,
  topic TEXT NOT NULL,

  -- Publication details
  publication_date TEXT,
  data_type TEXT,

  -- Source
  url TEXT NOT NULL,
  summary TEXT,

  -- Provenance
  source_system TEXT NOT NULL DEFAULT 'ab-health',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(title, url)
);

CREATE INDEX IF NOT EXISTS idx_ab_health_pub_topic ON ab_health_publications(topic);
CREATE INDEX IF NOT EXISTS idx_ab_health_pub_date ON ab_health_publications(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_ab_health_pub_type ON ab_health_publications(data_type);
CREATE INDEX IF NOT EXISTS idx_ab_health_pub_ingested ON ab_health_publications(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export const ALL_AB_HEALTH_TYPES = ['surgery', 'emergency', 'diagnostic', 'inpatient'] as const;

export class ABHealthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AB_HEALTH_ERROR',
    public readonly recordType?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ABHealthError';
  }
}