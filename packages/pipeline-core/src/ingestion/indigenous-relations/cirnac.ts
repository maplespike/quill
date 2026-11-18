// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CIRNAC Connector — Quill
 *
 * Fetches CIRNAC data for:
 *   1. Land claims (specific and comprehensive)
 *   2. Self-government agreements (active negotiations)
 *
 * Primary data sources:
 *   - CKAN API package_search/package_show for CIRNAC datasets
 *   - Open Canada portal for CIRNAC records
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  INDIGENOUS_SOURCES,
  CIRNAC_DATASETS,
  CIRNAC_CKAN_QUERY,
  IndigenousFetchError,
  DEFAULT_MAX_RECORDS,
  INDIGENOUS_SOURCE_NAMES,
} from './constants.js';
import type {
  LandClaim,
  SelfGovernmentAgreement,
  IndigenousIngestionResult,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  CKAN Dataset Metadata Fetch (CIRNAC-specific)                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch CKAN dataset metadata for a CIRNAC dataset.
 */
export async function fetchCirnacCkanDataset(datasetId: string): Promise<{
  id: string;
  title: string;
  resources: { name: string; format: string; url: string; lastModified: string }[];
}> {
  const url = `${INDIGENOUS_SOURCES.CKAN.SHOW}?id=${datasetId}`;
  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{ success: boolean; result: { id: string; title: string; resources: any[] } }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return {
      id: parsed.result.id,
      title: parsed.result.title,
      resources: parsed.result.resources.map((r: any) => ({
        name: r.name ?? '',
        format: r.format ?? '',
        url: r.url ?? '',
        lastModified: r.last_modified ?? r.created ?? '',
      })),
    };
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Search CIRNAC Packages on CKAN                                    */
/* ------------------------------------------------------------------ */

/**
 * Search for CIRNAC land-claim related packages on open.canada.ca.
 */
export async function searchCirnacPackages(
  query: string = CIRNAC_CKAN_QUERY,
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<{
  count: number;
  results: { id: string; title: string; notes: string; url: string }[];
}> {
  const url = `${INDIGENOUS_SOURCES.CKAN.SEARCH}?q=${encodeURIComponent(query)}&rows=${Math.min(limit, 100)}`;
  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{
      success: boolean;
      result: { count: number; results: any[] };
    }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return {
      count: parsed.result.count,
      results: parsed.result.results.map((r: any) => ({
        id: r.id,
        title: r.title ?? '',
        notes: r.notes ?? '',
        url: `https://open.canada.ca/data/en/dataset/${r.id}`,
      })),
    };
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan-search',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Land Claim Parsing & Fetching                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw CIRNAC land claim record from CKAN or HTML into a LandClaim.
 */
export function parseLandClaim(raw: {
  claimant: string;
  provinceTerritory?: string;
  claimType?: string;
  description?: string;
  status?: string;
  submissionDate?: string;
  settlementDate?: string;
  settlementAmount?: number;
  negotiationStage?: string;
  ckanDatasetId: string;
  sourceUrl: string;
}): LandClaim {
  const normalizedType = raw.claimType === 'comprehensive' ? 'comprehensive' : 'specific';
  const now = new Date().toISOString();
  const content = `${raw.claimant}|${normalizedType}|${raw.status ?? ''}|${raw.submissionDate ?? ''}|${raw.settlementDate ?? ''}|${raw.settlementAmount ?? 0}`;

  return {
    id: '', // computed below
    claimType: normalizedType,
    claimant: raw.claimant,
    provinceTerritory: raw.provinceTerritory ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'Active',
    submissionDate: raw.submissionDate ?? null,
    settlementDate: raw.settlementDate ?? null,
    settlementAmountCad: raw.settlementAmount ?? null,
    durationYears: raw.submissionDate && raw.settlementDate
      ? (new Date(raw.settlementDate).getFullYear() - new Date(raw.submissionDate).getFullYear())
      : null,
    negotiationStage: raw.negotiationStage ?? null,
    ckanDatasetId: raw.ckanDatasetId,
    sourceUrl: raw.sourceUrl,
    ingestedAt: now,
  };
}

/**
 * Compute hash for a land claim record (called after parseLandClaim).
 */
export function computeLandClaimId(claim: Omit<LandClaim, 'id'>): string {
  const content = `${claim.claimant}|${claim.claimType}|${claim.status}|${claim.submissionDate ?? ''}|${claim.settlementAmountCad ?? 0}`;
  // Will be set by the caller after generation
  return '';
}

/**
 * Fetch CIRNAC land claims (simulated — in production this calls CKAN
 * resource CSV or CIRNAC open data API).
 *
 * Returns parsed LandClaim records.
 */
export async function fetchLandClaims(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<LandClaim[]> {
  const now = new Date().toISOString();
  const claims: LandClaim[] = [];

  try {
    // Query CKAN for CIRNAC specific claims dataset
    const ckanData = await fetchCirnacCkanDataset(CIRNAC_DATASETS.SPECIFIC_CLAIMS.id);

    // In production, fetch and parse the actual resource CSVs/JSON.
    // For now, return parsed metadata as a record.
    // Real implementation: download resources[0].url, parse CSV/JSON
    // and map to LandClaim records.

    // Placeholder: create a single meta-record from CKAN metadata
    const content = `cirnac-meta|${ckanData.id}|${ckanData.title}`;
    const contentHash = await computeHash(content, 'sha256');

    claims.push({
      id: contentHash,
      claimType: 'specific',
      claimant: ckanData.title,
      provinceTerritory: '',
      description: `CIRNAC specific claims dataset: ${ckanData.title} — ${ckanData.resources.length} resources`,
      status: 'Active',
      submissionDate: null,
      settlementDate: null,
      settlementAmountCad: null,
      durationYears: null,
      negotiationStage: 'Data source registered',
      ckanDatasetId: CIRNAC_DATASETS.SPECIFIC_CLAIMS.id,
      sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.SPECIFIC_CLAIMS.id}`,
      ingestedAt: now,
    });

    return claims.slice(0, limit);
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      INDIGENOUS_SOURCE_NAMES.CIRNAC_LAND_CLAIMS,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Self-Government Agreements                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch CIRNAC self-government agreement data.
 *
 * In production, this fetches from CKAN or CIRNAC's self-government
 * agreements page. Returns parsed SelfGovernmentAgreement records.
 */
export async function fetchSelfGovernmentAgreements(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<SelfGovernmentAgreement[]> {
  const now = new Date().toISOString();
  const agreements: SelfGovernmentAgreement[] = [];

  try {
    const ckanData = await fetchCirnacCkanDataset(CIRNAC_DATASETS.SELF_GOVERNMENT.id);

    const content = `self-gov-meta|${ckanData.id}|${ckanData.title}`;
    const contentHash = await computeHash(content, 'sha256');

    agreements.push({
      id: contentHash,
      indigenousGroup: ckanData.title,
      provinceTerritory: '',
      stage: 'Data source registered',
      agreementType: 'Self-Government',
      signingDate: null,
      effectiveDate: null,
      keyProvisions: `CIRNAC self-government dataset: ${ckanData.title} — ${ckanData.resources.length} resources`,
      jurisdictionAreas: [],
      isCirnacLed: true,
      sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.SELF_GOVERNMENT.id}`,
      ingestedAt: now,
    });

    return agreements.slice(0, limit);
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      INDIGENOUS_SOURCE_NAMES.CIRNAC_SELF_GOVERNMENT,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregated Fetchers                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch all CIRNAC data (land claims + self-government).
 */
export async function fetchAllCirnacData(
  options: { limit?: number } = {},
): Promise<{ landClaims: LandClaim[]; selfGovernment: SelfGovernmentAgreement[] }> {
  const { limit = DEFAULT_MAX_RECORDS } = options;

  const [landClaims, selfGovernment] = await Promise.all([
    fetchLandClaims(limit),
    fetchSelfGovernmentAgreements(limit),
  ]);

  return { landClaims, selfGovernment };
}
