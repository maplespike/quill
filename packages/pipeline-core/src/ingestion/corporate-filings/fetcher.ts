import { computeHash } from '../../verification/hashing.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';
import { FILINGS_USER_AGENT, FILINGS_TIMEOUT_MS, SEDAR_PLUS_URL, MAX_FILINGS } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), FILINGS_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': FILINGS_USER_AGENT }, signal: c.signal });
    clearTimeout(t); return r.ok ? await r.text() : null;
  } catch { return null; }
}

export async function fetchAllFilings(): Promise<CorporateFilingsIngestionResult> {
  const start = Date.now(); const filings: CorporateFiling[] = []; const errors: string[] = [];
  const now = new Date().toISOString();

  const searchUrl = 'https://open.canada.ca/data/api/3/action/package_search?q=public+company+financial+statements&rows=30';
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), FILINGS_TIMEOUT_MS);
    const r = await fetch(searchUrl, { headers: { 'User-Agent': FILINGS_USER_AGENT }, signal: c.signal });
    clearTimeout(t);
    if (r.ok) {
      const data = await r.json();
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

  const html = await fetchText(SEDAR_PLUS_URL);
  if (html) {
    const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = lp.exec(html)) !== null && filings.length < MAX_FILINGS) {
      const t = m[2].replace(/<[^>]+>/g, '').trim();
      if (t.length < 10 || !/(annual.report|financial.statement|management.discussion|filing|prospectus)/i.test(t)) continue;
      filings.push({
        id: await computeHash(`sedar-${t}`, 'sha256'),
        company: t, filingType: 'sedar-filing', filingDate: now.substring(0, 10),
        summary: `SEDAR+ filing: ${t}`,
        sourceUrl: m[1].startsWith('http') ? m[1] : `https://www.sedarplus.ca${m[1]}`,
        ingestedAt: now,
      });
    }
  }

  return { filings, errors, durationMs: Date.now() - start };
}
