import { fetchAllUnions } from './fetcher.js';
import type { UnionRecord, UnionsIngestionResult } from './types.js';
export async function ingestAllUnions(): Promise<UnionsIngestionResult> { return fetchAllUnions(); }
export type { UnionRecord, UnionsIngestionResult };
