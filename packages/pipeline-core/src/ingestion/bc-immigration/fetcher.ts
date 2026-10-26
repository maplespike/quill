// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { DEFAULT_TIMEOUT_MS, DEFAULT_HEADERS } from './constants.js';

export async function fetchBcImmigrationRecords(options: { limit?: number } = {}): Promise<{ records: any[]; errors: string[] }> {
  const records: any[] = [];
  const errors: string[] = [];
  const limit = options.limit ?? 400;

  try {
    const url = 'https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=bc-bcpnp&rows=' + limit;
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
          stream: String(r.stream ?? r.stream ?? ''),
          nominations_issued: String(r.nominations_issued ?? r.nominationsIssued ?? ''),
          year: String(r.year ?? r.year ?? ''),
          quarter: String(r.quarter ?? r.quarter ?? ''),
          occupation: String(r.occupation ?? r.occupation ?? ''),
          industry: String(r.industry ?? r.industry ?? ''),
        source_url: String(r.url ?? r.source_url ?? ''),
      });
    }
  } catch (err) {
    errors.push('Fetch failed: ' + (err as Error).message);
  }

  return { records, errors };
}
