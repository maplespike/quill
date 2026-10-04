/**
 * Health Canada Fetcher — Quill
 *
 * Fetches regulated product records from Health Canada sources:
 *   - Drug Product Database (DPD) — JSON API
 *   - Medical Devices Active License Listing (MDALL) — JSON API
 *   - Licensed Natural Health Products (LNHP) — JSON API
 *   - Recalls and Safety Alerts — RSS feed + JSON API
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  HC_SOURCES,
  HC_PRODUCT_TYPE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  HealthCanadaProductType,
  RawHealthCanadaRecord,
  DpdApiRecord,
  MdallApiRecord,
  LnhpApiRecord,
  RecallApiRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class HealthCanadaFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly productType?: HealthCanadaProductType,
  ) {
    super(message);
    this.name = 'HealthCanadaFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL.
 */
async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new HealthCanadaFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL.
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'application/rss+xml,application/xml,text/xml,text/html,*/*' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new HealthCanadaFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  Drug Product Database (DPD) Fetcher                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch drug products from the DPD JSON API.
 *
 * Health Canada DPD API endpoints:
 *   /api/drug — list all drug products
 *   /api/drug?din={din} — specific drug by DIN
 *   /api/drug?status={status} — filter by status
 *   /api/drug?company={name} — filter by company name
 *
 * @returns Raw drug product records
 */
async function fetchDrugProducts(
  options: {
    din?: string;
    status?: string;
    company?: string;
    limit?: number;
  } = {},
): Promise<RawHealthCanadaRecord[]> {
  const url = new URL(`${HC_SOURCES.DPD.JSON_API}/drug`);

  if (options.din) url.searchParams.set('din', options.din);
  if (options.status) url.searchParams.set('status', options.status);
  if (options.company) url.searchParams.set('company', options.company);
  if (options.limit) url.searchParams.set('limit', String(options.limit));

  const data = await fetchJson<DpdApiRecord[] | DpdApiRecord>(url.toString());
  const records = Array.isArray(data) ? data : [data];

  return records.map((item): RawHealthCanadaRecord => ({
    productName: item.brand_name,
    productType: 'drug',
    licenseNumber: item.drug_identification_number,
    licenseStatus: item.status,
    manufacturer: item.pharmaceutical_company,
    din: item.drug_identification_number,
    activeIngredient: item.active_ingredient_list
      ? item.active_ingredient_list.map((a) => a.active_ingredient_name).filter(Boolean).join('; ')
      : undefined,
    therapeuticArea: item.therapeutic_class,
    dosageForm: item.dosage_form,
    routeOfAdministration: item.route_of_administration,
    licenseDate: item.original_market_date,
    sourceUrl: item.drug_identification_number
      ? `${HC_SOURCES.DPD.DETAIL}${item.drug_identification_number}`
      : HC_SOURCES.DPD.SEARCH,
    sourceSystem: 'hc-dpd',
  }));
}

/* ------------------------------------------------------------------ */
/*  Medical Devices (MDALL) Fetcher                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch medical device licenses from the MDALL JSON API.
 *
 * @returns Raw medical device records
 */
async function fetchDeviceProducts(
  options: {
    licenceNumber?: string;
    company?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<RawHealthCanadaRecord[]> {
  const url = new URL(`${HC_SOURCES.MDALL.JSON_API}/medical-device`);

  if (options.licenceNumber) url.searchParams.set('licenceNumber', options.licenceNumber);
  if (options.company) url.searchParams.set('company', options.company);
  if (options.status) url.searchParams.set('status', options.status);
  if (options.limit) url.searchParams.set('limit', String(options.limit));

  const data = await fetchJson<MdallApiRecord[] | MdallApiRecord>(url.toString());
  const records = Array.isArray(data) ? data : [data];

  return records.map((item): RawHealthCanadaRecord => ({
    productName: item.licence_name,
    productType: 'device',
    licenseNumber: item.licence_number,
    licenseStatus: item.licence_status,
    manufacturer: item.company_name,
    companyStatus: item.licence_status,
    licenseDate: item.licence_date,
    sourceUrl: item.licence_number
      ? `${HC_SOURCES.MDALL.LICENCE_DETAIL}${item.licence_number}`
      : HC_SOURCES.MDALL.SEARCH,
    sourceSystem: 'hc-mdall',
  }));
}

/* ------------------------------------------------------------------ */
/*  Natural Health Products (LNHP) Fetcher                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch licensed natural health products from the LNHP JSON API.
 *
 * @returns Raw natural product records
 */
async function fetchNaturalProducts(
  options: {
    npn?: string;
    company?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<RawHealthCanadaRecord[]> {
  const url = new URL(`${HC_SOURCES.LNHP.JSON_API}/natural-product`);

  if (options.npn) url.searchParams.set('npn', options.npn);
  if (options.company) url.searchParams.set('company', options.company);
  if (options.status) url.searchParams.set('status', options.status);
  if (options.limit) url.searchParams.set('limit', String(options.limit));

  const data = await fetchJson<LnhpApiRecord[] | LnhpApiRecord>(url.toString());
  const records = Array.isArray(data) ? data : [data];

  return records.map((item): RawHealthCanadaRecord => ({
    productName: item.product_name,
    productType: 'natural',
    licenseNumber: item.npn,
    licenseStatus: item.status,
    manufacturer: item.company_name,
    npn: item.npn,
    activeIngredient: item.medicinal_ingredients,
    dosageForm: item.dosage_form,
    routeOfAdministration: item.route_of_administration,
    licenseDate: item.licence_date,
    expiryDate: item.expiry_date,
    sourceUrl: item.npn
      ? `${HC_SOURCES.LNHP.DETAIL}${item.npn}`
      : HC_SOURCES.LNHP.SEARCH,
    sourceSystem: 'hc-lnhp',
  }));
}

/* ------------------------------------------------------------------ */
/*  Recalls and Safety Alerts Fetcher                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse RSS XML items into raw recall records.
 */
function parseRecallRssItems(xmlText: string): RecallApiRecord[] {
  const items: RecallApiRecord[] = [];

  // Simple RSS item parsing — matches <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const block = itemMatch[1];
    const extract = (tag: string): string | undefined => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return m ? m[1].trim() : undefined;
    };

    const extractNs = (tag: string): string | undefined => {
      // Match namespaced tags like <recall:severity>
      const m = new RegExp(`<[^:]*:${tag}[^>]*>([\\s\\S]*?)<\\/[^:]*:${tag}>`, 'i').exec(block);
      return m ? m[1].trim() : undefined;
    };

    const link = extract('link');
    items.push({
      title: extract('title'),
      description: extract('description')?.replace(/<[^>]*>/g, ''),
      link,
      pubDate: extract('pubDate'),
      category: extract('category'),
      'recall:severity': extractNs('severity'),
      'recall:classification': extractNs('classification'),
      'recall:reason': extractNs('reason'),
      'recall:company': extractNs('company'),
    });
  }

  return items;
}

/**
 * Fetch recall and safety alert records.
 * Tries the JSON API first, falls back to RSS feed parsing.
 *
 * @returns Raw recall records
 */
async function fetchRecallProducts(
  options: {
    severity?: string;
    category?: string;
    limit?: number;
  } = {},
): Promise<RawHealthCanadaRecord[]> {
  const records: RawHealthCanadaRecord[] = [];
  let sourceSystem = 'hc-recalls';

  // Try JSON API first
  try {
    const url = new URL(HC_SOURCES.RECALLS.JSON);
    if (options.category) url.searchParams.set('category', options.category);
    if (options.severity) url.searchParams.set('severity', options.severity);
    if (options.limit) url.searchParams.set('limit', String(options.limit));
    url.searchParams.set('lang', 'en');

    const data = await fetchJson<Record<string, unknown>>(url.toString());
    sourceSystem = 'hc-recalls-json';

    // The recalls API returns various shapes; try to extract results
    const results = (data.results ?? data.recalls ?? data.items ?? data) as unknown[];

    if (Array.isArray(results)) {
      for (const item of results) {
        const r = item as Record<string, unknown>;
        records.push({
          productName: String(r.title ?? r.product_name ?? r.name ?? ''),
          productType: 'recall',
          licenseStatus: 'recalled',
          manufacturer: String(r.company ?? r.manufacturer ?? r.recall_company ?? ''),
          recallSeverity: String(r.severity ?? r.recall_severity ?? r.risk_level ?? ''),
          recallReason: String(r.reason ?? r.recall_reason ?? r.description ?? ''),
          recallClassification: String(r.classification ?? r.recall_classification ?? ''),
          licenseDate: String(r.pubDate ?? r.published_date ?? r.date ?? ''),
          sourceUrl: String(r.link ?? r.url ?? r.source_url ?? HC_SOURCES.RECALLS.SEARCH),
          sourceSystem: 'hc-recalls-json',
        });
      }
    }
  } catch {
    // JSON API failed — fall back to RSS
  }

  // If JSON API returned nothing, try RSS
  if (records.length === 0) {
    try {
      const rssXml = await fetchText(HC_SOURCES.RECALLS.RSS);
      const rssItems = parseRecallRssItems(rssXml);

      for (const item of rssItems.slice(0, options.limit ?? 200)) {
        records.push({
          productName: item.title ?? '',
          productType: 'recall',
          licenseStatus: 'recalled',
          manufacturer: item['recall:company'],
          recallSeverity: item['recall:severity'],
          recallReason: item['recall:reason'] ?? item.description,
          recallClassification: item['recall:classification'],
          licenseDate: item.pubDate,
          sourceUrl: item.link ?? HC_SOURCES.RECALLS.SEARCH,
          sourceSystem: 'hc-recalls-rss',
        });
      }
    } catch (err) {
      throw new HealthCanadaFetchError(
        `Failed to fetch recalls from RSS: ${(err as Error).message}`,
        undefined,
        HC_SOURCES.RECALLS.RSS,
        'recall',
      );
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Product-Type Dispatcher                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch Health Canada product records by type.
 *
 * @param type - Product type to fetch
 * @param options - Fetch options
 * @returns Raw product records with source info and errors
 */
export async function fetchHealthCanadaProducts(
  type: HealthCanadaProductType,
  options: {
    searchTerm?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawHealthCanadaRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawHealthCanadaRecord[] = [];
  let source = 'none';

  try {
    const limit = options.limit ?? HC_PRODUCT_TYPE_CONFIG[type].defaultLimit;

    switch (type) {
      case 'drug':
        records = await fetchDrugProducts({
          status: options.status,
          limit,
        });
        source = 'hc-dpd';
        break;

      case 'device':
        records = await fetchDeviceProducts({
          status: options.status,
          limit,
        });
        source = 'hc-mdall';
        break;

      case 'natural':
        records = await fetchNaturalProducts({
          status: options.status,
          limit,
        });
        source = 'hc-lnhp';
        break;

      case 'recall':
        records = await fetchRecallProducts({
          limit,
        });
        source = 'hc-recalls';
        break;
    }

    // If search term provided, filter client-side
    if (options.searchTerm && records.length > 0) {
      const term = options.searchTerm.toLowerCase();
      records = records.filter(
        (r) =>
          r.productName?.toLowerCase().includes(term) ||
          r.manufacturer?.toLowerCase().includes(term) ||
          r.activeIngredient?.toLowerCase().includes(term),
      );
    }
  } catch (err) {
    errors.push(`HC fetch failed for ${type}: ${(err as Error).message}`);
  }

  return { records, source, errors };
}

/**
 * Fetch all four Health Canada product types.
 *
 * @returns Combined raw records grouped by type
 */
export async function fetchAllHealthCanadaProducts(
  options: {
    limit?: number;
  } = {},
): Promise<{
  records: RawHealthCanadaRecord[];
  perType: Record<HealthCanadaProductType, RawHealthCanadaRecord[]>;
  errors: string[];
}> {
  const perType: Record<string, RawHealthCanadaRecord[]> = {};
  const allRecords: RawHealthCanadaRecord[] = [];
  const allErrors: string[] = [];

  const types: HealthCanadaProductType[] = ['drug', 'device', 'natural', 'recall'];

  for (const type of types) {
    const { records, errors } = await fetchHealthCanadaProducts(type, options);
    perType[type] = records;
    allRecords.push(...records);
    allErrors.push(...errors);
  }

  return {
    records: allRecords,
    perType: perType as Record<HealthCanadaProductType, RawHealthCanadaRecord[]>,
    errors: allErrors,
  };
}
