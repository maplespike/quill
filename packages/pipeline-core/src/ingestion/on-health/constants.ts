/**
 * Ontario Health Ingestion Constants — Quill
 *
 * Source URLs, data type enums, DDL, and defaults for ingesting
 * Ontario health data from:
 *   - OHIP claims data (Ontario Ministry of Health, data.ontario.ca CKAN)
 *   - Public Health Ontario publications (www.publichealthontario.ca)
 *
 * Primary sources:
 *   OHIP claims: https://data.ontario.ca/dataset/ohip-claims
 *   Public Health Ontario: https://www.publichealthontario.ca/en/data-and-analysis
 */

import type { OHIPClaimType, PublicHealthTopic } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const ON_HEALTH_SOURCES: Record<string, Record<string, string>> = {
  OHIP_CLAIMS: {
    BASE: 'https://data.ontario.ca',
    CKAN_API: 'https://data.ontario.ca/api/3/action/package_show',
    DATASET: 'https://data.ontario.ca/dataset/ohip-claims',
    CSV: 'https://data.ontario.ca/dataset/ohip-claims/resource/',
  },
  PUBLIC_HEALTH: {
    BASE: 'https://www.publichealthontario.ca',
    DATA: 'https://www.publichealthontario.ca/en/data-and-analysis',
    PUBLICATIONS: 'https://www.publichealthontario.ca/en/publications',
    RSS: 'https://www.publichealthontario.ca/en/rss',
  },
  CKAN: {
    API: 'https://data.ontario.ca/api/3/action',
    SEARCH: 'https://data.ontario.ca/dataset?q=',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Data Type Configuration                                            */
/* ------------------------------------------------------------------ */

export interface OntarioHealthSourceConfig {
  /** Human-readable label */
  label: string;
  /** API base URL */
  apiUrl: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const ON_HEALTH_TYPE_CONFIG: Record<string, OntarioHealthSourceConfig> = {
  ohip: {
    label: 'OHIP Claims Data',
    apiUrl: ON_HEALTH_SOURCES.OHIP_CLAIMS.CKAN_API,
    sourceSystem: 'on-health-ohip',
    defaultLimit: 500,
  },
  public_health: {
    label: 'Public Health Ontario Publications',
    apiUrl: ON_HEALTH_SOURCES.PUBLIC_HEALTH.DATA,
    sourceSystem: 'on-health-pho',
    defaultLimit: 200,
  },
};

/* ------------------------------------------------------------------ */
/*  Type Mappings                                                      */
/* ------------------------------------------------------------------ */

export const OHIP_CLAIM_TYPE_MAP: Record<string, OHIPClaimType> = {
  'physician': 'physician_service',
  'physician service': 'physician_service',
  'lab': 'laboratory',
  'laboratory': 'laboratory',
  'diagnostic': 'diagnostic_imaging',
  'diagnostic imaging': 'diagnostic_imaging',
  'hospital': 'hospital_service',
  'hospital service': 'hospital_service',
  'dental': 'dental_service',
  'dental service': 'dental_service',
  'optometry': 'optometry_service',
  'optometry service': 'optometry_service',
};

export const PUBLIC_HEALTH_TOPIC_MAP: Record<string, PublicHealthTopic> = {
  'infectious disease': 'infectious_disease',
  'infectious': 'infectious_disease',
  'chronic disease': 'chronic_disease',
  'chronic': 'chronic_disease',
  'environmental health': 'environmental_health',
  'environmental': 'environmental_health',
  'health promotion': 'health_promotion',
  'promotion': 'health_promotion',
  'injury prevention': 'injury_prevention',
  'injury': 'injury_prevention',
  'mental health': 'mental_health',
  'mental': 'mental_health',
  'substance use': 'substance_use',
  'substance': 'substance_use',
  'health equity': 'health_equity',
  'equity': 'health_equity',
  'surveillance': 'surveillance',
  'epidemiology': 'epidemiology',
  'vaccine': 'vaccination',
  'vaccination': 'vaccination',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const ON_HEALTH_DDL = `
-- Ontario Health Records — OHIP claims and Public Health Ontario publications
-- Tracks Ontario health service claims and public health publications.
CREATE TABLE IF NOT EXISTS ontario_health_records (
  id TEXT PRIMARY KEY,

  -- Record type
  record_type TEXT NOT NULL CHECK(record_type IN (
    'ohip_claim', 'public_health'
  )),

  -- OHIP claims fields
  claim_type TEXT CHECK(claim_type IN (
    'physician_service', 'laboratory', 'diagnostic_imaging',
    'hospital_service', 'dental_service', 'optometry_service'
  )),
  service_code TEXT,
  fee_schedule TEXT,
  service_date TEXT,
  provider_type TEXT,
  claims_count INTEGER,
  total_paid REAL,

  -- Fiscal year (YYYY-YYYY format)
  fiscal_year TEXT,

  -- Public Health Ontario fields
  title TEXT,
  topic TEXT CHECK(topic IN (
    'infectious_disease', 'chronic_disease', 'environmental_health',
    'health_promotion', 'injury_prevention', 'mental_health',
    'substance_use', 'health_equity', 'surveillance', 'epidemiology',
    'vaccination', 'other'
  )),
  publication_date TEXT,

  -- Summary/description
  summary TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'on-health-ohip',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(record_type, service_code, source_url),
  UNIQUE(record_type, title, source_url)
);

CREATE INDEX IF NOT EXISTS idx_onh_record_type ON ontario_health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_onh_claim_type ON ontario_health_records(claim_type);
CREATE INDEX IF NOT EXISTS idx_onh_service_code ON ontario_health_records(service_code);
CREATE INDEX IF NOT EXISTS idx_onh_fiscal_year ON ontario_health_records(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_onh_service_date ON ontario_health_records(service_date);
CREATE INDEX IF NOT EXISTS idx_onh_topic ON ontario_health_records(topic);
CREATE INDEX IF NOT EXISTS idx_onh_publication_date ON ontario_health_records(publication_date);
CREATE INDEX IF NOT EXISTS idx_onh_provider_type ON ontario_health_records(provider_type);
CREATE INDEX IF NOT EXISTS idx_onh_title ON ontario_health_records(title);
CREATE INDEX IF NOT EXISTS idx_onh_ingested ON ontario_health_records(ingested_at DESC);
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

export const ALL_ON_HEALTH_TYPES = ['ohip_claim', 'public_health'] as const;

export class OntarioHealthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ON_HEALTH_ERROR',
    public readonly recordType?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'OntarioHealthError';
  }
}