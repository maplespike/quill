import { fetchAllUnionSources, fetchUnionSource, searchUnionRecords } from './fetcher.js';
import { UNION_SOURCES } from './constants.js';
import type { UnionRecord, UnionIngestionResult, UnionSource, UnionCategory } from './types.js';

/** Ingest all union/labour sources */
export async function ingestAllUnions(): Promise<UnionIngestionResult> {
  return fetchAllUnionSources();
}

/** Ingest a single union source by name */
export async function ingestUnionSource(name: string): Promise<UnionRecord[]> {
  const source = UNION_SOURCES.find(s => s.name === name);
  if (!source) return [];
  return fetchUnionSource(source);
}

/** Search across cached union records */
export function searchUnions(records: UnionRecord[], query: string): UnionRecord[] {
  return searchUnionRecords(records, query);
}

export { UNION_SOURCES } from './constants.js';
export type { UnionRecord, UnionIngestionResult, UnionSource, UnionCategory } from './types.js';
