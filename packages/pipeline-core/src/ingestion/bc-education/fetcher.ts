// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { DEFAULT_TIMEOUT_MS, DEFAULT_HEADERS } from './constants.js';

export async function fetchBcEducationRecords(options: { limit?: number } = {}): Promise<{ records: any[]; errors: string[] }> {
  const records: any[] = [];
  const errors: string[] = [];
  const limit = options.limit ?? 400;

  try {
    const url = 'https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=bc-education&rows=' + limit;
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
          category: String(r.category ?? r.category ?? ''),
          school_district: String(r.school_district ?? r.schoolDistrict ?? ''),
          school_name: String(r.school_name ?? r.schoolName ?? ''),
          academic_year: String(r.academic_year ?? r.academicYear ?? ''),
          grade: String(r.grade ?? r.grade ?? ''),
          subject: String(r.subject ?? r.subject ?? ''),
          result: String(r.result ?? r.result ?? ''),
          student_count: String(r.student_count ?? r.studentCount ?? ''),
        source_url: String(r.url ?? r.source_url ?? ''),
      });
    }
  } catch (err) {
    errors.push('Fetch failed: ' + (err as Error).message);
  }

  return { records, errors };
}
