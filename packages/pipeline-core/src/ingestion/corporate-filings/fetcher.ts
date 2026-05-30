import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';
import { FILINGS_USER_AGENT, FILINGS_TIMEOUT_MS, MAX_FILINGS } from './constants.js';

export async function fetchAllFilings(): Promise<CorporateFilingsIngestionResult> {
  const start = Date.now();
  const records: CorporateFiling[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  const searchUrl = 'https://open.canada.ca/data/api/3/action/package_search?q=public+company+financial+statements&rows=30';
  try {
    const resp = await httpGet(searchUrl, {
      headers: { 'User-Agent': FILINGS_USER_AGENT },
      timeoutMs: FILINGS_TIMEOUT_MS,
    });
    if (resp.statusCode < 400) {
      const data: any = await resp.json();
      for (const pkg of data?.result?.results ?? []) {
        if (records.length >= MAX_FILINGS) break;
        records.push({
          id: await computeHash(`filing-${pkg.id}`, 'sha256'),
          issuerName: pkg.title || pkg.name || 'Unknown',
          issuerTicker: null,
          filingType: 'public-company-data',
          filingTypeCategory: 'other',
          filingDate: pkg.metadata_created?.substring(0, 10) || now.substring(0, 10),
          documentUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
          description: (pkg.notes || '').substring(0, 200),
          formType: null,
          sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
          ingestedAt: now,
        });
      }
    }
  } catch (e) {
    errors.push(`CKAN: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  return {
    records,
    source: 'ckan',
    totalFetched: records.length,
    totalNew: records.length,
    errors,
    durationMs: Date.now() - start,
  };
}
