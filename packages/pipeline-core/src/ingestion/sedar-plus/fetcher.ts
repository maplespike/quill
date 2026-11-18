/**
 * SEDAR+ Fetcher — Quill
 *
 * Fetches corporate filings from the Canadian SEDAR+ system.
 * Uses the CD Plus API for modern filings and falls back to
 * the legacy SEDAR system for historical documents.
 *
 * This is not SEDI. Live automated access here is tracked in
 * https://github.com/maplespike/quill/issues/1328
 */

import { httpGet } from '../../utils/http.js';
import {
  CDPLUS_SEARCH_URL,
  CDPLUS_ISSUER_URL,
  SEDARPLUS_DEFAULT_HEADERS,
  SEDARPLUS_TIMEOUT_MS,
  classifyFilingType,
} from './constants.js';
import type {
  SedarFiling,
  SedarSearchParams,
  SedarSearchResult,
  SedarIssuer,
  CdPlusApiResponse,
  FilingJurisdiction,
  FilingStatus,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Public Fetch Functions                                             */
/* ------------------------------------------------------------------ */

/**
 * Search SEDAR+ filings using CD Plus API.
 * Returns structured results with pagination.
 *
 * The CD Plus API supports filtering by issuer, date range, filing type,
 * jurisdiction, and keyword. Responses are JSON with pagination metadata.
 */
export async function searchFilings(
  params: SedarSearchParams,
): Promise<SedarSearchResult> {
  const queryParts: string[] = [];
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  if (params.issuer) queryParts.push(`issuer=${encodeURIComponent(params.issuer)}`);
  if (params.fromDate) queryParts.push(`fromDate=${params.fromDate}`);
  if (params.toDate) queryParts.push(`toDate=${params.toDate}`);
  if (params.jurisdiction) queryParts.push(`jurisdiction=${params.jurisdiction}`);
  if (params.keyword) queryParts.push(`keyword=${encodeURIComponent(params.keyword)}`);
  if (params.filingTypes && params.filingTypes.length > 0) {
    queryParts.push(`filingTypes=${params.filingTypes.join(',')}`);
  }
  queryParts.push(`limit=${limit}`);
  queryParts.push(`offset=${offset}`);

  const url = `${CDPLUS_SEARCH_URL}?${queryParts.join('&')}`;

  try {
    const resp = await httpGet(url, {
      timeoutMs: SEDARPLUS_TIMEOUT_MS,
      headers: SEDARPLUS_DEFAULT_HEADERS,
    });

    if (resp.statusCode >= 400) {
      return {
        total: 0,
        results: [],
        offset,
        limit,
        hasMore: false,
      };
    }

    const apiResult = JSON.parse(resp.body) as CdPlusApiResponse<RawCdPlusFiling>;
    const results = apiResult.data ? apiResult.data.map(mapCdPlusFiling) : [];
    const total = apiResult.pagination?.total ?? results.length;
    const returnedOffset = apiResult.pagination?.offset ?? offset;
    const returnedLimit = apiResult.pagination?.limit ?? limit;

    return {
      total,
      results,
      offset: returnedOffset,
      limit: returnedLimit,
      hasMore: returnedOffset + returnedLimit < total,
    };
  } catch (err) {
    console.warn(`[SEDAR+] Search failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      total: 0,
      results: [],
      offset,
      limit,
      hasMore: false,
    };
  }
}

/**
 * Search filings for a specific issuer by name or ticker.
 * Convenience wrapper around searchFilings.
 */
export async function searchFilingsByIssuer(
  issuer: string,
  options: {
    fromDate?: string;
    toDate?: string;
    filingTypes?: string[];
    limit?: number;
  } = {},
): Promise<SedarSearchResult> {
  return searchFilings({
    issuer,
    fromDate: options.fromDate,
    toDate: options.toDate,
    limit: options.limit ?? 50,
  });
}

/**
 * Fetch issuer profile from CD Plus API.
 */
export async function fetchIssuer(issuerId: string): Promise<SedarIssuer | null> {
  try {
    const url = `${CDPLUS_ISSUER_URL}/${encodeURIComponent(issuerId)}`;
    const resp = await httpGet(url, {
      timeoutMs: SEDARPLUS_TIMEOUT_MS,
      headers: SEDARPLUS_DEFAULT_HEADERS,
    });

    if (resp.statusCode >= 400) return null;

    const data = JSON.parse(resp.body) as RawCdPlusIssuer;
    return mapCdPlusIssuer(data);
  } catch (err) {
    console.warn(`[SEDAR+] Fetch issuer failed for ${issuerId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Fetch the most recent filings across all tracked issuers.
 * Good for a broad sweep of latest filings.
 */
export async function fetchRecentFilings(
  limit: number = 50,
): Promise<SedarSearchResult> {
  return searchFilings({
    limit,
    offset: 0,
  });
}

/**
 * Fetch AIF (Annual Information Form) filings for an issuer — these are
 * the most comprehensive annual disclosure documents, similar to SEC Form 10-K.
 */
export async function fetchAifFilings(
  issuer: string,
  options: { fromDate?: string; toDate?: string; limit?: number } = {},
): Promise<SedarSearchResult> {
  return searchFilings({
    issuer,
    filingTypes: ['aif'],
    fromDate: options.fromDate,
    toDate: options.toDate,
    limit: options.limit ?? 20,
  });
}

/* ------------------------------------------------------------------ */
/*  Internal Raw API Types & Mappers                                   */
/* ------------------------------------------------------------------ */

interface RawCdPlusFiling {
  filingId?: string;
  id?: string;
  issuerId?: string;
  companyName?: string;
  issuerName?: string;
  filingDate?: string;
  periodEnd?: string;
  periodEndDate?: string;
  filingType?: string;
  formType?: string;
  documentType?: string;
  title?: string;
  description?: string;
  documentUrl?: string;
  url?: string;
  fileSize?: number;
  fileSizeBytes?: number;
  format?: string;
  fileFormat?: string;
  language?: string;
  jurisdiction?: string;
  status?: string;
  projectNumber?: string;
  isLegacy?: boolean;
}

interface RawCdPlusIssuer {
  id?: string;
  issuerId?: string;
  name?: string;
  companyName?: string;
  tickers?: Array<{ exchange: string; symbol: string }>;
  sector?: string;
  industry?: string;
  jurisdiction?: string;
  city?: string;
  active?: boolean;
  status?: string;
}

function mapCdPlusFiling(raw: RawCdPlusFiling): SedarFiling {
  const filingTypeRaw = raw.filingType ?? raw.formType ?? raw.documentType ?? 'other';
  const ingestedAt = new Date().toISOString();
  const rawJurisdiction = (raw.jurisdiction ?? '').toUpperCase();

  return {
    filingId: raw.filingId ?? raw.id ?? `unknown-${Date.now()}`,
    issuerId: raw.issuerId ?? '',
    issuerName: raw.companyName ?? raw.issuerName ?? 'Unknown',
    filingDate: raw.filingDate ?? ingestedAt.slice(0, 10),
    periodEnd: raw.periodEnd ?? raw.periodEndDate ?? null,
    filingType: classifyFilingType(filingTypeRaw),
    filingTypeRaw,
    title: raw.title ?? filingTypeRaw,
    description: raw.description ?? null,
    documentUrl: raw.documentUrl ?? raw.url ?? '',
    fileSizeBytes: raw.fileSize ?? raw.fileSizeBytes ?? null,
    fileFormat: normalizeFormat(raw.format ?? raw.fileFormat ?? 'pdf'),
    language: (raw.language === 'fr' ? 'fr' : raw.language === 'bilingual' ? 'bilingual' : 'en'),
    jurisdiction: JURISDICTION_MAP[rawJurisdiction] ?? 'federal',
    status: normalizeStatus(raw.status),
    projectNumber: raw.projectNumber ?? null,
    isLegacy: raw.isLegacy ?? false,
    ingestedAt,
  };
}

function mapCdPlusIssuer(raw: RawCdPlusIssuer): SedarIssuer {
  return {
    issuerId: raw.id ?? raw.issuerId ?? '',
    name: raw.name ?? raw.companyName ?? 'Unknown',
    tickers: raw.tickers ?? [],
    sector: mapSector(raw.sector ?? raw.industry ?? null),
    jurisdiction: mapJurisdiction(raw.jurisdiction ?? null),
    city: raw.city ?? null,
    active: raw.active ?? (raw.status?.toLowerCase() === 'active'),
  };
}

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                   */
/* ------------------------------------------------------------------ */

const JURISDICTION_MAP: Record<string, FilingJurisdiction> = {
  'ON': 'ontario', 'ONTARIO': 'ontario',
  'QC': 'quebec', 'QUEBEC': 'quebec', 'QUÉBEC': 'quebec',
  'BC': 'british-columbia', 'BRITISH COLUMBIA': 'british-columbia',
  'AB': 'alberta', 'ALBERTA': 'alberta',
  'SK': 'saskatchewan', 'SASKATCHEWAN': 'saskatchewan',
  'MB': 'manitoba', 'MANITOBA': 'manitoba',
  'NS': 'nova-scotia', 'NOVA SCOTIA': 'nova-scotia',
  'NB': 'new-brunswick', 'NEW BRUNSWICK': 'new-brunswick',
  'NL': 'newfoundland-labrador', 'NEWFOUNDLAND AND LABRADOR': 'newfoundland-labrador',
  'PE': 'pei', 'PEI': 'pei', 'PRINCE EDWARD ISLAND': 'pei',
  'YT': 'yukon', 'YUKON': 'yukon',
  'NT': 'northwest-territories', 'NORTHWEST TERRITORIES': 'northwest-territories',
  'NU': 'nunavut', 'NUNAVUT': 'nunavut',
  'FED': 'federal', 'FEDERAL': 'federal',
};

const STATUS_MAP: Record<string, FilingStatus> = {
  'ACTIVE': 'active',
  'SUPERSEDED': 'superseded',
  'WITHDRAWN': 'withdrawn',
  'REVOKED': 'revoked',
};

function normalizeStatus(raw?: string): FilingStatus {
  if (!raw) return 'active';
  return STATUS_MAP[raw.toUpperCase().trim()] ?? 'active';
}

function normalizeFormat(raw?: string): SedarFiling['fileFormat'] {
  if (!raw) return 'pdf';
  const fmt = raw.toLowerCase().trim();
  if (['pdf', 'html', 'docx', 'xlsx', 'txt'].includes(fmt)) {
    return fmt as SedarFiling['fileFormat'];
  }
  return 'other';
}

function mapSector(raw: string | null): import('./types.js').SedarIndustrySector | null {
  if (!raw) return null;
  const sector = raw.toLowerCase().trim();
  const validSectors: import('./types.js').SedarIndustrySector[] = [
    'agriculture', 'biotechnology', 'clean-technology', 'communications-media',
    'consumer-products', 'financial-services', 'gaming', 'industrial', 'insurance',
    'investment-funds', 'life-sciences', 'manufacturing', 'mining', 'oil-gas',
    'real-estate', 'retail', 'services', 'technology', 'transportation', 'other',
  ];
  return validSectors.includes(sector as any) ? sector as any : 'other';
}

function mapJurisdiction(raw: string | null): FilingJurisdiction | null {
  if (!raw) return null;
  return JURISDICTION_MAP[raw.toUpperCase().trim()] ?? null as any;
}
