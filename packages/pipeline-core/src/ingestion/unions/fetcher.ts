// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { UnionRecord, UnionsIngestionResult } from './types.js';
import { UNION_USER_AGENT, UNION_TIMEOUT_MS, MAJOR_UNIONS, MAX_UNION_RECORDS } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': UNION_USER_AGENT }, timeoutMs: UNION_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

export async function fetchAllUnions(): Promise<UnionsIngestionResult> {
  const start = Date.now(); const records: UnionRecord[] = []; const errors: string[] = [];
  const now = new Date().toISOString();

  const results = await Promise.allSettled(MAJOR_UNIONS.map(async (union) => {
    const reportUrl = `${union.url}${union.annualReportPath}`;
    const html = await fetchText(reportUrl);
    if (!html) return [];
    const records: UnionRecord[] = [];
    const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = lp.exec(html)) !== null && records.length < 20) {
      const t = m[2].replace(/<[^>]+>/g, '').trim();
      if (t.length < 10) continue;
      if (!/(annual.report|financial.statement|audited|membership)/i.test(t) && !t.match(/\b20\d{2}\b/)) continue;
      const year = t.match(/\b(20\d{2})\b/)?.[0];
      records.push({
        unionName: union.name, year: year ? parseInt(year) : new Date().getFullYear(),
        source: reportUrl, url: m[1].startsWith('http') ? m[1] : `${union.url}${m[1]}`,
        hash: await computeHash(`union-${union.name}-${t}`, 'sha256'), ingestedAt: now,
      });
    }
    return records;
  }));

  let succeeded = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') { records.push(...r.value); if (r.value.length > 0) succeeded++; }
    else errors.push(r.reason?.message ?? 'unknown');
  }
  return { records, sourcesAttempted: MAJOR_UNIONS.length, sourcesSucceeded: succeeded, errors, durationMs: Date.now() - start };
}
