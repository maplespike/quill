// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CanLII Parser — Quill
 *
 * Parses CanLII API JSON responses into structured CanliiDecision objects.
 * Also provides helper functions for extracting citations, party names,
 * and relevance flags from raw case data.
 *
 * Patterns:
 *   - SHA-256 hashing for record IDs (using computeHash from verification)
 *   - Citations extracted from case names and citation strings
 *   - Party names extracted from "v." separator in case names
 *   - Relevance determined by court + keyword + legislation matching
 */

import { computeHash } from '../../verification/hashing.js';
import {
  DATABASE_ID_TO_COURT,
  TRACKED_LEGISLATION_KEYWORDS,
  TRACKED_GOV_DEPARTMENTS,
} from './constants.js';
import type {
  CanliiDecision,
  Court,
  LegalCitation,
  PartyInfo,
  TrackedCourt,
  RawCaseDetailResponse,
  RawCaseListItem,
  RawCitatorItem,
  RawCitatorResponse,
} from './types.js';


/**
 * Parse a case list item into a partial CanliiDecision.
 * The returned object has basic fields; callers should enrich with
 * detail metadata from fetchDecisionDetail + parseDecisionDetail.
 */
export async function parseCaseListItem(
  item: RawCaseListItem,
  ingestedAt: string,
): Promise<CanliiDecision | null> {
  const caseId = extractCaseId(item.caseId);
  const court = mapDatabaseIdToCourt(item.databaseId);

  if (!caseId || !court) return null;

  const id = await computeHash(`${item.databaseId}:${caseId}:${ingestedAt}`, 'sha256');

  return {
    id,
    databaseId: item.databaseId,
    caseId,
    caseName: item.title ?? 'Unknown',
    court,
    decisionDate: null,
    docketNumber: null,
    citation: item.citation ?? null,
    allCitations: null,
    url: null,
    language: 'en',
    keywords: null,
    concatenatedId: null,
    summary: null,
    parties: extractParties(item.title),
    citedCasesJson: null,
    citingCasesJson: null,
    citedLegislationJson: null,
    reviewsGovernmentAction: assessGovernmentRelevance(item.title, court, null),
    ingestedAt,
  };
}


/**
 * Parse the full case detail response into a CanliiDecision object.
 * This is the primary parser — called when we have fetched case detail.
 */
export async function parseDecisionDetail(
  detail: RawCaseDetailResponse,
  ingestedAt: string,
): Promise<CanliiDecision | null> {
  const court = mapDatabaseIdToCourt(detail.databaseId);
  if (!court) return null;

  // Normalize caseId — the API returns it as a plain string in detail
  const caseId = detail.caseId?.trim() || '';
  if (!caseId) return null;

  const id = await computeHash(`${detail.databaseId}:${caseId}:${ingestedAt}`, 'sha256');

  return {
    id,
    databaseId: detail.databaseId,
    caseId,
    caseName: detail.title ?? 'Unknown',
    court,
    decisionDate: detail.decisionDate || null,
    docketNumber: detail.docketNumber || null,
    citation: detail.citation || null,
    allCitations: null, // detail response only has one citation
    url: detail.url || null,
    language: detail.language || 'en',
    keywords: detail.keywords || null,
    concatenatedId: detail.concatenatedId || null,
    summary: null, // full text deferred
    parties: extractParties(detail.title),
    citedCasesJson: null,
    citingCasesJson: null,
    citedLegislationJson: null,
    reviewsGovernmentAction: assessGovernmentRelevance(
      detail.title,
      court,
      detail.keywords || null,
    ),
    ingestedAt,
  };
}

/**
 * Enrich a CanliiDecision with citation data from a citator response.
 * Mutates the decision object in place and returns the list of citations.
 */
export function enrichWithCitations(
  decision: CanliiDecision,
  citatorResponse: RawCitatorResponse | null,
): LegalCitation[] {
  const citations: LegalCitation[] = [];

  if (!citatorResponse) return citations;

  // Cited cases
  for (const item of citatorResponse.citedCases ?? []) {
    const citation = parseCitatorItem(item, 'cited-case');
    citations.push(citation);
  }

  // Citing cases
  for (const item of citatorResponse.citingCases ?? []) {
    const citation = parseCitatorItem(item, 'citing-case');
    citations.push(citation);
  }

  // Cited legislation
  for (const item of citatorResponse.citedLegislations ?? []) {
    const citation = parseCitatorItem(item, 'cited-legislation');
    citations.push(citation);
  }

  decision.citedCasesJson = citatorResponse.citedCases
    ? JSON.stringify(citatorResponse.citedCases)
    : decision.citedCasesJson;
  decision.citingCasesJson = citatorResponse.citingCases
    ? JSON.stringify(citatorResponse.citingCases)
    : decision.citingCasesJson;
  decision.citedLegislationJson = citatorResponse.citedLegislations
    ? JSON.stringify(citatorResponse.citedLegislations)
    : decision.citedLegislationJson;

  return citations;
}


/**
 * Parse a citator item into a LegalCitation.
 */
export function parseCitatorItem(
  item: RawCitatorItem,
  type: 'cited-case' | 'citing-case' | 'cited-legislation',
): LegalCitation {
  const caseId = extractCaseId(item.caseId);

  return {
    id: '', // hash computed by caller after associating with parent
    databaseId: item.databaseId,
    caseId,
    title: item.title,
    citation: item.citation,
    type,
  };
}

/**
 * Generate a SHA-256 hash ID for a LegalCitation.
 */
export async function hashCitation(
  decisionId: string,
  citation: string,
  type: string,
): Promise<string> {
  return computeHash(`${decisionId}:${citation}:${type}`, 'sha256');
}


/**
 * Extract all unique citation strings from a block of text.
 * Matches common Canadian legal citation patterns.
 */
export function extractCitations(text: string): string[] {
  const citations: string[] = [];
  const patterns = [
    // CanLII citations: "2008 SCC 9 (CanLII)", "2014 ONCA 925 (CanLII)"
    /\b(\d{4}\s+(?:SCC|FCA|FC|TCC|ONCA|ONSC|ONCJ|BCCA|BCSC|ABCA|ABQB|QCCA|QCCS|NSCA|NSSC|MBCA|MBQB|SKCA|SKQB|NBCA|NBQB|NLCA|NLSC|PECA|PESC|YUKA|YUSC|NWTCA|NWTSC|NUCA|NUCJ)\s+\d+\s+\(CanLII\))/g,
    // Neutral citations: "2008 SCC 9", "2014 FCA 123"
    /\b(\d{4}\s+(?:SCC|FCA|FC|TCC|ONCA|ONSC|BCCA|ABCA|QCCA|NSCA|MBCA|SKCA|NBCA|NLCA|PECA|YUKA|NWTCA|NUCA)\s+\d+)\b/g,
    // Dominion Law Reports: "DLR (4th) 123"
    /DLR\s+\(\d+\w+\)\s+\d+/g,
    // SCR citations: "[2008] 1 SCR 190"
    /\[(\d{4})\]\s+\d+\s+SCR\s+\d+/g,
    // Federal Reports: "FCR 123"
    /FCR\s+\d+/g,
    // Administrative Law Reports
    /Admin\s*LR\s*\(\d+\w*\)\s+\d+/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      citations.push(...matches);
    }
  }

  return [...new Set(citations)]; // deduplicate
}


/**
 * Extract plaintiff and defendant from a case name.
 *
 * Canadian case names typically follow the pattern:
 *   "Smith v. Jones"
 *   "R. v. Smith"
 *   "Attorney General of Canada v. Smith"
 *   "Smith (Appellant) v. Jones (Respondent)"
 *
 * The "v." stands for "versus" (or "and" in some family law cases).
 */
export function extractParties(caseName: string | null): PartyInfo | null {
  if (!caseName) return null;

  // Normalize: replace non-breaking spaces, trim
  const normalized = caseName.replace(/\u00A0/g, ' ').trim();
  if (!normalized) return null;

  // Try to split on " v. " (the standard Canadian/Commonwealth separator)
  // This handles: "Smith v. Jones", "R. v. Smith", "Attorney General v. Respondent"
  const vsMatch = normalized.match(/^(.+?)\s+v\.?\s+(.+)$/i);

  if (vsMatch) {
    const plaintiff = vsMatch[1].trim();
    const defendant = vsMatch[2].trim();

    // Remove parenthetical notes like (Appellant), (Respondent)
    const cleanPlaintiff = plaintiff.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const cleanDefendant = defendant.replace(/\s*\([^)]*\)\s*$/, '').trim();

    // Check for "between" style (rare)
    if (cleanPlaintiff.toLowerCase().startsWith('between ')) {
      return null; // skip "Between X and Y" format
    }

    return {
      plaintiff: cleanPlaintiff,
      defendant: cleanDefendant,
      interveners: extractInterveners(normalized),
    };
  }

  // If no "v." pattern, try parenthetical party info extraction
  return null;
}

/**
 * Extract intervener names from a case name string.
 * Interveners are often listed after the main parties:
 *   "... and Others"
 *   "... and Attorney General of Canada, Intervener"
 */
function extractInterveners(caseName: string): string[] {
  const interveners: string[] = [];

  // Pattern: "and X, Intervener" or "X, Intervening"
  const intervenerPattern = /,\s*([A-Z][^,]+?)\s+(?:Intervener|Intervening|Intervenant)\b/gi;
  let match;
  while ((match = intervenerPattern.exec(caseName)) !== null) {
    interveners.push(match[1].trim());
  }

  // "and Others"
  const othersPattern = /and\s+(Others|Autres)/gi;
  if (othersPattern.test(caseName)) {
    interveners.push('Others');
  }

  return interveners;
}


/**
 * Determine whether a decision is likely reviewing a government action.
 *
 * Factors:
 *   1. Court: Federal Court and Tax Court decisions are predominantly
 *      reviews of government action (judicial review of tribunals, CRA disputes).
 *      FCA decides appeals from FC. SCC has constitutional/administrative cases.
 *   2. Keywords: Cases containing tracked legislation keywords are relevant.
 *   3. Parties: Cases involving named government departments are relevant.
 */
export function assessGovernmentRelevance(
  caseName: string | null,
  court: TrackedCourt | null,
  keywords: string | null,
): boolean {
  // Federal Court: most cases are judicial reviews of government decisions
  if (court === 'FC') return true;

  // Federal Court of Appeal: appeals from FC (often government-related)
  if (court === 'FCA') return true;

  // Tax Court: all cases involve CRA disputes
  if (court === 'TCC') return true;

  // Supreme Court: check keywords and case name for government relevance
  if (court === 'SCC') {
    const text = `${caseName ?? ''} ${keywords ?? ''}`.toLowerCase();

    // High-relevance indicators for SCC cases
    const sccGovernmentIndicators = [
      'attorney general',
      'government of canada',
      'minister of',
      'canada (',
      'her majesty the queen',
      'r. v.',
      'charter',
      'judicial review',
      'administrative law',
      'constitutional',
      'federal court',
      'tribunal',
      'commissioner',
      'canada revenue agency',
    ];

    return sccGovernmentIndicators.some(indicator => text.includes(indicator));
  }

  // Default: check keywords and case name
  return checkTextForRelevance(caseName, keywords);
}

/**
 * Check a combined text string for government relevance keywords.
 */
function checkTextForRelevance(
  caseName: string | null,
  keywords: string | null,
): boolean {
  const text = `${caseName ?? ''} ${keywords ?? ''}`.toLowerCase();

  // Check legislation keywords
  for (const keyword of TRACKED_LEGISLATION_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) return true;
  }

  // Check department names
  for (const dept of TRACKED_GOV_DEPARTMENTS) {
    if (text.includes(dept.toLowerCase())) return true;
  }

  return false;
}


/**
 * Extract a flat caseId string from the possible API formats.
 *
 * The API may return caseId as:
 *   - string: "2008scc9"
 *   - object: { en: "2008scc9", fr?: "..." }
 */
export function extractCaseId(caseId: string | { en: string } | undefined | null): string | null {
  if (!caseId) return null;
  if (typeof caseId === 'string') {
    return caseId.trim() || null;
  }
  if (typeof caseId === 'object' && caseId.en) {
    return caseId.en.trim() || null;
  }
  return null;
}

/**
 * Map a CanLII databaseId to a TrackedCourt.
 * Returns null if the databaseId does not match a tracked court.
 */
export function mapDatabaseIdToCourt(databaseId: string): TrackedCourt | null {
  return DATABASE_ID_TO_COURT[databaseId] ?? null;
}
