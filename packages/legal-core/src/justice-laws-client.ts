/**
 * Justice Canada Laws XML Client
 *
 * Fetches and parses the consolidated federal Acts and Regulations
 * from Justice Canada's XML repository on GitHub.
 *
 * Source: https://github.com/justicecanada/laws-lois-xml
 * Master index: https://laws-lois.justice.gc.ca/eng/XML/Legis.xml
 */

export interface JusticeAct {
  id: string; title: string; shortTitle: string | null;
  chapter: string; consolidationDate: string | null;
  xmlUrl: string; htmlUrl: string;
}

export interface JusticeRegulation {
  id: string; title: string; chapter: string;
  consolidationDate: string | null; xmlUrl: string; htmlUrl: string;
}

export interface JusticeLawsSearchOptions {
  query?: string; type?: 'Act' | 'Regulation' | 'all'; limit?: number;
}

export interface JusticeLawsSearchResult {
  acts: JusticeAct[]; regulations: JusticeRegulation[]; total: number;
}

const LAWS_BASE = 'https://laws-lois.justice.gc.ca';
const INDEX_URL = `${LAWS_BASE}/eng/XML/Legis.xml`;
const RAW_GITHUB = 'https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main';

export class JusticeLawsClient {
  private cache: { acts: JusticeAct[]; regulations: JusticeRegulation[] } | null = null;

  async fetchIndex(): Promise<{ acts: JusticeAct[]; regulations: JusticeRegulation[] }> {
    if (this.cache) return this.cache;
    const resp = await fetch(INDEX_URL, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/xml' } });
    if (!resp.ok) throw new Error(`Justice Laws index HTTP ${resp.status}`);
    const xml = await resp.text();
    const acts: JusticeAct[] = []; const regulations: JusticeRegulation[] = [];
    const actMatches = xml.matchAll(/<Act[^>]*>([\s\S]*?)<\/Act>/gi);
    for (const m of actMatches) {
      const b = m[1]; const id = xt(b, 'Id') || ''; const title = xt(b, 'Title') || xt(b, 'LongTitle') || '';
      const short = xt(b, 'ShortTitle'); const ch = xt(b, 'Chapter') || ''; const con = xt(b, 'ConsolidationDate');
      const fr = xt(b, 'FileRef') || id;
      acts.push({ id, title, shortTitle: short || null, chapter: ch, consolidationDate: con || null, xmlUrl: `${RAW_GITHUB}/eng/XML/${fr}.xml`, htmlUrl: `${LAWS_BASE}/eng/act/${id}.html` });
    }
    const regMatches = xml.matchAll(/<Regulation[^>]*>([\s\S]*?)<\/Regulation>/gi);
    for (const m of regMatches) {
      const b = m[1]; const id = xt(b, 'Id') || ''; const title = xt(b, 'Title') || '';
      const ch = xt(b, 'Chapter') || ''; const con = xt(b, 'ConsolidationDate'); const fr = xt(b, 'FileRef') || id;
      regulations.push({ id, title, chapter: ch, consolidationDate: con || null, xmlUrl: `${RAW_GITHUB}/eng/XML/${fr}.xml`, htmlUrl: `${LAWS_BASE}/eng/reg/${id}.html` });
    }
    this.cache = { acts, regulations };
    return this.cache;
  }

  async search(opts: JusticeLawsSearchOptions = {}): Promise<JusticeLawsSearchResult> {
    const { acts, regulations } = await this.fetchIndex();
    const q = (opts.query || '').toLowerCase(); const t = opts.type || 'all'; const lim = opts.limit || 50;
    const fa = (a: JusticeAct) => !q || a.title.toLowerCase().includes(q) || (a.shortTitle || '').toLowerCase().includes(q);
    const fr = (r: JusticeRegulation) => !q || r.title.toLowerCase().includes(q);
    return {
      acts: (t === 'all' || t === 'Act' ? acts.filter(fa).slice(0, lim) : []),
      regulations: (t === 'all' || t === 'Regulation' ? regulations.filter(fr).slice(0, lim) : []),
      total: acts.length + regulations.length,
    };
  }

  async fetchActXml(actId: string): Promise<string> {
    const resp = await fetch(`${RAW_GITHUB}/eng/XML/${actId}.xml`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`Act XML HTTP ${resp.status}`);
    return resp.text();
  }
}

function xt(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = xml.match(re); return m ? m[1].trim() : null;
}
