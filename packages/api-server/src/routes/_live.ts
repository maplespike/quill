/**
 * Quill — Live Pipeline Helper
 *
 * Wires any REST endpoint to a live pipeline-core ingestion call.
 *
 * The unified envelope shape returned to every domain endpoint is:
 *
 * {
 *   records: Array<{
 *     ...upstreamShape,
 *     provenance: {
 *       source_url: string,
 *       fetched_at: ISO timestamp,
 *       citation_hash: full SHA-256 (64 hex chars, "sha256:<64hex>"),
 *       license: publisher-declared terms or an explicit no-declaration notice
 *     }
 *   }>,
 *   provenance: {
 *     status: 'live' | 'partial' | 'unavailable',
 *     freshness_seconds: time since upstream fetch began,
 *     source_count: distinct upstream sources attempted,
 *     fetched_at: ISO timestamp,
 *     errors: string[]
 *   },
 *   filters: { category?, sector?, city?, dataset?, regulator?, institution?, limit }
 * }
 *
 * Behaviour:
 *   - Caches hits in the in-process MemoryCache (5 min default) so two parallel
 *     consumers /v1/energy do not double CKAN / CER traffic.
 *   - Each fetch gets a 15s absolute ceiling — slow upstream -> 'partial' or
 *     'unavailable' instead of a 504 to the caller.
 *   - On sub-source error (one of N regulators), status becomes 'partial'
 *     instead of 'unavailable' so callers can still act on the survivors.
 *   - Per-record citation hash format matches /v1/citation/<hash> validation
 *     (full 64-hex SHA-256, prefixed with "sha256:") so a record that has one can
 *     be looked up directly without re-hashing.
 *   - Cross-reference BankingLobbyingReport surfaces its full meta block
 *     (institutionsScanned, matchedInstitutions, etc) on LiveResult.metadata
 *     so route handlers can read it without having to wrap/manipulate shapes.
 */

import { createHash } from 'node:crypto';
import { globalCache } from '../cache.js';
import type { BuildContext } from '../response.js';
import {
  NO_REUSE_LICENSE_NOTICE,
  resolvePublisherLicense,
  type LicenseMetadataBasis,
} from '@maplespike/pipeline-core';

export const NO_SOURCE_LICENSE_DECLARATION = NO_REUSE_LICENSE_NOTICE;

/** Hash used internally for MemoryCache LRU eviction — keeps keys bounded. */
export function hashQueryString(query: string): string {
  return createHash('sha1').update(query).digest('hex').slice(0, 16);
}

/** Per-record provenance block attached to every record returned to clients. */
export interface RecordProvenance {
  source_url: string;
  fetched_at: string;
  /** Full 64-hex SHA-256, prefix "sha256:" — matches /v1/citation endpoint validation. */
  citation_hash: string;
  license: string;
  license_url?: string;
  license_basis?: LicenseMetadataBasis;
  attribution_text?: string;
  /**
   * Optional cache markers — only set on records served from the persistent
   * municipal_records_cache fallback (added by gap-7). Stale CacheEntries
   * always carry `fetched_at` matching the ORIGINAL upstream fetch timestamp,
   * not the current-request timestamp, so consumers can compute real age.
   */
  from_cache?: boolean;
  cache_age_seconds?: number;
  /**
   * Bilingual source-organization labels (added gap-9, Official Languages Act parity).
   * `source_organization_en` is the English name of the originating publisher;
   * `source_organization_fr` is the official French form (where different).
   * `jurisdiction_*` mirrors the same logic for jurisdictional classification.
   * `jurisdiction_preferred` is the resolved-by-?lang= form for current consumer locale.
   * All fields are optional and additive — older clients that only read the
   * legacy fields are unaffected.
   */
  source_organization_en?: string;
  source_organization_fr?: string;
  jurisdiction_en?: string;
  jurisdiction_fr?: string;
  jurisdiction_preferred?: string;
}

/** Aggregate provenance block returned once per response. */
export interface AggregateProvenance {
  status: 'live' | 'partial' | 'unavailable' | 'cached';
  freshness_seconds: number;
  source_count: number;
  fetched_at: string;
  errors: string[];
  /**
   * Optional per-bucket job splits — only returned by routes that emit
   * multi-source results (e.g. /v1/municipal which mixes CKAN + Socrata
   * + cache between calls). Single-source endpoints may omit these.
   */
  live_jobs?: number;
  cached_jobs?: number;
  failed_jobs?: number;
}

/** Shape of any ingestion module's per-source result. */
export interface IngestionResultLike {
  source: string;
  records?: Array<{ url?: string; [key: string]: unknown }>;
  recordsFound?: number;
  errors?: string[];
}

/** Cross-reference meta block — surfaced unchanged from BankingLobbyingReport. */
export interface CrossReferenceMeta {
  [field: string]: unknown;
}

/** Shape returned by the helper to route handlers. */
export interface LiveResult<TRecord = Record<string, unknown>> {
  records: Array<TRecord & { provenance: RecordProvenance }>;
  provenance: AggregateProvenance;
  /**
   * Non-record metadata that the route may need to surface alongside records.
   * Only populated when the ingest function returns a meta-bearing shape
   * (e.g. crossReferenceBankingLobbying's BankingLobbyingReport).
   */
  metadata: CrossReferenceMeta;
}

/** Normalise strings for filter matching: lowercase + strip non-alphanumeric. */
export function normalizeFilterString(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface RunLiveOptions {
  /** TTL for the in-process cache, seconds. Default 300 (5 min). */
  ttlSeconds?: number;
  /** Hard ceiling below which slow upstreams fail into partial / unavailable. Default 15 s. */
  timeoutMs?: number;
  /** Source-specific license label from Quill configuration, not publisher metadata. */
  license?: string;
  /** Publisher or source-configuration terms URL, when available. */
  licenseUrl?: string;
}

/**
 * Invoke a pipeline-core ingest function, wrap it in cache + timeout + envelope.
 *
 * The fetcher is expected to return one of:
 *   - `Record<string, IngestionResultLike>` (e.g. ingestAllEnergy / RealEstate / Financial)
 *   - `Array<IngestionResultLike>`            (e.g. ingestAllMunicipal)
 *   - `BankingLobbyingReport` (crossReferenceBankingLobbying) — has `matches` not `records`,
 *        and meta fields (institutionsScanned, matchedInstitutions, …) flow into metadata.
 */
export async function runLivePipeline<TRecord extends { url?: string } = { url?: string }>(
  ctx: BuildContext,
  cacheKey: string,
  fetcher: () => Promise<unknown>,
  options: RunLiveOptions = {},
): Promise<LiveResult<TRecord>> {
  const ttl = options.ttlSeconds ?? 300;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const license = options.license ?? NO_SOURCE_LICENSE_DECLARATION;
  // `live-v2:` prefix invalidates any stale entries persisted in KV/Redis from
  // pre-rewrite builds. Bumping the namespace is cheaper than wiping caches.
  const cacheFullKey = `live-v2:${cacheKey}`;

  const cached = globalCache.get<LiveResult<TRecord>>(cacheFullKey);
  // Always init metaOverrides so cache status reliably reaches the response envelope
  // — without this the field silently stays un-set and clients see `miss` forever.
  ctx.metaOverrides = ctx.metaOverrides ?? {};
  if (cached) {
    ctx.metaOverrides.cacheStatus = 'hit';
    return cached;
  }
  ctx.metaOverrides.cacheStatus = 'miss';

  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();

  let rawResult: unknown;
  let timeoutError: Error | null = null;

  try {
    rawResult = await Promise.race<Promise<unknown>>([
      fetcher(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Live pipeline exceeded ${timeoutMs}ms ceiling`)), timeoutMs),
      ),
    ]);
  } catch (err) {
    timeoutError = err instanceof Error ? err : new Error(String(err));
  }

  if (timeoutError) {
    const unavailable: LiveResult<TRecord> = {
      records: [],
      provenance: {
        status: 'unavailable',
        freshness_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        source_count: 0,
        fetched_at: fetchedAt,
        errors: [timeoutError.message],
      },
      metadata: {},
    };
    // Don't cache 'unavailable' — let the next request try again right away.
    return unavailable;
  }

  // Normalise rawResult into an array of IngestionResultLike + optional metadata.
  // Two ingest shapes plus a cross-reference shape:
  //   1. Record<string, IngestionResultLike>     (energy / real-estate / financial-regulation)
  //   2. Array<IngestionResultLike>              (municipal)
  //   3. BankingLobbyingReport                    (cross-reference — has `matches`, not `records`)
  const perSource: Array<IngestionResultLike & { key: string }> = [];
  let metadata: CrossReferenceMeta = {};

  if (Array.isArray(rawResult)) {
    rawResult.forEach((r, i) =>
      perSource.push({ ...(r as IngestionResultLike), key: r.source ?? `municipal-${i}` }),
    );
  } else if (rawResult && typeof rawResult === 'object') {
    const obj = rawResult as Record<string, unknown>;
    // Cross-reference shape — directly BankingLobbyingReport, has `matches` not `records`.
    if (Array.isArray(obj.matches) && !Array.isArray(obj.records)) {
      const matches = obj.matches as Array<{ url?: string }>;
      const errors = Array.isArray(obj.errors) ? (obj.errors as string[]) : [];
      // Surface ALL meta fields the cross-reference report carries (institutionsScanned,
      // matchedInstitutions, complaintsOnly, lobbyingOnly, generatedAt) into metadata —
      // never return fabricated zeros like before.
      metadata = { ...obj, matches: undefined, errors: undefined };
      perSource.push({
        source: 'cross-reference',
        records: matches,
        recordsFound: matches.length,
        errors,
        key: 'cross-reference',
      });
    } else {
      // ingestAllEnergy / RealEstate / FinancialRegulation shape: Record<string, IngestionResultLike>
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          perSource.push({ ...(value as IngestionResultLike), key });
        } else if (Array.isArray(value)) {
          // { xref: [match1, match2] } defensive — treat array value as record list.
          perSource.push({
            source: key,
            records: value as Array<{ url?: string }>,
            recordsFound: value.length,
            errors: [],
            key,
          });
        } else {
          perSource.push({ source: key, records: [], recordsFound: 0, errors: [], key });
        }
      }
    }
  }

  const errors: string[] = [];
  let liveSources = 0;
  let failedSources = 0;
  const allRecords: Array<TRecord & { provenance: RecordProvenance }> = [];

  for (const src of perSource) {
    if (src.errors && src.errors.length > 0) {
      failedSources++;
      errors.push(...src.errors.map((e) => `[${src.key}] ${e}`));
    } else {
      liveSources++;
    }
    if (src.records && Array.isArray(src.records)) {
      for (const raw of src.records) {
        const source_url = raw.url ?? 'https://open.canada.ca';
        const citation_payload = JSON.stringify({ source: src.key, ...raw });
        // Full 64-hex SHA-256 (no truncation) — matches /v1/citation validation regex.
        const citation_hash = `sha256:${createHash('sha256').update(citation_payload).digest('hex')}`;
        const sourceRecord = raw as TRecord & Record<string, unknown>;
        const declared = resolvePublisherLicense(sourceRecord);
        const hasConfiguredLicense = options.license !== undefined;
        const sourceLicense = declared.basis === 'publisher-metadata'
          ? declared.license
          : (hasConfiguredLicense ? license : declared.license);
        const licenseUrl = declared.licenseUrl ?? options.licenseUrl;
        const licenseBasis: LicenseMetadataBasis = declared.basis === 'publisher-metadata'
          ? 'publisher-metadata'
          : (hasConfiguredLicense ? 'source-configuration' : 'no-publisher-declaration');
        const attributionText = declared.basis === 'publisher-metadata'
          ? declared.attributionText
          : (hasConfiguredLicense
            ? `License information supplied by Quill source configuration${options.licenseUrl ? ` (${options.licenseUrl})` : ''}; confirm scope and conditions with the publisher.`
            : declared.attributionText);
        allRecords.push({
          ...sourceRecord,
          provenance: {
            source_url,
            fetched_at: fetchedAt,
            citation_hash,
            license: sourceLicense,
            ...(licenseUrl ? { license_url: licenseUrl } : {}),
            license_basis: licenseBasis,
            attribution_text: attributionText,
          },
        });
      }
    }
  }

  const liveResult: LiveResult<TRecord> = {
    records: allRecords,
    provenance: {
      status:
        failedSources === 0
          ? 'live'
          : liveSources === 0
            ? 'unavailable'
            : 'partial',
      // Tenths-of-seconds precision — `Math.floor(seconds)` would round to 0
      // for any sub-second fetch (most CKAN hits are well under 1 s).
      freshness_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
      source_count: perSource.length,
      fetched_at: fetchedAt,
      errors,
    },
    metadata,
  };

  // Note: the 'unavailable' path returns earlier with its own precision-corrected
  // freshness_seconds — no second recompute needed here.

  // Cache 'live' and 'partial' (record-shaped) responses; skip cache for 'unavailable'.
  if (liveResult.provenance.status !== 'unavailable') {
    globalCache.set(cacheFullKey, liveResult, ttl);
  }

  return liveResult;
}
