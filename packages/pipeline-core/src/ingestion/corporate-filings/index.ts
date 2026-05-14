import { fetchAllFilings } from './fetcher.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';
export async function ingestAllFilings(): Promise<CorporateFilingsIngestionResult> {
  const r = await fetchAllFilings();
  return { filings: r.filings, errors: r.errors, durationMs: r.durationMs };
}
export type { CorporateFiling, CorporateFilingsIngestionResult };
