import { fetchAllProvincialDeep } from './fetcher.js';
import type { ProvincialDataset, ProvincialDeepIngestionResult } from './types.js';
export async function ingestAllProvincialDeep(): Promise<ProvincialDeepIngestionResult> { return fetchAllProvincialDeep(); }
export type { ProvincialDataset, ProvincialDeepIngestionResult };
