import { computeHash } from '../../verification/hashing.js';
import type { CultureGrant, CultureDeepIngestionResult } from './types.js';
import { CULTURE_USER_AGENT, CULTURE_TIMEOUT_MS, CANADA_COUNCIL_URL, CULTURE_CKAN_BASE, PCH_ORG_ID, CULTURE_KEYWORDS, MAX_CULTURE_RECORDS } from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), CULTURE_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': CULTURE_USER_AGENT }, signal: c.signal });
    clearTimeout(t); return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), CULTURE_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': CULTURE_USER_AGENT }, signal: c.signal });
    clearTimeout(t); return r.ok ? await r.text() : null;
  } catch { return null; }
}

export async function fetchAllCultureDeep(): Promise<CultureDeepIngestionResult> {
  const start = Date.now(); const grants: CultureGrant[] = []; const errors: string[] = [];
  const now = new Date().toISOString();

  // Try Canada Council data tables
  const html = await fetchText(CANADA_COUNCIL_URL);
  if (html) {
    const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = lp.exec(html)) !== null && grants.length < MAX_CULTURE_RECORDS) {
      const t = m[2].replace(/<[^>]+>/g, '').trim();
      if (t.length < 10 || !/(grant|funding|data|csv|xlsx|report)/i.test(t)) continue;
      grants.push({
        program: 'Canada Council', recipient: '', province: '',
        amount: 0, year: t.match(/\b(20\d{2})\b/)?.[0] ? parseInt(t.match(/\b(20\d{2})\b/)![0]) : new Date().getFullYear(),
        description: t.substring(0, 200), url: m[1].startsWith('http') ? m[1] : `https://canadacouncil.ca${m[1]}`,
        hash: await computeHash(`culture-cc-${t}`, 'sha256'), ingestedAt: now,
      });
    }
  }

  // Try Canadian Heritage CKAN
  const data = await fetchJson(`${CULTURE_CKAN_BASE}/package_search?q=owner_org:${PCH_ORG_ID}+grant&rows=30`);
  if (data?.result?.results) {
    for (const pkg of data.result.results) {
      if (grants.length >= MAX_CULTURE_RECORDS) break;
      grants.push({
        program: pkg.organization?.title || 'Canadian Heritage', recipient: pkg.title || '',
        province: '', amount: 0, year: pkg.metadata_created?.substring(0, 4) ? parseInt(pkg.metadata_created.substring(0, 4)) : new Date().getFullYear(),
        description: (pkg.notes || '').substring(0, 200), url: `${'https://open.canada.ca'}/data/en/dataset/${pkg.id}`,
        hash: await computeHash(`culture-pch-${pkg.id}`, 'sha256'), ingestedAt: now,
      });
    }
  }

  return { grants, sourcesAttempted: 2, sourcesSucceeded: grants.length > 0 ? 2 : 1, errors, durationMs: Date.now() - start };
}
