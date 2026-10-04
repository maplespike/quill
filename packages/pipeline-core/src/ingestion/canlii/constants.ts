/**
 * CanLII Constants — Quill
 *
 * API endpoint configuration, tracked courts, tracked legislation keywords,
 * and DDL for the canlii_decisions and canlii_citations tables.
 *
 * CanLII API docs: https://github.com/canlii/API_documentation
 * API key: https://www.canlii.org/en/feedback/feedback.html
 */

import { type Court, type TrackedCourt } from './types.js';


/** Base URL for the CanLII REST API v1 */
export const CANLII_API_BASE = 'https://api.canlii.org/v1';

/** Environment variable name for the CanLII API key */
export const CANLII_API_KEY_ENV = 'CANLII_API_KEY';

/** Default language for API requests */
export const CANLII_DEFAULT_LANG = 'en';

/** Maximum results per page when listing cases */
export const CANLII_MAX_RESULTS = 50;

/** Default offset for pagination */
export const CANLII_DEFAULT_OFFSET = 0;

/** Max results the API supports per call */
export const CANLII_API_MAX_PER_CALL = 10_000;


/**
 * Courts whose decisions are most relevant to government accountability.
 *
 * - SCC: Constitutional questions, administrative law, government liability
 * - FCA: Judicial reviews of Federal Court decisions, appeals of federal tribunals
 * - FC:  Judicial reviews of government decisions, immigration, intellectual property
 * - TCC: Tax disputes with CRA, tax interpretation
 */
export const TRACKED_COURTS: Record<TrackedCourt, Court> = {
  SCC: {
    courtId: 'SCC',
    databaseId: 'csc-scc',
    nameEn: 'Supreme Court of Canada',
    nameFr: 'Cour suprême du Canada',
    jurisdiction: 'ca',
  },
  FCA: {
    courtId: 'FCA',
    databaseId: 'fca-caf',
    nameEn: 'Federal Court of Appeal',
    nameFr: "Cour d'appel fédérale",
    jurisdiction: 'ca',
  },
  FC: {
    courtId: 'FC',
    databaseId: 'fc-cf',
    nameEn: 'Federal Court',
    nameFr: 'Cour fédérale',
    jurisdiction: 'ca',
  },
  TCC: {
    courtId: 'TCC',
    databaseId: 'tcc-cci',
    nameEn: 'Tax Court of Canada',
    nameFr: "Cour canadienne de l'impôt",
    jurisdiction: 'ca',
  },
} as const;

export const TRACKED_COURT_LIST: Court[] = Object.values(TRACKED_COURTS);

/** Map from databaseId to TrackedCourt */
export const DATABASE_ID_TO_COURT: Record<string, TrackedCourt> = {
  'csc-scc': 'SCC',
  'fca-caf': 'FCA',
  'fc-cf': 'FC',
  'tcc-cci': 'TCC',
};


/**
 * Legislation keywords used to identify cases that interpret or apply
 * specific statutes of interest for accountability tracking.
 */
export const TRACKED_LEGISLATION_KEYWORDS: string[] = [
  // Access to Information
  'Access to Information Act',
  'Privacy Act',
  'Access to Information',
  'ATIP',

  // Lobbying
  'Lobbying Act',
  'Lobbyists Registration Act',
  'Lobbying',
  'Commissioner of Lobbying',

  // Ethics / Conflict of Interest
  'Conflict of Interest Act',
  'Ethics Commissioner',
  'Conflict of Interest',

  // Procurement
  'Canadian Free Trade Agreement',
  'Procurement',
  'CanadaBuys',

  // Financial Administration
  'Financial Administration Act',
  'Treasury Board',
  'Treasury Board Directive',

  // Judicial Review
  'Judicial Review',
  'Federal Courts Act',
  'Judicial Review of Government',

  // Charter (government action)
  'Canadian Charter of Rights and Freedoms',
  'Section 7',
  'Section 2',
  'Charter',

  // Administrative Law
  'Administrative Law',
  'Procedural Fairness',
  'Natural Justice',
  'Reasonableness',
  'Standard of Review',
  'Vires',
  'Ultra Vires',
];

/**
 * Department/agency names used to search for cases involving
 * specific government institutions.
 */
export const TRACKED_GOV_DEPARTMENTS: string[] = [
  'Canada Revenue Agency',
  'CRA',
  'Canada Border Services Agency',
  'CBSA',
  'Immigration, Refugees and Citizenship Canada',
  'IRCC',
  'Environment and Climate Change Canada',
  'Health Canada',
  'Department of National Defence',
  'DND',
  'Public Safety Canada',
  'Department of Justice Canada',
  'Finance Canada',
  'Innovation, Science and Economic Development Canada',
  'ISED',
  'Transport Canada',
  'Indigenous Services Canada',
  'Crown-Indigenous Relations',
  'Employment and Social Development Canada',
  'ESDC',
  'Fisheries and Oceans Canada',
  'DFO',
  'Natural Resources Canada',
  'NRCan',
  'Public Works and Government Services Canada',
  'PWGSC',
  'Canadian Heritage',
  'Global Affairs Canada',
  'GAC',
  'Veterans Affairs Canada',
  'VAC',
  'Canadian Food Inspection Agency',
  'CFIA',
  'National Energy Board',
  'Canada Energy Regulator',
  'CER',
  'Canadian Transportation Agency',
  'CTA',
  'Office of the Privacy Commissioner',
  'Privacy Commissioner',
  'Information Commissioner',
  'Office of the Information Commissioner',
];


/**
 * DDL for the canlii_decisions table.
 *
 * Stores case metadata from the CanLII API. Full text deferred.
 * Primary key is SHA-256 hash of the caseId + databaseId.
 */
export const CANLII_DECISIONS_DDL = `
CREATE TABLE IF NOT EXISTS canlii_decisions (
  id TEXT PRIMARY KEY,

  -- CanLII source identifiers
  database_id TEXT NOT NULL,
  case_id TEXT NOT NULL,

  -- Case metadata
  case_name TEXT NOT NULL,
  court TEXT NOT NULL CHECK(court IN ('SCC', 'FCA', 'FC', 'TCC')),
  decision_date TEXT,

  -- Identifiers
  docket_number TEXT,
  citation TEXT,
  all_citations TEXT,

  -- URLs
  url TEXT,

  -- Case details
  language TEXT NOT NULL DEFAULT 'en',
  keywords TEXT,
  concatenated_id TEXT,
  summary TEXT,
  parties_json TEXT,

  -- Citation graphs (JSON arrays)
  cited_cases_json TEXT,
  citing_cases_json TEXT,
  cited_legislation_json TEXT,

  -- Relevance flags
  reviews_government_action INTEGER DEFAULT 0,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(database_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_canlii_court ON canlii_decisions(court);
CREATE INDEX IF NOT EXISTS idx_canlii_decision_date ON canlii_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_canlii_case_name ON canlii_decisions(case_name);
CREATE INDEX IF NOT EXISTS idx_canlii_keywords ON canlii_decisions(keywords);
CREATE INDEX IF NOT EXISTS idx_canlii_reviews_gov ON canlii_decisions(reviews_government_action);
CREATE INDEX IF NOT EXISTS idx_canlii_database_case ON canlii_decisions(database_id, case_id);
CREATE INDEX IF NOT EXISTS idx_canlii_ingested ON canlii_decisions(ingested_at DESC);
`;

/**
 * DDL for the canlii_citations table.
 *
 * Tracks case-to-case and case-to-legislation citation relationships.
 * Enables cross-referencing: "which tracked cases cite this legislation?"
 */
export const CANLII_CITATIONS_DDL = `
CREATE TABLE IF NOT EXISTS canlii_citations (
  id TEXT PRIMARY KEY,

  -- Source decision (the decision that contains the citation)
  decision_id TEXT NOT NULL REFERENCES canlii_decisions(id) ON DELETE CASCADE,

  -- Citation target
  cited_database_id TEXT NOT NULL,
  cited_case_id TEXT,
  cited_title TEXT NOT NULL,
  cited_citation TEXT NOT NULL,

  -- Citation type
  citation_type TEXT NOT NULL CHECK(citation_type IN ('cited-case', 'citing-case', 'cited-legislation')),

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(decision_id, cited_citation, citation_type)
);

CREATE INDEX IF NOT EXISTS idx_canlii_cit_decision ON canlii_citations(decision_id);
CREATE INDEX IF NOT EXISTS idx_canlii_cit_target ON canlii_citations(cited_citation);
CREATE INDEX IF NOT EXISTS idx_canlii_cit_type ON canlii_citations(citation_type);
CREATE INDEX IF NOT EXISTS idx_canlii_cit_target_type ON canlii_citations(cited_citation, citation_type);
`;

/** Combined DDL for both tables */
export const CANLII_DDL = `${CANLII_DECISIONS_DDL}\n${CANLII_CITATIONS_DDL}`;


/**
 * Build the caseBrowse URL for a specific court's case list.
 */
export function caseBrowseUrl(
  databaseId: string,
  options: {
    offset?: number;
    resultCount?: number;
    publishedAfter?: string;
    decisionDateAfter?: string;
    decisionDateBefore?: string;
  } = {},
): string {
  const params = new URLSearchParams();
  params.set('offset', String(options.offset ?? CANLII_DEFAULT_OFFSET));
  params.set('resultCount', String(options.resultCount ?? CANLII_MAX_RESULTS));

  if (options.publishedAfter) params.set('publishedAfter', options.publishedAfter);
  if (options.decisionDateAfter) params.set('decisionDateAfter', options.decisionDateAfter);
  if (options.decisionDateBefore) params.set('decisionDateBefore', options.decisionDateBefore);

  return `${CANLII_API_BASE}/caseBrowse/${CANLII_DEFAULT_LANG}/${databaseId}/?${params.toString()}`;
}

/**
 * Build the case detail URL for a specific decision.
 */
export function caseDetailUrl(databaseId: string, caseId: string): string {
  return `${CANLII_API_BASE}/caseBrowse/${CANLII_DEFAULT_LANG}/${databaseId}/${caseId}/`;
}

/**
 * Build the caseCitator URL for a specific citation type.
 */
export function caseCitatorUrl(
  databaseId: string,
  caseId: string,
  metadataType: 'citedCases' | 'citingCases' | 'citedLegislations',
): string {
  return `${CANLII_API_BASE}/caseCitator/en/${databaseId}/${caseId}/${metadataType}`;
}

/**
 * Build a caseSearch URL (if the endpoint becomes available).
 */
export function caseSearchUrl(
  query: string,
  options: {
    court?: string;
    offset?: number;
    limit?: number;
  } = {},
): string {
  const params = new URLSearchParams();
  params.set('q', query);
  if (options.court) params.set('court', options.court);
  params.set('offset', String(options.offset ?? CANLII_DEFAULT_OFFSET));
  params.set('limit', String(options.limit ?? CANLII_MAX_RESULTS));
  return `${CANLII_API_BASE}/caseSearch/${CANLII_DEFAULT_LANG}/?${params.toString()}`;
}
