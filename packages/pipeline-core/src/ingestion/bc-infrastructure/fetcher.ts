// SPDX-License-Identifier: AGPL-3.0-or-later

import { httpGet } from '../../utils/http.js';
import { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RECORDS } from './constants.js';
import type { RawBcInfrastructureRecord } from './types.js';

const CKAN_URL = 'https://data.bc.ca';

export async function fetchBcInfrastructureRecords(options: { limit?: number } = {}): Promise<{ records: RawBcInfrastructureRecord[]; errors: string[] }> {
  const records: RawBcInfrastructureRecord[] = [];
  const errors: string[] = [];
  const limit = options.limit ?? DEFAULT_MAX_RECORDS;

  try {
    const url = `${CKAN_URL}/api/3/action/package_search?q=bc-infrastructure&`;
    const resp = await httpGet(url, { headers: { 'User-Agent': 'Quill/0.1', Accept: 'application/json' }, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (resp.statusCode >= 400) {
      errors.push('HTTP ' + resp.statusCode + ' fetching');
      return { records, errors };
    }
    const data = JSON.parse(resp.body);
    const results: any[] = data?.result?.results ?? [];
    for (const item of results) {
      const r = item as Record<string, unknown>;
      records.push({
        category: String(r.category ?? r.sector ?? ''),
        subcategory: String(r.subcategory ?? r.type ?? ''),
        value: (r.value ?? r.amount ?? r.cost) as number | string | undefined,
        unit: String(r.unit ?? ''),
        period: String(r.period ?? r.fiscal_year ?? ''),
        fiscal_year: String(r.fiscal_year ?? r.period ?? ''),
        region: String(r.region ?? r.location ?? ''),
        status: String(r.status ?? r.phase ?? ''),
        description: String(r.description ?? r.notes ?? ''),
        source_url: String(r.url ?? r.source_url ?? ''),
      });
    }
  } catch (err) {
    errors.push('Fetch failed: ' + (err as Error).message);
  }
  return { records, errors };
}
