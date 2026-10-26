// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A2AJ (Canadian Access to Justice) Data Parsers
 *
 * Parses raw JSON responses from A2AJ API into typed structures.
 */

import type { A2ajCoverageItem, A2ajDocument, A2ajSearchResult } from './types.js';

/**
 * Parse coverage item from API response
 */
export function toCoverageItem(raw: any): A2ajCoverageItem | null {
  if (!raw || typeof raw !== 'object') return null;

  return {
    dataset: raw.dataset ?? '',
    descriptionEn: raw.description_en ?? '',
    descriptionFr: raw.description_fr ?? '',
    earliestDocumentDate: raw.earliest_document_date ?? null,
    latestDocumentDate: raw.latest_document_date ?? null,
    numberOfDocuments: raw.number_of_documents ?? 0,
  };
}

/**
 * Parse coverage items from API results array
 */
export function parseCoverageItems(results: any[]): A2ajCoverageItem[] {
  if (!Array.isArray(results)) return [];
  return results.map(toCoverageItem).filter((item): item is A2ajCoverageItem => item !== null);
}

/**
 * Parse document from API response
 */
export function toDocument(raw: any, citation: string): A2ajDocument | null {
  if (!raw || typeof raw !== 'object') return null;

  return {
    citation,
    title: raw.title ?? '',
    text: raw.text ?? '',
    dataset: raw.dataset ?? '',
    language: 'en',
  };
}

/**
 * Parse search result from API response
 */
export function toSearchResult(raw: any): A2ajSearchResult | null {
  if (!raw || typeof raw !== 'object') return null;

  return {
    citation: raw.citation ?? '',
    title: raw.title ?? raw.name ?? '',
    snippet: raw.snippet ?? (raw.text?.substring(0, 300) ?? ''),
    dataset: raw.dataset ?? '',
    score: raw.score ?? 0,
  };
}

/**
 * Parse search results from API results array
 */
export function parseSearchResults(results: any[]): A2ajSearchResult[] {
  if (!Array.isArray(results)) return [];
  return results.map(toSearchResult).filter((item): item is A2ajSearchResult => item !== null);
}