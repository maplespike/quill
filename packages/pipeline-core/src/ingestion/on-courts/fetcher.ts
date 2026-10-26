// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { DEFAULT_TIMEOUT_MS, DEFAULT_HEADERS } from './constants.js';

export async function fetchOnCourtsRecords(options: { limit?: number } = {}): Promise<{ records: any[]; errors: string[] }> {
  const records: any[] = [];
  const errors: string[] = [];
  const limit = options.limit ?? 400;

  try {
    const url = 'https://data.ontario.ca/api/3/action/package_search?q=on-courts&rows=' + limit;
    const resp = await httpGet(url, { headers: { ...DEFAULT_HEADERS }, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (resp.statusCode >= 400) {
      errors.push('HTTP ' + resp.statusCode + ' fetching');
      return { records, errors };
    }
    const data = JSON.parse(resp.body);
    const results: any[] = data?.result?.results ?? [];

    for (const item of results) {
      const r = item as Record<string, unknown>;
      records.push({
          court_type: String(r.court_type ?? r.courtType ?? ''),
          case_number: String(r.case_number ?? r.caseNumber ?? ''),
          filing_date: String(r.filing_date ?? r.filingDate ?? ''),
          case_type: String(r.case_type ?? r.caseType ?? ''),
          location: String(r.location ?? r.location ?? ''),
          status: String(r.status ?? r.status ?? ''),
        source_url: String(r.url ?? r.source_url ?? ''),
      });
    }
  } catch (err) {
    errors.push('Fetch failed: ' + (err as Error).message);
  }

  return { records, errors };
}
