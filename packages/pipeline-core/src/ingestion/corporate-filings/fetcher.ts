import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';
import { FILINGS_USER_AGENT, FILINGS_TIMEOUT_MS, MAX_FILINGS } from './constants.js';

export async function fetchAllFilings(): Promise<CorporateFilingsIngestionResult> {
  const start = Date.now(); const filings: CorporateFiling[] = []; const errors: string[] = [];
  const now = new Date().toISOString();

  const searchUrl = 'https://open.canada.ca/data/api/3/action/package_search?q=public+company+financial+statements&rows=30';
  try {
    const resp = await httpGet(searchUrl, { headers: { 'User-Agent': FILINGS_USER_AGENT }, timeoutMs: FILINGS_TIMEOUT_MS });
    if (resp.statusCode < 400) {
      const data: any = await resp.json();
      for (const pkg of data?.result?.results ?? []) {
        if (filings.length >= MAX_FILINGS) break;
        filings.push({
          id: await computeHash(`filing-${pkg.id}`, 'sha256'),
          company: pkg.title || pkg.name || 'Unknown', filingType: 'public-company-data',
          filingDate: pkg.metadata_created?.substring(0, 10) || now.substring(0, 10),
          summary: (pkg.notes || '').substring(0, 200),
          sourceUrl: `${'https://open.canada.ca'}/data/en/dataset/${pkg.id}`,
          ingestedAt: now,
        });
      }
    }
  } catch (e) { errors.push(`CKAN: ${e instanceof Error ? e.message : 'unknown'}`); }

  return { filings, errors, durationMs: Date.now() - start };
}
