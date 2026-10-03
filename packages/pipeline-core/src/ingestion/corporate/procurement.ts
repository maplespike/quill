/**
 * Procurement Connector — MapleSpike Pipeline
 *
 * Fetches Canadian government procurement contracts from:
 *   - CanadaBuys tender notices
 *   - buyandsell.gc.ca contract history (legacy)
 *   - Proactive disclosure of contracts over $10K (via open.canada.ca)
 *
 * These public-facing procurement sources reveal who gets
 * taxpayer-funded contracts and under what terms.
 */

import { httpGet, parseJsonBody } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { CORPORATE_SOURCES } from './constants.js';


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

export class ProcurementFetchError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'ProcurementFetchError';
  }
}

/** Contracts pulled from the disclosure datastore per run. */
export const PROCUREMENT_PAGE_LIMIT = 100;

/**
 * CanadaBuys publishes no machine-readable tender feed.
 *
 * Every candidate RSS path 404s (`/notices/rss`, `/en/rss`, `/en/notices/rss`,
 * `/api/notices/rss`, `/en/tender-opportunities/rss` — verified 2026-09-23) and
 * the tender list itself is rendered client-side, which this image cannot
 * drive. Reporting the gap is deliberate: returning `[]` read as "no tenders
 * today" and hid a dead source. Awarded contracts come from the CKAN
 * `Contracts over $10,000` datastore (see fetchProactiveDisclosureContracts).
 */
export async function fetchTendersRss(): Promise<TenderNotice[]> {
  throw new ProcurementFetchError(
    'CanadaBuys exposes no RSS/JSON tender feed — every /rss path returns 404; ' +
      'awarded contracts are read from the CKAN contracts datastore instead.',
  );
}


/**
 * A contract award read from the federal "Proactive Disclosure - Contracts"
 * datastore. Field names come from the published contracts data dictionary.
 */
export interface DisclosureContract {
  id: string;
  vendorName: string;
  contractValue: number;
  awardDate: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  department: string;
  procurementMethod: string | null;
  tradeAgreement: string | null;
  bidsReceived: number | null;
  isSoleSource: boolean;
  sourceUrl: string;
  ingestedAt: string;
}

const CONTRACTS_DATA_DICTIONARY_URL =
  'https://open.canada.ca/data/dataset/' + CORPORATE_SOURCES.PROCUREMENT.OPEN_DATA_DATASET_ID +
  '/resource/' + CORPORATE_SOURCES.PROCUREMENT.CONTRACTS_RESOURCE_ID;

/** Parse a contract value string ("38900.25") into a number. */
function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  return isNaN(n) ? 0 : n;
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Fetch proactive-disclosure contracts over $10,000 from the open.canada.ca
 * CKAN datastore.
 *
 * The previous implementation queried `search.open.canada.ca/api/select`
 * (404), so procurement persisted nothing. The same data is published as a
 * datastore-active CKAN resource, so it is queried row-by-row by exact
 * resource id. Failures throw: a dead source must not look like "no contracts".
 */
export async function fetchProactiveDisclosureContracts(): Promise<{
  total: number;
  contracts: DisclosureContract[];
  sourceUrl: string;
}> {
  const url =
    `${CORPORATE_SOURCES.PROCUREMENT.CKAN_DATASTORE_SEARCH}` +
    `?resource_id=${CORPORATE_SOURCES.PROCUREMENT.CONTRACTS_RESOURCE_ID}` +
    `&limit=${PROCUREMENT_PAGE_LIMIT}&sort=contract_date+desc`;

  const resp = await httpGet(url, {
    headers: { Accept: 'application/json' },
    timeoutMs: 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new ProcurementFetchError(`HTTP ${resp.statusCode} fetching contracts datastore`, url);
  }

  const body: any = JSON.parse(resp.body);
  if (body?.success === false) {
    throw new ProcurementFetchError(
      `CKAN datastore error: ${body?.error?.message ?? 'unknown'}`,
      url,
    );
  }

  const records: Record<string, unknown>[] = body?.result?.records ?? [];
  const now = new Date().toISOString();
  const contracts: DisclosureContract[] = [];

  for (const rec of records) {
    const vendor = toText(rec['vendor_name']) ?? 'Unknown Vendor';
    const department = toText(rec['owner_org_title']) ?? toText(rec['owner_org']) ?? 'Unknown Department';
    const reference = toText(rec['reference_number']) ?? '';
    const description = toText(rec['description_en']);
    // A populated limited-tendering reason means the award was NOT competed.
    const limitedReason = toText(rec['limited_tendering_reason']);
    const soleSource = (limitedReason !== null && limitedReason !== '0' && limitedReason !== '00')
      || isSoleSource(description, toText(rec['solicitation_procedure']));

    contracts.push({
      id: await computeHash(`contract|${reference}|${vendor}|${department}`, 'sha256'),
      vendorName: vendor,
      contractValue: toNumber(rec['contract_value']),
      awardDate: toText(rec['contract_date']) ?? now.split('T')[0],
      startDate: toText(rec['contract_period_start']),
      endDate: toText(rec['delivery_date']),
      description,
      department,
      procurementMethod: toText(rec['solicitation_procedure']),
      tradeAgreement: toText(rec['trade_agreement']),
      bidsReceived: rec['number_of_bids'] === null || rec['number_of_bids'] === undefined
        ? null
        : toNumber(rec['number_of_bids']),
      isSoleSource: soleSource,
      sourceUrl: CONTRACTS_DATA_DICTIONARY_URL,
      ingestedAt: now,
    });
  }

  return {
    total: typeof body?.result?.total === 'number' ? body.result.total : contracts.length,
    contracts,
    sourceUrl: CONTRACTS_DATA_DICTIONARY_URL,
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
