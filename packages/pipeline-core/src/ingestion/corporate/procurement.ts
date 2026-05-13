/**
 * Procurement Connector — Frostbite Data Pipeline
 *
 * Fetches Canadian government procurement contracts from:
 *   - CanadaBuys tender notices
 *   - buyandsell.gc.ca contract history (legacy)
 *   - Proactive disclosure of contracts over $10K (via open.canada.ca)
 *
 * These are public-domain data sources that reveal who gets
 * taxpayer-funded contracts and under what terms.
 */

import { httpGet, parseJsonBody } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { CORPORATE_SOURCES } from './constants.js';
import type { ContractAward } from './types.js';


export interface TenderNotice {
  id: string;
  title: string;
  description: string | null;
  publicationDate: string;
  closingDate: string | null;
  organization: string;
  procurementMethod: string | null;
  estimatedValue: number | null;
  tradeAgreement: string | null;
  gsin: string | null;
  url: string;
  status: 'open' | 'closed' | 'awarded';
}

/**
 * Fetch current tender opportunities from CanadaBuys RSS feed.
 */
export async function fetchTendersRss(): Promise<TenderNotice[]> {
  const resp = await httpGet(CORPORATE_SOURCES.PROCUREMENT.RSS_FEED, {
    headers: { Accept: 'application/rss+xml,application/xml' },
  });

  const xml = resp.body;
  const tenders: TenderNotice[] = [];

  // Simple RSS item parser
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const item = itemMatch[1];
    const extract = (tag: string): string => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item);
      return m ? m[1].trim() : '';
    };

    const title = extract('title');
    const description = extract('description');
    const link = extract('link');
    const pubDate = extract('pubDate');

    if (!title) continue;

    tenders.push({
      id: `rss-${await computeHash(link || title, 'sha256')}`,
      title,
      description: description || null,
      publicationDate: pubDate || new Date().toISOString(),
      closingDate: null,
      organization: '',
      procurementMethod: null,
      estimatedValue: null,
      tradeAgreement: null,
      gsin: null,
      url: link,
      status: 'open',
    });
  }

  return tenders;
}


/**
 * Fetch proactive disclosure data from open.canada.ca CKAN API.
 * These are contracts awarded over $10K, published quarterly.
 */
export async function fetchProactiveDisclosureContracts(): Promise<{
  total: number;
  contracts: Partial<ContractAward>[];
  sourceUrl: string;
}> {
  const searchUrl = 'https://search.open.canada.ca/api/select?q=proactive+disclosure+AND+contracts&fq=owner_org:gc&rows=5&wt=json';

  const resp = await httpGet(searchUrl, {
    headers: { Accept: 'application/json' },
  });

  const body: any = resp.body ? JSON.parse(resp.body) : {};
  const docs = body?.response?.docs ?? [];

  return {
    total: body?.response?.numFound ?? 0,
    contracts: docs.map((d: any) => ({
      department: d.org_title_at_publication ?? d.owner_org ?? '',
      description: d.notes ?? d.title ?? null,
      sourceUrl: d.url ?? searchUrl,
    })),
    sourceUrl: searchUrl,
  };
}


/**
 * Keywords that indicate a contract may be sole-source (non-competitive).
 */
const SOLE_SOURCE_INDICATORS = [
  'sole source', 'non-competitive', 'single source', 'sole-source',
  'non competitive', 'amendment', 'extension', 'emergency',
  'exception to competition', 'only known supplier', 'proprietary',
  'national security exception',
];

/**
 * Check if a contract description indicates sole-source procurement.
 */
export function isSoleSource(description: string | null, method: string | null): boolean {
  if (method) {
    const methodLower = method.toLowerCase();
    if (methodLower.includes('sole') || methodLower.includes('non-competitive') || methodLower === 'single source') {
      return true;
    }
  }

  if (description) {
    const descLower = description.toLowerCase();
    return SOLE_SOURCE_INDICATORS.some(indicator => descLower.includes(indicator));
  }

  return false;
}


/**
 * Parse a contract value string (e.g. "$1,234,567.89 CAD") to a number.
 */
export function parseContractValue(value: string): number | null {
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
