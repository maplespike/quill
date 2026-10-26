// SPDX-License-Identifier: AGPL-3.0-only
/**
 * BC Health Ingestion Constants — Quill
 *
 * Source URLs, DDL, and defaults for ingesting BC health data:
 *   - BC PharmaCare claims data
 *   - BC CDC publications
 */

import type { PharmaCareFormularyStatus } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const BC_HEALTH_SOURCES: Record<string, Record<string, string>> = {
  PHARMACARE: {
    BASE: 'https://catalogue.data.gov.bc.ca/dataset/pharmacare-benefits-claims-data',
    SEARCH: 'https://catalogue.data.gov.bc.ca/dataset/pharmacare-benefits-claims-data',
    CKAN_API: 'https://catalogue.data.gov.bc.ca/api/3/action/package_show',
    RESOURCE: 'https://catalogue.data.gov.bc.ca/dataset/66d219d3-4625-4260-8207-bb7c9d685088/resource',
  },
  BC_CDC: {
    BASE: 'https://www.bccdc.ca',
    SEARCH: 'https://www.bccdc.ca/search',
    PUBLICATIONS: 'https://www.bccdc.ca/about/publications',
    DISEASE: 'https://www.bccdc.ca/health-info/diseases-conditions',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Source Configuration                                               */
/* ------------------------------------------------------------------ */

export interface BCHealthSourceConfig {
  /** Human-readable label */
  label: string;
  /** API or base URL */
  url: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const BC_HEALTH_SOURCE_CONFIG: Record<string, BCHealthSourceConfig> = {
  pharmacare: {
    label: 'BC PharmaCare',
    url: BC_HEALTH_SOURCES.PHARMACARE.BASE,
    sourceSystem: 'bc-pharmacare',
    defaultLimit: 500,
  },
  bccdc: {
    label: 'BC CDC',
    url: BC_HEALTH_SOURCES.BC_CDC.BASE,
    sourceSystem: 'bc-cdc',
    defaultLimit: 200,
  },
};

export const ALL_BC_HEALTH_SOURCES = ['pharmacare', 'bccdc'] as const;

/* ------------------------------------------------------------------ */
/*  Formulary Status Mapping                                           */
/* ------------------------------------------------------------------ */

export const BC_FORMULARY_STATUS_MAP: Record<string, PharmaCareFormularyStatus> = {
  'full': 'full',
  'full benefit': 'full',
  'f': 'full',
  'restricted': 'restricted',
  'special authority': 'restricted',
  'restricted benefit': 'restricted',
  'r': 'restricted',
  'non': 'non',
  'non-benefit': 'non',
  'not covered': 'non',
  'n': 'non',
  'non benefit': 'non',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const BC_HEALTH_DDL = `
-- BC Health — PharmaCare and BC CDC records
-- Tracks BC PharmaCare claims data and BC CDC publications.
CREATE TABLE IF NOT EXISTS bc_health_records (
  id TEXT PRIMARY KEY,

  -- Record type
  record_type TEXT NOT NULL CHECK(record_type IN ('pharmacare', 'bccdc')),

  -- PharmaCare fields
  drug_name TEXT,
  manufacturer TEXT,
  formulary_status TEXT CHECK(formulary_status IN ('full', 'restricted', 'non')),
  atc_code TEXT,
  therapeutic_category TEXT,
  claim_count INTEGER,
  total_cost REAL,
  fiscal_year TEXT,

  -- BC CDC fields
  title TEXT,
  topic TEXT,
  publication_date TEXT,
  disease_focus TEXT,
  url TEXT,
  summary TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(record_type, COALESCE(drug_name, ''), COALESCE(title, ''), source_url)
);

CREATE INDEX IF NOT EXISTS idx_bc_health_type ON bc_health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_bc_health_drug_name ON bc_health_records(drug_name);
CREATE INDEX IF NOT EXISTS idx_bc_health_manufacturer ON bc_health_records(manufacturer);
CREATE INDEX IF NOT EXISTS idx_bc_health_formulary ON bc_health_records(formulary_status);
CREATE INDEX IF NOT EXISTS idx_bc_health_atc_code ON bc_health_records(atc_code);
CREATE INDEX IF NOT EXISTS idx_bc_health_category ON bc_health_records(therapeutic_category);
CREATE INDEX IF NOT EXISTS idx_bc_health_fiscal_year ON bc_health_records(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_bc_health_title ON bc_health_records(title);
CREATE INDEX IF NOT EXISTS idx_bc_health_topic ON bc_health_records(topic);
CREATE INDEX IF NOT EXISTS idx_bc_health_disease_focus ON bc_health_records(disease_focus);
CREATE INDEX IF NOT EXISTS idx_bc_health_publication_date ON bc_health_records(publication_date);
CREATE INDEX IF NOT EXISTS idx_bc_health_ingested ON bc_health_records(ingested_at DESC);
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

export const ALL_BC_HEALTH_TYPES = ['pharmacare', 'bccdc'] as const;

export class BCHealthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BC_HEALTH_ERROR',
    public readonly source?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'BCHealthError';
  }
}