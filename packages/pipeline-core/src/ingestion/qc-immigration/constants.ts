// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Quebec Immigration Ingestion Constants — Quill
 *
 * Source URLs, DDL, and defaults for ingesting Quebec immigration data from:
 *   - Ministère de l'Immigration, de la Francisation et de l'Intégration (MIFI)
 *   - Données Québec CKAN portal
 */

import type { QCImmigrationStream } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const QC_IMMIGRATION_SOURCES: Record<string, Record<string, string>> = {
  DONNEES_QUEBEC: {
    BASE: 'https://www.donneesquebec.ca',
    SEARCH: 'https://www.donneesquebec.ca/recherche/',
    API: 'https://www.donneesquebec.ca/api/3/action',
  },
  MIFI: {
    BASE: 'https://www.quebec.ca',
    DATA: 'https://www.donneesquebec.ca/recherche/fr/dataset/immigration-quebec-statistiques',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Stream Configuration                                               */
/* ------------------------------------------------------------------ */

export interface QCImmigrationSourceConfig {
  /** Human-readable label */
  label: string;
  /** API base URL */
  apiUrl: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const QC_IMMIGRATION_STREAM_CONFIG: Record<QCImmigrationStream, QCImmigrationSourceConfig> = {
  regular_skilled: {
    label: 'Régulier — Travailleurs qualifiés',
    apiUrl: QC_IMMIGRATION_SOURCES.MIFI.DATA,
    sourceSystem: 'qc-mifi-skilled',
    defaultLimit: 400,
  },
  entrepreneur: {
    label: 'Entrepreneur',
    apiUrl: QC_IMMIGRATION_SOURCES.MIFI.DATA,
    sourceSystem: 'qc-mifi-entrepreneur',
    defaultLimit: 200,
  },
  investor: {
    label: 'Investisseur',
    apiUrl: QC_IMMIGRATION_SOURCES.MIFI.DATA,
    sourceSystem: 'qc-mifi-investor',
    defaultLimit: 200,
  },
  family: {
    label: 'Parrainage familial',
    apiUrl: QC_IMMIGRATION_SOURCES.MIFI.DATA,
    sourceSystem: 'qc-mifi-family',
    defaultLimit: 300,
  },
  refugee: {
    label: 'Réfugié',
    apiUrl: QC_IMMIGRATION_SOURCES.MIFI.DATA,
    sourceSystem: 'qc-mifi-refugee',
    defaultLimit: 200,
  },
  temporary: {
    label: 'Travailleur temporaire / Étudiant',
    apiUrl: QC_IMMIGRATION_SOURCES.MIFI.DATA,
    sourceSystem: 'qc-mifi-temporary',
    defaultLimit: 400,
  },
};

export const ALL_QC_IMMIGRATION_STREAMS: QCImmigrationStream[] = [
  'regular_skilled',
  'entrepreneur',
  'investor',
  'family',
  'refugee',
  'temporary',
];

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const QC_IMMIGRATION_DDL = `
-- Quebec Immigration — MIFI statistics
-- Tracks immigration applications and admissions by stream and region.
CREATE TABLE IF NOT EXISTS qc_immigration_records (
  id TEXT PRIMARY KEY,

  -- Immigration stream
  stream TEXT NOT NULL CHECK(stream IN (
    'regular_skilled', 'entrepreneur', 'investor', 'family', 'refugee', 'temporary'
  )),

  -- Application metrics
  applications_received INTEGER,
  admissions INTEGER,

  -- Time period
  year INTEGER NOT NULL,
  quarter INTEGER,

  -- Geographic info
  country_of_origin TEXT,
  region TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'qc-mifi-skilled',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(stream, year, quarter, country_of_origin, region, source_url)
);

CREATE INDEX IF NOT EXISTS idx_qc_immigration_stream ON qc_immigration_records(stream);
CREATE INDEX IF NOT EXISTS idx_qc_immigration_year ON qc_immigration_records(year DESC);
CREATE INDEX IF NOT EXISTS idx_qc_immigration_quarter ON qc_immigration_records(quarter);
CREATE INDEX IF NOT EXISTS idx_qc_immigration_country ON qc_immigration_records(country_of_origin);
CREATE INDEX IF NOT EXISTS idx_qc_immigration_region ON qc_immigration_records(region);
CREATE INDEX IF NOT EXISTS idx_qc_immigration_stream_year ON qc_immigration_records(stream, year DESC);
CREATE INDEX IF NOT EXISTS idx_qc_immigration_ingested ON qc_immigration_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class QCImmigrationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'QC_IMMIGRATION_ERROR',
    public readonly stream?: QCImmigrationStream,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'QCImmigrationError';
  }
}