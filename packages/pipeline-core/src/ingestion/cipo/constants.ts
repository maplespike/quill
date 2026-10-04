/**
 * CIPO (Canadian Intellectual Property Office) Constants — Quill
 *
 * Source URLs, IP type codes, status mappings, DDL, and defaults for ingesting
 * Canadian patent, trademark, and industrial design data.
 *
 * Primary sources:
 *   Patent Database:       https://www.ic.gc.ca/opic-cipo/cpd/eng/introduction.html
 *   Trademarks Database:   http://www.ic.gc.ca/app/opic-cipo/trdmks/eng/search.html
 *   Industrial Designs:    https://www.ic.gc.ca/opic-cipo/id/eng/search.html
 */

import type { CipoIpType, CipoStatus } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const CIPO_SOURCES: Record<string, Record<string, string>> = {
  PATENT: {
    BASE: 'https://www.ic.gc.ca/opic-cipo/cpd',
    SEARCH: 'https://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/search.html',
    JSON_API: 'https://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/api',
    DETAIL: 'https://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/patent/',
    OPENDATA: 'https://www.ic.gc.ca/app/opic-cipo/patents-data/',
  },
  TRADEMARK: {
    BASE: 'https://www.ic.gc.ca/app/opic-cipo/trdmks',
    SEARCH: 'https://www.ic.gc.ca/app/opic-cipo/trdmks/eng/search.html',
    JSON_API: 'https://www.ic.gc.ca/app/opic-cipo/trdmks/eng/api',
    DETAIL: 'https://www.ic.gc.ca/app/opic-cipo/trdmks/eng/',
    OPENDATA: 'https://www.ic.gc.ca/app/opic-cipo/trademarks-data/',
  },
  DESIGN: {
    BASE: 'https://www.ic.gc.ca/opic-cipo/id',
    SEARCH: 'https://www.ic.gc.ca/opic-cipo/id/eng/search.html',
    JSON_API: 'https://www.ic.gc.ca/opic-cipo/id/eng/api',
    DETAIL: 'https://www.ic.gc.ca/opic-cipo/id/eng/',
    OPENDATA: 'https://www.ic.gc.ca/app/opic-cipo/design-data/',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  IP Type Configuration                                              */
/* ------------------------------------------------------------------ */

export interface CipoSourceConfig {
  /** Human-readable label */
  label: string;
  /** API base URL */
  apiUrl: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const CIPO_IP_TYPE_CONFIG: Record<CipoIpType, CipoSourceConfig> = {
  patent: {
    label: 'Patent Database',
    apiUrl: CIPO_SOURCES.PATENT.JSON_API,
    sourceSystem: 'cipo-patent',
    defaultLimit: 500,
  },
  trademark: {
    label: 'Trademarks Database',
    apiUrl: CIPO_SOURCES.TRADEMARK.JSON_API,
    sourceSystem: 'cipo-trademark',
    defaultLimit: 500,
  },
  industrial_design: {
    label: 'Industrial Design Database',
    apiUrl: CIPO_SOURCES.DESIGN.JSON_API,
    sourceSystem: 'cipo-design',
    defaultLimit: 500,
  },
};

export const ALL_CIPO_IP_TYPES: CipoIpType[] = ['patent', 'trademark', 'industrial_design'];

/* ------------------------------------------------------------------ */
/*  Status Mappings                                                    */
/* ------------------------------------------------------------------ */

export const CIPO_STATUS_MAP: Record<string, CipoStatus> = {
  'active': 'active',
  'granted': 'active',
  'registered': 'active',
  'in force': 'active',
  'pending': 'pending',
  'application pending': 'pending',
  'under examination': 'pending',
  'abandoned': 'abandoned',
  'expired': 'expired',
  'refused': 'refused',
  'withdrawn': 'withdrawn',
  'opposed': 'opposed',
  'expunged': 'expunged',
  'removed': 'expunged',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const CIPO_DDL = `
-- CIPO — Canadian Intellectual Property Office IP rights records
-- Tracks patents, trademarks, and industrial designs registered in Canada.
CREATE TABLE IF NOT EXISTS cipo_records (
  id TEXT PRIMARY KEY,

  -- Application identity
  application_number TEXT NOT NULL,
  filing_date TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN (
    'active', 'pending', 'abandoned', 'expired', 'refused',
    'withdrawn', 'opposed', 'expunged', 'unknown'
  )),
  type TEXT NOT NULL CHECK(type IN (
    'patent', 'trademark', 'industrial_design'
  )),

  -- Title / description
  title TEXT NOT NULL,
  description TEXT,

  -- Owner / agent
  owner_name TEXT,
  agent_name TEXT,

  -- Classifications
  ipc_classification TEXT,
  nice_classification TEXT,

  -- Dates
  registration_date TEXT,
  expiry_date TEXT,
  publication_date TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'cipo-patent',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(application_number, type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_cipo_app_number ON cipo_records(application_number);
CREATE INDEX IF NOT EXISTS idx_cipo_type ON cipo_records(type);
CREATE INDEX IF NOT EXISTS idx_cipo_status ON cipo_records(status);
CREATE INDEX IF NOT EXISTS idx_cipo_title ON cipo_records(title);
CREATE INDEX IF NOT EXISTS idx_cipo_owner ON cipo_records(owner_name);
CREATE INDEX IF NOT EXISTS idx_cipo_agent ON cipo_records(agent_name);
CREATE INDEX IF NOT EXISTS idx_cipo_filing_date ON cipo_records(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_cipo_registration_date ON cipo_records(registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_cipo_expiry_date ON cipo_records(expiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cipo_ipc ON cipo_records(ipc_classification);
CREATE INDEX IF NOT EXISTS idx_cipo_nice ON cipo_records(nice_classification);
CREATE INDEX IF NOT EXISTS idx_cipo_type_status ON cipo_records(type, status);
CREATE INDEX IF NOT EXISTS idx_cipo_ingested ON cipo_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class CipoError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CIPO_ERROR',
    public readonly ipType?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'CipoError';
  }
}
