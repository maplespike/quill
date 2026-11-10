// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Impact Assessment Agency of Canada Constants — Quill
 *
 * Source URLs, DDL, and defaults for ingesting federal project impact
 * assessment data from IAAC (Impact Assessment Agency of Canada).
 *
 * Primary source:
 *   https://iaac-aeic.gc.ca (project search, decisions)
 *   https://iaac-aeic.gc.ca/050/evaluations/search
 */

import type { ImpactAssessmentDecision, AssessmentType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const IAAC_SOURCES = {
  /** IAAC main page */
  HOME: 'https://iaac-aeic.gc.ca',

  /** Project search */
  PROJECT_SEARCH: 'https://iaac-aeic.gc.ca/050/evaluations/search',

  /** Project detail base (append reference number) */
  PROJECT_DETAIL: 'https://iaac-aeic.gc.ca/050/evaluations',

  /** Registry of projects */
  REGISTRY: 'https://iaac-aeic.gc.ca/050/evaluations/registry',

  /** Open Data / CKAN search for IAAC datasets */
  CKAN: {
    BASE: 'https://open.canada.ca/data',
    PACKAGE_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
  },

  /** Default search query for IAAC packages on CKAN */
  IAAC_CKAN_QUERY: '(iaac OR "impact assessment" OR "environmental assessment" OR aeic)',
} as const;

/* ------------------------------------------------------------------ */
/*  Decision & Assessment Type Mappings                                */
/* ------------------------------------------------------------------ */

/**
 * Maps raw decision text from IAAC sources to normalized ImpactAssessmentDecision.
 */
export const IAAC_DECISION_MAP: Record<string, ImpactAssessmentDecision> = {
  'approved': 'approved',
  'approved with conditions': 'approved-with-conditions',
  'approved-with-conditions': 'approved-with-conditions',
  'decision approved': 'approved',
  'denied': 'denied',
  'not approved': 'denied',
  'pending': 'pending',
  'in progress': 'pending',
  'under review': 'pending',
  'withdrawn': 'withdrawn',
  'exempted': 'exempted',
  'referred': 'referred',
  'referred to review panel': 'referred',
  'not required': 'not-required',
  'assessment not required': 'not-required',
};

/**
 * Maps raw assessment type text to normalized AssessmentType.
 */
export const IAAC_ASSESSMENT_TYPE_MAP: Record<string, AssessmentType> = {
  'iaa': 'iaa',
  'impact assessment act': 'iaa',
  'ceaa 2012': 'ceaa-2012',
  'ceaa 2012 (original)': 'ceaa-2012-original',
  'panel review': 'panel-review',
  'independent panel': 'panel-review',
  'substituted': 'substituted',
  'substitution': 'substituted',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const IAAC_ASSESSMENTS_DDL = `
-- Impact Assessment Agency of Canada — federal project assessments and decisions
CREATE TABLE IF NOT EXISTS impact_assessment_records (
  id TEXT PRIMARY KEY,

  -- Project identity
  project_name TEXT NOT NULL,
  proponent TEXT,
  project_type TEXT,
  location TEXT,
  province TEXT,

  -- Decision
  decision TEXT NOT NULL CHECK(decision IN (
    'approved',
    'approved-with-conditions',
    'denied',
    'pending',
    'withdrawn',
    'exempted',
    'referred',
    'not-required',
    'unknown'
  )),
  decision_date TEXT,

  -- Assessment type
  assessment_type TEXT NOT NULL DEFAULT 'unknown' CHECK(assessment_type IN (
    'iaa',
    'ceaa-2012',
    'ceaa-2012-original',
    'panel-review',
    'substituted',
    'unknown'
  )),

  -- Documents
  conditions_url TEXT,
  assessment_report_url TEXT,

  -- Reference numbers
  iaac_reference_number TEXT,
  ceaa_reference_number TEXT,

  -- Federal-provincial coordination
  federal_provincial_agreement INTEGER,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'iaac-web',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(project_name, decision, source_url)
);

CREATE INDEX IF NOT EXISTS idx_iaac_project ON impact_assessment_records(project_name);
CREATE INDEX IF NOT EXISTS idx_iaac_proponent ON impact_assessment_records(proponent);
CREATE INDEX IF NOT EXISTS idx_iaac_decision ON impact_assessment_records(decision);
CREATE INDEX IF NOT EXISTS idx_iaac_decision_date ON impact_assessment_records(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_iaac_project_type ON impact_assessment_records(project_type);
CREATE INDEX IF NOT EXISTS idx_iaac_province ON impact_assessment_records(province);
CREATE INDEX IF NOT EXISTS idx_iaac_assessment_type ON impact_assessment_records(assessment_type);
CREATE INDEX IF NOT EXISTS idx_iaac_ref_number ON impact_assessment_records(iaac_reference_number);
CREATE INDEX IF NOT EXISTS idx_iaac_ingested ON impact_assessment_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Known Project Types                                                */
/* ------------------------------------------------------------------ */

export const IAAC_PROJECT_TYPES = [
  'Mining',
  'Pipeline',
  'Hydroelectric',
  'Wind',
  'Solar',
  'Transmission Line',
  'Highway',
  'Railway',
  'Airport',
  'Port',
  'Marine',
  'Nuclear',
  'Oil and Gas',
  'Manufacturing',
  'Waste Management',
  'Water Management',
  'Agriculture',
  'Aquaculture',
  'Forestry',
  'Tourism',
  'Urban Development',
  'Other',
] as const;

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

export class IaacError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'IAAC_ERROR',
    public readonly project?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'IaacError';
  }
}
