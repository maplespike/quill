/**
 * CanLII Court Decisions Types — Quill
 *
 * Strongly-typed interfaces for the CanLII (Canadian Legal Information Institute)
 * case law REST API at https://api.canlii.org/v1/.
 *
 * Sources:
 *   - caseBrowse:   https://api.canlii.org/v1/caseBrowse/{lang}/{databaseId}/?offset=N&resultCount=N
 *   - caseDetail:   https://api.canlii.org/v1/caseBrowse/{lang}/{databaseId}/{caseId}/
 *   - caseCitator:  https://api.canlii.org/v1/caseCitator/en/{databaseId}/{caseId}/{metadataType}
 *
 * API docs: https://github.com/canlii/API_documentation
 */


/**
 * CanLII court and tribunal identifiers mapped to databaseId values
 * used in the API. Tracked courts are those whose decisions are most
 * relevant to government accountability and administrative law.
 */
export type TrackedCourt =
  | 'SCC'   // Supreme Court of Canada (csc-scc)
  | 'FCA'   // Federal Court of Appeal (fca-caf)
  | 'FC'    // Federal Court (fc-cf)
  | 'TCC';  // Tax Court of Canada (tcc-cci)

/**
 * Full court metadata with CanLII databaseId and human-readable name.
 */
export interface Court {
  /** Tracked court key */
  courtId: TrackedCourt;
  /** CanLII API databaseId parameter */
  databaseId: string;
  /** English name of the court */
  nameEn: string;
  /** French name of the court */
  nameFr: string;
  /** Jurisdiction code */
  jurisdiction: string;
}


/**
 * A legal citation (case-to-case or case-to-legislation).
 */
export interface LegalCitation {
  /** SHA-256 of the citation for deduplication */
  id: string;
  /** CanLII databaseId of the cited document */
  databaseId: string;
  /** CaseId of the cited document (for case citations) */
  caseId: string | null;
  /** Title of the cited document */
  title: string;
  /** Human-readable citation text (e.g. "2008 SCC 9 (CanLII)") */
  citation: string;
  /** Citation type */
  type: 'cited-case' | 'citing-case' | 'cited-legislation';
}


/**
 * A single CanLII court decision with metadata.
 *
 * For now we index metadata + summary; full text is deferred.
 * Every decision that reviews a government action interprets a regulation,
 * making case law cross-referencing valuable for accountability tracking.
 */
export interface CanliiDecision {
  /** SHA-256 hash of canonicalId + ingestedAt (primary key) */
  id: string;

  /** CanLII database identifier (e.g. "csc-scc", "fc-cf") */
  databaseId: string;

  /** CanLII case identifier (e.g. "2008scc9") */
  caseId: string;

  /** Case name (e.g. "Dunsmuir v. New Brunswick") */
  caseName: string;

  /** Court identifier */
  court: TrackedCourt;

  /** Decision date (ISO-8601) */
  decisionDate: string | null;

  /** Docket number(s) */
  docketNumber: string | null;

  /** Primary citation text (e.g. "[2008] 1 SCR 190, 2008 SCC 9 (CanLII)") */
  citation: string | null;

  /** All case citations (CanLII, official, neutral) as a semicolon-separated string */
  allCitations: string | null;

  /** CanLII permalink URL */
  url: string | null;

  /** Case language ('en', 'fr', or 'bilingual') */
  language: string;

  /** Comma-separated keywords from CanLII metadata */
  keywords: string | null;

  /** Concatenated ID (e.g. "2008csc-scc9") */
  concatenatedId: string | null;

  /**
   * Case summary / description.
   * For initial implementation this may come from the API description
   * or be left null; full text extraction is deferred.
   */
  summary: string | null;

  /** Party names extracted from case name (plaintiff(s) vs defendant(s)) */
  parties: PartyInfo | null;

  /** JSON-serialized array of cited cases */
  citedCasesJson: string | null;

  /** JSON-serialized array of citing cases */
  citingCasesJson: string | null;

  /** JSON-serialized array of cited legislation */
  citedLegislationJson: string | null;

  /** Whether this decision reviews a government action (inferred from court, keywords) */
  reviewsGovernmentAction: boolean;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


/**
 * Extracted party information from a case name.
 * Most Canadian cases follow the "Appellant v. Respondent" pattern.
 */
export interface PartyInfo {
  /** Plaintiff / Appellant / Applicant */
  plaintiff: string;
  /** Defendant / Respondent */
  defendant: string;
  /** Third parties / Interveners (if available) */
  interveners: string[];
}


/**
 * Shape of the caseBrowse list response from CanLII API.
 *
 *   GET /v1/caseBrowse/en/{databaseId}/?offset=0&resultCount=20
 */
export interface RawCaseListResponse {
  cases?: RawCaseListItem[];
}

export interface RawCaseListItem {
  databaseId: string;
  caseId: { en: string } | string;
  title: string;
  citation: string;
}

/**
 * Shape of the case detail response from CanLII API.
 *
 *   GET /v1/caseBrowse/en/{databaseId}/{caseId}/
 */
export interface RawCaseDetailResponse {
  databaseId: string;
  caseId: string;
  url: string;
  title: string;
  citation: string;
  language: string;
  docketNumber: string;
  decisionDate: string;
  keywords: string;
  concatenatedId: string;
}

/**
 * Shape of the caseCitator response.
 *
 *   GET /v1/caseCitator/en/{databaseId}/{caseId}/citedCases
 */
export interface RawCitatorResponse {
  citedCases?: RawCitatorItem[];
  citingCases?: RawCitatorItem[];
  citedLegislations?: RawCitatorItem[];
}

export interface RawCitatorItem {
  databaseId: string;
  caseId: { en: string } | string;
  title: string;
  citation: string;
}

/**
 * Shape of the caseBrowse (database list) response.
 *
 *   GET /v1/caseBrowse/en/
 */
export interface RawDatabaseListResponse {
  caseDatabases: RawDatabaseEntry[];
}

export interface RawDatabaseEntry {
  databaseId: string;
  jurisdiction: string;
  name: string;
}

/**
 * Search result shape (for caseSearch endpoint if available).
 *
 *   GET /v1/caseSearch/en?q={query}&court={court}
 */
export interface RawSearchResponse {
  cases?: RawSearchResult[];
  total?: number;
}

export interface RawSearchResult {
  databaseId: string;
  caseId: string | { en: string };
  title: string;
  citation: string;
  decisionDate?: string;
  court?: string;
}


export interface CanliiIngestionResult {
  /** Which court(s) were ingested */
  courts: TrackedCourt[];
  /** Total decisions found across all queries */
  decisionsFound: number;
  /** Total decisions ingested (new) */
  decisionsIngested: number;
  /** Total citations cross-referenced */
  citationsFound: number;
  errors: string[];
  durationMs: number;
}
