import { computeHash } from '../../verification/hashing.js';
import type { LegislationRecord, LegislationIngestionResult } from './types.js';
import { LEGISLATION_SOURCES, LEGISLATION_UA, LEGISLATION_TIMEOUT_MS, MAX_LEGISLATION_RECORDS, JUSTICE_CANADA_XML_MASTER } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), LEGISLATION_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': LEGISLATION_UA }, signal: c.signal });
    clearTimeout(t); return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function fetchJson(url: string): Promise<any> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), LEGISLATION_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': LEGISLATION_UA, Accept: 'application/json' }, signal: c.signal });
    clearTimeout(t); return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Fetch the Justice Canada Laws XML master index */
async function fetchJusticeCanadaMaster(): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = []; const now = new Date().toISOString();
  const xml = await fetchText(JUSTICE_CANADA_XML_MASTER);
  if (!xml) return records;

  // Parse XML to extract act/regulation entries
  const actRegex = /<(Act|Regulation)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = actRegex.exec(xml)) !== null && records.length < MAX_LEGISLATION_RECORDS) {
    const block = m[0];
    const title = block.match(/<Title[^>]*>([\s\S]*?)<\/Title>/i)?.[1]?.trim() || 'Untitled';
    const chapter = block.match(/<Chapter[^>]*>([\s\S]*?)<\/Chapter>/i)?.[1] || '';
    const year = block.match(/<Year[^>]*>([\s\S]*?)<\/Year>/i)?.[1] || '';
    const fileUrl = block.match(/<URL[^>]*>([\s\S]*?)<\/URL>/i)?.[1] || block.match(/href="([^"]+\.xml)"/i)?.[1] || '';
    records.push({
      source: 'justice-canada-xml', jurisdiction: 'federal',
      title, chapter, year: year ? parseInt(year) : new Date().getFullYear(),
      url: fileUrl.startsWith('http') ? fileUrl : `https://laws-lois.justice.gc.ca/eng/XML/${fileUrl}`,
      format: 'XML', description: `Federal ${m[1].toLowerCase()}: ${title}`,
      hash: await computeHash(`fed-leg-${chapter || title}`, 'sha256'), ingestedAt: now,
    });
  }
  return records;
}

/** Search provincial CKAN for legislation datasets */
async function fetchProvincialCkanLegislation(): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = []; const now = new Date().toISOString();
  const data = await fetchJson('https://open.canada.ca/data/api/3/action/package_search?q=legislation+acts+regulations&rows=30');
  if (!data?.result?.results) return records;
  for (const pkg of data.result.results) {
    if (records.length >= MAX_LEGISLATION_RECORDS) break;
    records.push({
      source: 'provincial-ckan', jurisdiction: pkg.organization?.title || 'Canada',
      title: pkg.title || pkg.name || '', chapter: '', year: pkg.metadata_created?.substring(0, 4) ? parseInt(pkg.metadata_created.substring(0, 4)) : new Date().getFullYear(),
      url: `https://open.canada.ca/data/en/dataset/${pkg.id}`, format: 'CKAN',
      description: (pkg.notes || '').substring(0, 300),
      hash: await computeHash(`prov-leg-${pkg.id}`, 'sha256'), ingestedAt: now,
    });
  }
  return records;
}

/** Fetch Ontario e-Laws and BC Laws via their web interfaces */
async function fetchProvincialLegislationWeb(): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = []; const now = new Date().toISOString();

  // Ontario e-Laws
  const onHtml = await fetchText('https://www.ontario.ca/laws');
  if (onHtml) {
    const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = lp.exec(onHtml)) !== null && records.length < 100) {
      const t = m[2].replace(/<[^>]+>/g, '').trim();
      if (t.length < 10 || !/(act|regulation|statute|bill)/i.test(t)) continue;
      records.push({
        source: 'ontario-elaws', jurisdiction: 'ON', title: t, year: new Date().getFullYear(),
        url: m[1].startsWith('http') ? m[1] : `https://www.ontario.ca${m[1]}`,
        format: 'HTML', description: `Ontario legislation: ${t}`,
        hash: await computeHash(`on-leg-${t}`, 'sha256'), ingestedAt: now,
      });
    }
  }

  // BC Laws
  const bcHtml = await fetchText('https://www.bclaws.gov.bc.ca/');
  if (bcHtml) {
    const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = lp.exec(bcHtml)) !== null && records.length < 100) {
      const t = m[2].replace(/<[^>]+>/g, '').trim();
      if (t.length < 10 || !/(act|regulation|statute|bill)/i.test(t)) continue;
      records.push({
        source: 'bc-laws', jurisdiction: 'BC', title: t, year: new Date().getFullYear(),
        url: m[1].startsWith('http') ? m[1] : `https://www.bclaws.gov.bc.ca${m[1]}`,
        format: 'HTML', description: `BC legislation: ${t}`,
        hash: await computeHash(`bc-leg-${t}`, 'sha256'), ingestedAt: now,
      });
    }
  }

  return records;
}

export async function ingestAllLegislation(): Promise<LegislationIngestionResult> {
  const start = Date.now(); const records: LegislationRecord[] = []; const errors: string[] = [];

  const [fed, provCkan, provWeb] = await Promise.allSettled([
    fetchJusticeCanadaMaster().catch(e => { errors.push(`Justice Canada: ${e.message}`); return []; }),
    fetchProvincialCkanLegislation().catch(e => { errors.push(`Prov CKAN: ${e.message}`); return []; }),
    fetchProvincialLegislationWeb().catch(e => { errors.push(`Prov Web: ${e.message}`); return []; }),
  ]);

  if (fed.status === 'fulfilled') records.push(...fed.value);
  if (provCkan.status === 'fulfilled') records.push(...provCkan.value);
  if (provWeb.status === 'fulfilled') records.push(...provWeb.value);

  return {
    records, sourcesAttempted: LEGISLATION_SOURCES.length,
    sourcesSucceeded: records.length > 0 ? LEGISLATION_SOURCES.length : 0,
    errors, durationMs: Date.now() - start,
  };
}
