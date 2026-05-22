/**
 * CIRNAC Connector — MapleSpike Pipeline
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
import { parseCsvLine } from '../../utils/csv.js';
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
export async function computeLandClaimId(claim: Omit<LandClaim, 'id'>): Promise<string> {
  const content = `${claim.claimant}|${claim.claimType}|${claim.status}|${claim.submissionDate ?? ''}|${claim.settlementAmountCad ?? 0}`;
  return computeHash(content, 'sha256');
}

/**
 * Fetch CIRNAC land claims from CKAN dataset resources.
 *
 * Downloads resource CSVs/JSON from the CIRNAC CKAN dataset, parses them,
 * and returns structured LandClaim records. Falls back to a meta-record
 * when no structured data resources are available (e.g. PDF-only datasets).
 */
export async function fetchLandClaims(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<LandClaim[]> {
  const claims: LandClaim[] = [];
  const errors: string[] = [];

  try {
    const ckanData = await fetchCirnacCkanDataset(CIRNAC_DATASETS.SPECIFIC_CLAIMS.id);

    // Try to find a parseable resource (CSV or JSON)
    const dataResource = ckanData.resources.find(
      r => r.format.toUpperCase() === 'CSV' || r.format.toUpperCase() === 'JSON',
    );

    if (dataResource) {
      try {
        const resp = await httpGet(dataResource.url, {
          headers: { Accept: 'text/csv,application/json' },
          timeoutMs: 30_000,
        });
        if (resp.statusCode < 400) {
          const body = resp.body;
          if (dataResource.format.toUpperCase() === 'CSV') {
            const lines = body.split('\n').filter((l: string) => l.trim());
            if (lines.length > 1) {
              const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
              for (let i = 1; i < lines.length && claims.length < limit; i++) {
                const fields = parseCsvLine(lines[i]);
                if (fields.length < headers.length) continue;
                const row: Record<string, string> = {};
                headers.forEach((h, idx) => { row[h] = fields[idx]?.trim() ?? ''; });
                const raw = {
                  claimant: row['claimant'] || row['first_nation'] || row['group_name'] || '',
                  provinceTerritory: row['province'] || row['territory'] || '',
                  claimType: row['type'] || 'specific',
                  description: row['description'] || row['notes'] || '',
                  status: row['status'] || 'Active',
                  submissionDate: row['submission_date'] || row['date_filed'] || undefined,
                  settlementDate: row['settlement_date'] || undefined,
                  settlementAmount: (parseFloat(row['settlement_amount'] || row['amount'] || '0') || null) === null ? undefined : parseFloat(row['settlement_amount'] || row['amount'] || '0'),
                  negotiationStage: row['stage'] || row['phase'] || undefined,
                  ckanDatasetId: CIRNAC_DATASETS.SPECIFIC_CLAIMS.id,
                  sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.SPECIFIC_CLAIMS.id}`,
                };
                if (raw.claimant) {
                  const claim = parseLandClaim(raw);
                  claim.id = await computeLandClaimId(claim);
                  claims.push(claim);
                }
              }
            }
          }
        }
      } catch {
        console.warn('[CIRNAC] Failed to parse resource, falling back to meta-record');
      }
    }

    // Fallback: create a single meta-record from CKAN metadata
    if (claims.length === 0) {
      const raw = {
        claimant: ckanData.title,
        provinceTerritory: '',
        claimType: 'specific' as const,
        description: `CIRNAC specific claims dataset: ${ckanData.title} — ${ckanData.resources.length} resources`,
        status: 'Active',
        submissionDate: undefined,
        settlementDate: undefined,
        settlementAmount: undefined,
        negotiationStage: 'Data source registered',
        ckanDatasetId: CIRNAC_DATASETS.SPECIFIC_CLAIMS.id,
        sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.SPECIFIC_CLAIMS.id}`,
      };
      const claim = parseLandClaim(raw);
      claim.id = await computeLandClaimId(claim);
      claims.push(claim);
    }

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
 * Fetch CIRNAC self-government agreement data from CKAN dataset resources.
 *
 * Downloads resource CSVs/JSON from the CIRNAC CKAN dataset, parses them,
 * and returns structured SelfGovernmentAgreement records. Falls back
 * to a meta-record when no structured data resources are available.
 */
export async function fetchSelfGovernmentAgreements(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<SelfGovernmentAgreement[]> {
  const agreements: SelfGovernmentAgreement[] = [];
  const now = new Date().toISOString();

  try {
    const ckanData = await fetchCirnacCkanDataset(CIRNAC_DATASETS.SELF_GOVERNMENT.id);

    // Try to find a parseable resource (CSV or JSON)
    const dataResource = ckanData.resources.find(
      r => r.format.toUpperCase() === 'CSV' || r.format.toUpperCase() === 'JSON',
    );

    if (dataResource) {
      try {
        const resp = await httpGet(dataResource.url, {
          headers: { Accept: 'text/csv,application/json' },
          timeoutMs: 30_000,
        });
        if (resp.statusCode < 400) {
          const body = resp.body;
          if (dataResource.format.toUpperCase() === 'CSV') {
            const lines = body.split('\n').filter((l: string) => l.trim());
            if (lines.length > 1) {
              const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
              for (let i = 1; i < lines.length && agreements.length < limit; i++) {
                const fields = parseCsvLine(lines[i]);
                if (fields.length < headers.length) continue;
                const row: Record<string, string> = {};
                headers.forEach((h, idx) => { row[h] = fields[idx]?.trim() ?? ''; });
                const indigenousGroup = row['indigenous_group'] || row['first_nation'] || row['group_name'] || '';
                if (!indigenousGroup) continue;
                const content = `self-gov|${indigenousGroup}|${row['date'] || row['signing_date'] || ''}|${row['stage'] || ''}`;
                agreements.push({
                  id: await computeHash(content, 'sha256'),
                  indigenousGroup,
                  provinceTerritory: row['province'] || row['territory'] || '',
                  stage: row['stage'] || 'Registered',
                  agreementType: row['type'] || 'Self-Government',
                  signingDate: row['signing_date'] || row['date'] || null,
                  effectiveDate: row['effective_date'] || null,
                  keyProvisions: row['provisions'] || row['description'] || '',
                  jurisdictionAreas: row['jurisdiction'] ? row['jurisdiction'].split(';').map((s: string) => s.trim()) : [],
                  isCirnacLed: (row['lead'] || '').toLowerCase() !== 'indigenous',
                  sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.SELF_GOVERNMENT.id}`,
                  ingestedAt: now,
                });
              }
            }
          }
        }
      } catch {
        console.warn('[CIRNAC] Failed to parse self-government resource, falling back to meta-record');
      }
    }

    // Fallback: create a single meta-record from CKAN metadata
    if (agreements.length === 0) {
      const content = `self-gov-meta|${ckanData.id}|${ckanData.title}`;
      agreements.push({
        id: await computeHash(content, 'sha256'),
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
    }

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
