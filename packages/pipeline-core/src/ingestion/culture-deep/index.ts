import { fetchAllCultureDeep } from './fetcher.js';
import type { CultureGrant, CultureDeepIngestionResult } from './types.js';
export async function ingestAllCultureDeep(): Promise<CultureDeepIngestionResult> { return fetchAllCultureDeep(); }
export type { CultureGrant, CultureDeepIngestionResult };
