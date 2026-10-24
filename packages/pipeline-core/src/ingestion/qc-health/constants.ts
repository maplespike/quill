// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Quebec Health Ingestion Constants — Quill
 *
 * Source URLs, DDL, and defaults for ingesting Quebec health data from:
 *   - RAMQ (Régie de l'assurance maladie du Québec) — medical claims data
 *   - Institut national de santé publique du Québec (INSPQ) — public health data
 *   - Données Québec CKAN portal
 */

import type { RAMQRecordType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const QC_HEALTH_SOURCES: Record<string, Record<string, string>> = {
  DONNEES_QUEBEC: {
    BASE: 'https://www.donneesquebec.ca',
    SEARCH: 'https://www.donneesquebec.ca/recherche/',
    API: 'https://www.donneesquebec.ca/api/3/action',
  },
  RAMQ: {
    BASE: 'https://www.ramq.gouv.qc.ca',
    DATA: 'https://www.donneesquebec.ca/recherche/fr/dataset/ramq-statistiques-sur-les-services-de-sante',
  },
  INSPQ: {
    BASE: 'https://www.inspq.qc.ca',
    DATA: 'https://www.donneesquebec.ca/recherche/fr/dataset/inspq-donnees-surveillance',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Record Type Configuration                                           */
/* ------------------------------------------------------------------ */

export interface QCHealthSourceConfig {
  /** Human-readable label */
  label: string;
  /** API base URL */
  apiUrl: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const QC_HEALTH_TYPE_CONFIG: Record<RAMQRecordType, QCHealthSourceConfig> = {
  ramq: {
    label: 'RAMQ Medical Claims',
    apiUrl: QC_HEALTH_SOURCES.RAMQ.DATA,
    sourceSystem: 'qc-ramq',
    defaultLimit: 500,
  },
  inspq: {
    label: 'INSPQ Public Health Surveillance',
    apiUrl: QC_HEALTH_SOURCES.INSPQ.DATA,
    sourceSystem: 'qc-inspq',
    defaultLimit: 300,
  },
};

export const ALL_QC_HEALTH_TYPES: RAMQRecordType[] = ['ramq', 'inspq'];

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const QC_HEALTH_DDL = `
-- Quebec Health — RAMQ claims and INSPQ surveillance data
-- Tracks medical claims statistics and public health indicators from Quebec.
CREATE TABLE IF NOT EXISTS qc_health_records (
  id TEXT PRIMARY KEY,

  -- Record type
  record_type TEXT NOT NULL CHECK(record_type IN (
    'ramq', 'inspq'
  )),

  -- RAMQ-specific fields
  claim_type TEXT,
  service_code TEXT,
  service_date TEXT,
  provider_type TEXT,
  beneficiary_type TEXT,
  region TEXT,
  claims_count INTEGER,
  total_paid REAL,
  fiscal_year TEXT,

  -- QCHealthRecord fields
  title TEXT,
  title_fr TEXT,
  topic TEXT,
  publication_date TEXT,
  summary TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'qc-ramq',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(record_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_qc_health_type ON qc_health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_qc_health_claim_type ON qc_health_records(claim_type);
CREATE INDEX IF NOT EXISTS idx_qc_health_region ON qc_health_records(region);
CREATE INDEX IF NOT EXISTS idx_qc_health_fiscal_year ON qc_health_records(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_qc_health_service_date ON qc_health_records(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_qc_health_topic ON qc_health_records(topic);
CREATE INDEX IF NOT EXISTS idx_qc_health_publication_date ON qc_health_records(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_qc_health_ingested ON qc_health_records(ingested_at DESC);
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

export class QCHealthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'QC_HEALTH_ERROR',
    public readonly recordType?: RAMQRecordType,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'QCHealthError';
  }
}