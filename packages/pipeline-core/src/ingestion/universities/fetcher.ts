// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { UniversityRecord, UniversitiesIngestionResult } from './types.js';
import { UNI_USER_AGENT, UNI_TIMEOUT_MS, CUDO_URL, MAX_UNI_RECORDS, ONTARIO_UNIVERSITIES } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': UNI_USER_AGENT }, timeoutMs: UNI_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

async function fetchCudoData(): Promise<UniversityRecord[]> {
  const now = new Date().toISOString();
  const records: UniversityRecord[] = [];
  const html = await fetchText(CUDO_URL);
  if (!html) return records;
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null && records.length < MAX_UNI_RECORDS) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(enrolment|funding|financial|faculty|degrees|revenue|expenditure)/i.test(t)) continue;
    const year = t.match(/\b(20\d{2})\b/)?.[0];
    records.push({
      institution: 'Ontario Universities (aggregate)', province: 'ON',
      year: year ? parseInt(year) : new Date().getFullYear(),
      source: 'cudo', url: m[1].startsWith('http') ? m[1] : `https://ontariosuniversities.ca${m[1]}`,
      hash: await computeHash(`cudo-${t}`, 'sha256'), ingestedAt: now,
    });
  }
  return records;
}

async function fetchUniFinancials(): Promise<UniversityRecord[]> {
  const now = new Date().toISOString(); const records: UniversityRecord[] = [];
  for (const uni of ONTARIO_UNIVERSITIES) {
    const searchUrl = `https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(uni)}&rows=5`;
    try {
      const resp = await httpGet(searchUrl, { headers: { 'User-Agent': UNI_USER_AGENT }, timeoutMs: UNI_TIMEOUT_MS });
      if (resp.statusCode >= 400) continue;
      const data: any = await resp.json();
      if (data?.result?.results?.length) {
        records.push({
          institution: uni, province: 'ON', year: new Date().getFullYear(),
          source: 'financial-statement', url: searchUrl,
          hash: await computeHash(`uni-${uni}`, 'sha256'), ingestedAt: now,
        });
      }
    } catch { /* skip */ }
  }
  return records;
}

export async function fetchAllUniversities(): Promise<UniversitiesIngestionResult> {
  const start = Date.now(); const errors: string[] = [];
  const [cudo, financials] = await Promise.allSettled([fetchCudoData(), fetchUniFinancials()]);
  const records: UniversityRecord[] = [];
  if (cudo.status === 'fulfilled') records.push(...cudo.value); else errors.push(`CUDO: ${cudo.reason?.message}`);
  if (financials.status === 'fulfilled') records.push(...financials.value); else errors.push(`Financials: ${financials.reason?.message}`);
  return { records, sourcesAttempted: 2, sourcesSucceeded: records.length > 0 ? 2 : 0, errors, durationMs: Date.now() - start };
}
