import { fetchAllFederalDeep } from './fetcher.js';
import type { FederalDataset, FederalDeepIngestionResult } from './types.js';
export async function ingestAllFederalDeep(): Promise<FederalDeepIngestionResult> { return fetchAllFederalDeep(); }
export type { FederalDataset, FederalDeepIngestionResult };
