// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { A2ajCoverageItem, A2ajDocument, A2ajSearchResult, A2ajIngestionResult } from './types.js';
import { A2AJ_BASE, A2AJ_TIMEOUT_MS, A2AJ_USER_AGENT, A2AJ_MAX_SEARCH_RESULTS, TRACKED_DATASETS } from './constants.js';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': A2AJ_USER_AGENT, Accept: 'application/json' }, timeoutMs: A2AJ_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json() as T;
  } catch { return null; }
}

export async function fetchCoverage(docType: 'cases' | 'laws' = 'cases'): Promise<A2ajCoverageItem[]> {
  const data = await fetchJson<{ results: any[] }>(`${A2AJ_BASE}/coverage?doc_type=${docType}`);
  if (!data?.results) return [];
  return data.results.map((r: any) => ({
    dataset: r.dataset,
    descriptionEn: r.description_en ?? '',
    descriptionFr: r.description_fr ?? '',
    earliestDocumentDate: r.earliest_document_date ?? null,
    latestDocumentDate: r.latest_document_date ?? null,
    numberOfDocuments: r.number_of_documents ?? 0,
  }));
}

export async function fetchByCitation(citation: string, docType: 'cases' | 'laws' = 'cases'): Promise<A2ajDocument | null> {
  const data = await fetchJson<{ results: any[] }>(`${A2AJ_BASE}/fetch?citation=${encodeURIComponent(citation)}&doc_type=${docType}`);
  if (!data?.results?.length) return null;
  const r = data.results[0];
  return { citation, title: r.title ?? '', text: r.text ?? '', dataset: r.dataset ?? '', language: 'en' };
}

export async function searchA2aj(
  query: string,
  options: { docType?: 'cases' | 'laws'; size?: number; dataset?: string; startDate?: string; endDate?: string } = {},
): Promise<A2ajSearchResult[]> {
  const params = new URLSearchParams({ query, doc_type: options.docType ?? 'cases', size: String(options.size ?? 10) });
  if (options.dataset) params.set('dataset', options.dataset);
  if (options.startDate) params.set('start_date', options.startDate);
  if (options.endDate) params.set('end_date', options.endDate);
  const data = await fetchJson<{ results: any[] }>(`${A2AJ_BASE}/search?${params}`);
  if (!data?.results) return [];
  return data.results.map((r: any) => ({
    citation: r.citation ?? '',
    title: r.title ?? r.name ?? '',
    snippet: r.snippet ?? r.text?.substring(0, 300) ?? '',
    dataset: r.dataset ?? '',
    score: r.score ?? 0,
  }));
}

/** Ingest: fetch coverage + search tracked datasets + sample key citations */
export async function ingestAllA2aj(): Promise<A2ajIngestionResult> {
  const start = Date.now(); const errors: string[] = [];
  const [caseCoverage, lawCoverage] = await Promise.all([
    fetchCoverage('cases').catch(e => { errors.push(`coverage cases: ${e.message}`); return []; }),
    fetchCoverage('laws').catch(e => { errors.push(`coverage laws: ${e.message}`); return []; }),
  ]);
  const coverage = [...caseCoverage, ...lawCoverage];

  // Search tracked datasets for recent government accountability decisions
  const searchResults: A2ajSearchResult[] = [];
  const searches = TRACKED_DATASETS.slice(0, 10).map(ds =>
    searchA2aj('judicial review OR charter OR constitutional', { dataset: ds, size: 5 })
      .then(r => { searchResults.push(...r); })
      .catch(e => { errors.push(`search ${ds}: ${e.message}`); })
  );
  await Promise.all(searches);

  return { coverage, documents: [], searches: searchResults, errors, durationMs: Date.now() - start };
}
