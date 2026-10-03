/**
 * Quill — GET /v1/municipal
 * Quill — GET /v1/municipal/<city>
 *
 * Live municipal open data ingestion via pipeline-core. Each major Canadian
 * municipality has live CKAN / Socrata portals in pipeline-core; this route
 * delegates to ingestMunicipalDataset() and serves the unified envelope.
 *
 * muncipalDataHandler (GET /v1/municipal):
 *   - Filters the MUNICIPAL_PORTALS registry FIRST by city/dataset/province
 *   - Then issues N targeted fetchMunicipalDataset() calls (only for matches)
 *   - Bounded by MAX_JOBS so the runLivePipeline 25s ceiling is reliably hit.
 *
 * municipalCityHandler (GET /v1/municipal/<city>):
 *   - Single-city live fetch (matches user-specified URL semantics).
 *
 * Performance contract:
 *   - On first request for a city, the route runs a pre-flight discovery
 *     pass that populates pipeline-core's per-process idCache so subsequent
 *     package_show fetches hit the fast path (no 404 → search round-trip).
 *   - 4-wave concurrency × 6s per-job × MAX_JOBS ceiling fits in the 25s
 *     runLivePipeline window. After the first call, fetches are ~1s each
 *     and the runLivePipeline 5-min cache serves repeat callers instantly.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import {
  ingestMunicipalDataset,
  MUNICIPAL_PORTALS,
  resolveCkanPackageId,
  resolveSocrataDatasetId,
} from '@maplespike/pipeline-core/municipal';
import {
  type RecordProvenance,
  type AggregateProvenance,
  normalizeFilterString,
  NO_SOURCE_LICENSE_DECLARATION,
} from './_live.js';
import { buildBilingualError } from '../error-codes.js';
import { globalCache } from '../cache.js';
import { createHash } from 'node:crypto';
import type { MunicipalRecord, MunicipalIngestionResult } from '@maplespike/pipeline-core';
import {
  saveMunicipalRecordCache,
  loadMunicipalRecordCache,
  loadMunicipalRecordCoverage,
} from '../cache/municipal.js';

/**
 * Build the standard bilingual 400 response for an unsupported `?lang=` value.
 * Reused by both municipalFacetsHandler and municipalSearchHandler, and aligned
 * with the buildBilingualError() shape from error-codes.ts so client code can
 * use a single parser.
 */
function langValidationError(received: string | null): Response {
  const base = buildBilingualError('VALIDATION_ERROR', {
    en: 'Unsupported `lang` value. Use one of: en, fr.',
    fr: 'Valeur `lang` non prise en charge. Utilisez : en, fr.',
  });
  return new Response(
    JSON.stringify({
      error: base.code,
      code: base.code,
      en: base.en,
      fr: base.fr,
      received,
      supported: SUPPORTED_LOCALES,
    }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  );
}

export interface UnifiedMunicipalRecord {
  id: string;
  municipality: string;
  municipalityId: string;
  province?: string;
  dataset: string;
  title: string;
  url: string;
  format?: string;
  lastModified?: string | null;
  created?: string | null;
  portalType?: string;
  provenance: RecordProvenance;
}

interface PerPortalJob {
  cityId: string;
  cityName: string;
  province: string;
  dataset: string;
  baseUrl: string;
  portalType: string;
}

/**
 * Extends pipeline-core's MunicipalIngestionResult with cache provenance so
 * `buildEnvelope` can distinguish live vs cached vs fresh-failed outcomes
 * and surface a meaningful `provenance.status` to the caller.
 */
interface CityJobOutcome extends MunicipalIngestionResult {
  /** True when this result was substituted from the persistent cache after upstream failed. */
  fromCache?: boolean;
  /** Age of the cached payload in seconds — surfaced via provenance metadata. */
  cachedAgeSeconds?: number;
  /** Original `succeeded_at` ISO timestamp of the cached payload. */
  cachedSucceededAt?: string;
  /**
   * Human-readable notice surfaced in the aggregate provenance when this job
   * was served from cache. KEPT OUT of `errors[]` so consumers can use a
   * simple boolean test (`result.errors.length > 0`) to mean "fetch failed"
   * without conflating "fail-then-fallback" with "primary failure".
   */
  cacheNote?: string;
}

/**
 * Jobs cap for unfiltered / province-filtered queries that yield many matches
 * across cities. With pre-warmed idCache, each fetch is ~1s and 12 jobs at
 * concurrency 4 finish in ~3s wall-clock — well inside the 25s ceiling.
 *
 * City-filtered (e.g. `/v1/municipal/toronto`) and dataset-filtered queries
 * are bounded by their own dataset counts (≤5 datasets/city) so MAX_JOBS
 * rarely trims them.
 *
 * Tunable via `QUILL_MUNICIPAL_MAX_JOBS` env var (default 12, max 50).
 * Operators raise this once the upstream CKAN/Socrata portals are Cloudflare-
 * allowlisted and 4-concurrency fetches reliably finish in <1s each.
 */
function readMaxJobs(): number {
  const raw = process.env.QUILL_MUNICIPAL_MAX_JOBS ?? '12';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(50, n));
}
const MAX_JOBS = readMaxJobs();

function selectPortals(
  city?: string | null,
  dataset?: string | null,
  province?: string | null,
): PerPortalJob[] {
  const jobs: PerPortalJob[] = [];
  const wantCity = city ? normalizeFilterString(city) : null;
  const wantSet = dataset ? normalizeFilterString(dataset) : null;
  const wantProvince = province ? province.toLowerCase() : null;

  for (const [cityId, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    if (wantCity && normalizeFilterString(cityId) !== wantCity) continue;
    if (wantProvince && portal.province.toLowerCase() !== wantProvince) continue;
    for (const ds of portal.datasets) {
      if (wantSet && normalizeFilterString(ds) !== wantSet) continue;
      jobs.push({
        cityId,
        cityName: portal.name,
        province: portal.province,
        dataset: ds,
        baseUrl: portal.baseUrl,
        portalType: portal.portalType,
      });
      if (jobs.length >= MAX_JOBS) return jobs;
    }
  }
  return jobs;
}

/**
 * Pre-flight: warm pipeline-core's per-process portal-id cache so subsequent
 * fetches skip the 404 → discovery round-trip. Dedupes by `{baseUrl, dataset}`
 * so worst-case call count barely grows with job count.
 *
 * CKAN portals call resolveCkanPackageId; Socrata portals call
 * resolveSocrataDatasetId. Both resolvers internally memoize Promises,
 * so concurrent pre-flight calls for the same key share a single upstream
 * request (no duplicate traffic).
 *
 * ArcGIS and custom portals skip discovery (their URL shape is fixed).
 */
async function prewarmIdCache(jobs: PerPortalJob[]): Promise<void> {
  const ckanKeys = new Map<string, { baseUrl: string; dataset: string }>();
  const socrataKeys = new Map<string, { baseUrl: string; dataset: string }>();
  for (const job of jobs) {
    const key = `${job.baseUrl}|${job.dataset}`;
    if (job.portalType === 'ckan') {
      if (!ckanKeys.has(key)) ckanKeys.set(key, { baseUrl: job.baseUrl, dataset: job.dataset });
    } else if (job.portalType === 'socrata') {
      if (!socrataKeys.has(key)) socrataKeys.set(key, { baseUrl: job.baseUrl, dataset: job.dataset });
    }
  }
  await Promise.allSettled([
    ...Array.from(ckanKeys.values()).map(({ baseUrl, dataset }) =>
      resolveCkanPackageId(baseUrl, dataset).catch(() => null),
    ),
    ...Array.from(socrataKeys.values()).map(({ baseUrl, dataset }) =>
      resolveSocrataDatasetId(baseUrl, dataset).catch(() => null),
    ),
  ]);
}

/**
 * Run matched portal x dataset jobs with bounded concurrency + per-job soft
 * timeout. Concurrency cap of 4 prevents 50-portal-Promise.all bursts from
 * triggering upstream CKAN 503s. The per-job timeout fires a synthetic
 * `errors: ["Job exceeded Nms per-portal ceiling"]` so callers see a clean
 * `status: 'partial'` envelope even when one city goes slow.
 *
 * ingestMunicipalDataset / fetchMunicipalDataset do not accept AbortSignal,
 * so the underlying HTTP fetch keeps running detached after the timeout
 * fires — the response body is what the caller sees. Threading AbortSignal
 * through pipeline-core's API surface is a larger change scoped separately.
 *
 * CACHE-FALLBACK STRATEGY:
 *   For each job:
 *     1. Run upstream fetch with the per-job timeout.
 *     2. If it succeeds (records.length > 0, errors empty) → persist to
 *        the SQLite `municipal_records_cache` table (upsert).
 *     3. If it fails (errors.length > 0 OR records empty) → try loading
 *        the most-recent successful fetch from the cache. If present,
 *        return the cached records with fromCache=true so `buildEnvelope`
 *        can surface `provenance.status: 'cached'` plus freshness metadata.
 *
 *   This lets blocked cities (Cloudflare 403) serve data while upstream
 *   is evasive — the API never returns `unavailable` for a (city, dataset)
 *   we've ever polled successfully.
 */
async function ingestMatchedPortals(
  jobs: PerPortalJob[],
  perJobTimeoutMs: number,
): Promise<CityJobOutcome[]> {
  // Pre-warm id cache so the fetches below hit cached UUIDs (fast path)
  // instead of each cold-paying the 404 → search → refetch triple round-trip.
  await prewarmIdCache(jobs);

  const MAX_CONCURRENCY = 4;
  const results: CityJobOutcome[] = [];

  for (let i = 0; i < jobs.length; i += MAX_CONCURRENCY) {
    const slice = jobs.slice(i, i + MAX_CONCURRENCY);
    const settled = await Promise.all(
      slice.map(async (job): Promise<CityJobOutcome> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<MunicipalIngestionResult>((resolve) => {
          timer = setTimeout(() => resolve({
            records: [],
            municipality: job.cityName,
            source: job.baseUrl,
            totalFetched: 0,
            errors: [`Job exceeded ${perJobTimeoutMs}ms per-portal ceiling`],
            durationMs: perJobTimeoutMs,
          }), perJobTimeoutMs);
        });
        const jobPromise = ingestMunicipalDataset(job.cityId, job.dataset)
          .catch((err): MunicipalIngestionResult => ({
            records: [],
            municipality: job.cityName,
            source: job.baseUrl,
            totalFetched: 0,
            errors: [err instanceof Error ? err.message : String(err)],
            durationMs: perJobTimeoutMs,
          }));
        const liveResult = await Promise.race<MunicipalIngestionResult>([jobPromise, timeoutPromise]);
        clearTimeout(timer);

        // Cache-write on success
        if (liveResult.errors.length === 0 && liveResult.records.length > 0) {
          saveMunicipalRecordCache(
            job.cityId,
            job.dataset,
            job.baseUrl,
            // MunicipalRecord lacks an index signature so a direct cast to
            // Record<string, unknown> triggers TS2352. `unknown` is the safe
            // adapter — JSON round-trip preserves the property union.
            liveResult.records as unknown as Array<Record<string, unknown>>,
          );
          return liveResult;
        }

        // Cache-read fallback on failure
        const cached = loadMunicipalRecordCache(job.cityId, job.dataset);
        if (cached) {
          const ageSec = Math.round((Date.now() - new Date(cached.succeededAt).getTime()) / 1000);
          // Cache hit is NOT a fetch failure — surface the upstream error
          // notes preserved on `liveResult.errors` so operators can debug,
          // but don't pretend the request overall failed. The synthetic
          // "served from cache" message lives on a dedicated `cache_note`
          // field, kept separate from the boolean `fromCache` flag so
          // the public contract stays clean.
          //
          // The `as unknown as MunicipalRecord[]` cast is required because
          // MunicipalRecord has a concrete shape while cached records were
          // serialised through `Record<string, unknown>` — TS forbids
          // direct casting and the JSON round-trip preserves the union
          // semantics, so `unknown` is the safe adapter.
          return {
            ...liveResult,
            records: cached.records as unknown as MunicipalRecord[],
            totalFetched: cached.recordCount,
            fromCache: true,
            cachedAgeSeconds: ageSec,
            cachedSucceededAt: cached.succeededAt,
            cacheNote: `[served from cache: last successful fetch ${cached.succeededAt} (${ageSec}s ago)]`,
          };
        }

        return liveResult;
      }),
    );
    results.push(...settled);

    // Tiny jitter between waves to avoid lockstep bursts to upstream CKANs.
    if (i + MAX_CONCURRENCY < jobs.length) {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  return results;
}

/**
 * Thin cache + timeout wrapper for municipal routes.
 *
 * `runLivePipeline` in `_live.ts` rebuilds the response envelope from per-
 * source records (re-stamping `provenance.fetched_at` to the current request
 * timestamp, regenerating `citation_hash`, and overwriting the aggregate
 * provenance with its own `status` field). For municipal specifically that
 * silently strips:
 *   - per-record `from_cache: true` + `cache_age_seconds`
 *   - aggregate `cache_notes: string[]`
 *   - aggregate `live_jobs` / `cached_jobs` / `failed_jobs` breakdown
 *   - aggregate `status: 'cached'`
 *   - the ORIGINAL `fetched_at` on cached records (replaced with current
 *     request time, defeating the freshness-stamping we worked hard for)
 *
 * So municipal gets its own wrapper that does ONLY what we need:
 *   1. In-process LRU cache, keyed `muni-v1:<cacheKey>` so any envelope-shape
 *      change in the future can invalidate via a prefix bump.
 *   2. Hard timeout ceiling identical to runLivePipeline's contract.
 *   3. `ctx.metaOverrides.cacheStatus = 'hit' | 'miss'` so the response
 *      envelope reports cache health to the client.
 *   4. NO record/provenance re-stamping — what the fetcher returns is what
 *      the caller sees.
 */
async function runMunicipalPipeline<TResponse>(
  ctx: { metaOverrides?: Record<string, unknown> },
  cacheKey: string,
  fetcher: () => Promise<TResponse>,
  options: { ttlSeconds?: number; timeoutMs?: number } = {},
): Promise<TResponse> {
  const ttl = options.ttlSeconds ?? 600;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const fullKey = `muni-v1:${cacheKey}`;
  ctx.metaOverrides = ctx.metaOverrides ?? {};
  const cached = globalCache.get<TResponse>(fullKey);
  if (cached) {
    ctx.metaOverrides.cacheStatus = 'hit';
    return cached;
  }
  ctx.metaOverrides.cacheStatus = 'miss';

  try {
    const result = await Promise.race<TResponse>([
      fetcher(),
      new Promise<TResponse>((_, reject) =>
        setTimeout(
          () => reject(new Error(`municipal pipeline exceeded ${timeoutMs}ms ceiling`)),
          timeoutMs,
        ),
      ),
    ]);
    // Only memoize successful envelopes. Failures (status='unavailable' or
    // 'partial') would otherwise pre-empt retries — if step-6 fetcher failed
    // for Toronto but the persistent SQLite cache later gained entries, step-8
    // would return step-6's stale failure from the in-process LRU. Evicting
    // any stale success + skipping the failure write lets the next request
    // re-consult both layers. Status check is duck-typed because TResponse
    // is generic; the municipal envelope always carries a top-level `status`.
    const resolved = result as unknown as { status?: string };
    const isSuccess =
      resolved?.status === 'live' || resolved?.status === 'cached';
    if (isSuccess) {
      globalCache.set(fullKey, result, ttl);
    } else {
      globalCache.delete(fullKey);
    }
    return result;
  } catch (err) {
    // Re-throw so callers can surface upstream errors. Don't cache failures
    // — next request gets a fresh attempt. Also evict any stale success
    // cached for this key.
    globalCache.delete(fullKey);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function buildEnvelope(
  results: CityJobOutcome[],
  fetchedAt: string,
  durationMs: number,
): { records: UnifiedMunicipalRecord[]; provenance: AggregateProvenance } {
  const errors: string[] = [];
  const cacheNotes: string[] = [];
  let liveSuccess = 0;
  let cachedSuccess = 0;
  let failed = 0;
  const records: UnifiedMunicipalRecord[] = [];

  for (const r of results) {
    if (r.fromCache && r.cacheNote) cacheNotes.push(r.cacheNote);
    if (r.fromCache) {
      cachedSuccess++;
    } else if (r.records && r.records.length > 0) {
      // Partial success: live fetch returned SOME records but also logged
      // errors (e.g. 1 of 3 sub-requests succeeded). Count as liveSuccess so
      // the live records contribute to the totals, and surface any errors
      // so operators can see the partial-failure story. Boosts overall
      // `status` resolution toward 'partial' rather than 'unavailable'.
      liveSuccess++;
      if (r.errors && r.errors.length > 0) {
        errors.push(...r.errors.map((e) => `[${r.municipality}] ${e}`));
      }
    } else if (r.errors && r.errors.length > 0) {
      failed++;
      errors.push(...r.errors.map((e) => `[${r.municipality}] ${e}`));
    } else {
      liveSuccess++;
    }
    for (const rec of r.records ?? []) {
      // Full 64-hex SHA-256 of `{source, ...record}` content — matches
      // `/v1/citation/<hash>` validator `/^[a-f0-9]{64}$/i` after strip.
      const citation_payload = JSON.stringify({ source: r.source, ...rec });
      const citation_hash = `sha256:${createHash('sha256')
        .update(citation_payload)
        .digest('hex')}`;
      // Cached records stamp their ORIGINAL fetched_at — not the current
      // request timestamp — so consumers can read freshness honestly.
      const recordFetchedAt = r.fromCache && r.cachedSucceededAt
        ? r.cachedSucceededAt
        : fetchedAt;
      const baseProvenance: RecordProvenance = {
        source_url: rec.url ?? r.source,
        fetched_at: recordFetchedAt,
        citation_hash,
        license: rec.license ?? NO_SOURCE_LICENSE_DECLARATION,
        ...(rec.licenseUrl ? { license_url: rec.licenseUrl } : {}),
        license_basis: rec.licenseBasis ?? 'no-publisher-declaration',
        ...(rec.attributionText ? { attribution_text: rec.attributionText } : {}),
      };
      // Extend with cache markers when applicable. Optional RecordProvenance
      // extension fields are documented in `_live.ts`.
      records.push({
        ...(rec as MunicipalRecord),
        municipality: r.municipality || rec.municipality || rec.municipalityId,
        provenance: {
          ...baseProvenance,
          ...(r.fromCache
            ? {
                from_cache: true,
                cache_age_seconds: r.cachedAgeSeconds ?? 0,
              }
            : {}),
        } as RecordProvenance,
      });
    }
  }

  // Status resolution:
  //   - All jobs succeeded live → 'live'
  //   - All jobs failed (no cache hit) → 'unavailable'
  //   - All successful jobs came from cache (no live fetches) → 'cached'
  //   - Mixed live + cache + failures → 'partial'
  const status: AggregateProvenance['status'] =
    failed === 0 && cachedSuccess === 0
      ? 'live'
      : liveSuccess === 0 && cachedSuccess === 0
        ? 'unavailable'
        : liveSuccess === 0 && failed === 0
          ? 'cached'
          : 'partial';

  return {
    records,
    provenance: {
      status,
      freshness_seconds: Math.round(durationMs / 100) / 10,
      source_count: results.length,
      fetched_at: fetchedAt,
      errors,
      // Top-level cache breakdown + per-job notes so consumers can read the
      // split without walking per-record provenance blocks.
      ...(cacheNotes.length > 0
        ? { cache_notes: cacheNotes }
        : {}),
      ...(liveSuccess + cachedSuccess + failed > 0
        ? {
            live_jobs: liveSuccess,
            cached_jobs: cachedSuccess,
            failed_jobs: failed,
          }
        : {}),
    } as AggregateProvenance,
  };
}

export const municipalDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const city = url.searchParams.get('city');
  const dataset = url.searchParams.get('dataset');
  const province = url.searchParams.get('province');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  const jobs = selectPortals(city, dataset, province);

  const cacheKey = `municipal:${url.searchParams.toString() || 'all'}`;

  const envelope = await runMunicipalPipeline(ctx, cacheKey, async () => {
    const startedAt = Date.now();
    const fetchedAt = new Date().toISOString();
    const results = await ingestMatchedPortals(jobs, 10_000);
    return buildEnvelope(results, fetchedAt, Date.now() - startedAt);
  }, { ttlSeconds: 600, timeoutMs: 25_000 });

  const records = envelope.records.slice(0, limit);

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal',
        records,
        provenance: envelope.provenance,
        filters: {
          city: city || null,
          dataset: dataset || null,
          province: province || null,
          limit,
        },
      },
      ctx,
    ),
  );
};

export const municipalCityHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const city = (pathParts[3] || '').toLowerCase();
  const dataset = url.searchParams.get('dataset') || undefined;

  if (!city) {
    return jsonResponse(
      buildSuccess(
        {
          domain: 'municipal',
          city: null,
          records: [],
          provenance: {
            status: 'unavailable',
            freshness_seconds: 0,
            source_count: 0,
            fetched_at: new Date().toISOString(),
            errors: ['City parameter required'],
          },
        },
        ctx,
      ),
    );
  }

  const cacheKey = `municipal:city:${city}:${dataset ?? '_all'}`;

  const envelope = await runMunicipalPipeline(ctx, cacheKey, async () => {
    const startedAt = Date.now();
    const fetchedAt = new Date().toISOString();
    const jobs = selectPortals(city, dataset, null);
    const results = await ingestMatchedPortals(jobs, 12_000);
    return buildEnvelope(results, fetchedAt, Date.now() - startedAt);
  }, { ttlSeconds: 900, timeoutMs: 25_000 });

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal',
        city,
        records: envelope.records,
        provenance: envelope.provenance,
        filters: { city, dataset: dataset || null },
      },
      ctx,
    ),
  );
};

/**
 * GET /v1/municipal/coverage
 *
 * Self-service trust signal: lists every (city, dataset) currently in the
 * persistent municipal_records_cache table along with age-in-seconds and
 * aggregate record counts. Newest entries first so operators can spot
 * regressions visually.
 *
 * Optional ?city=<id> filter narrows the response to a single city.
 * Returns 200 with an empty `cities` array when no records have ever
 * succeeded — that's the honest answer rather than a 404.
 */
export const municipalCoverageHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const cityFilter = url.searchParams.get('city')?.toLowerCase() || null;

  const all = loadMunicipalRecordCoverage();
  const filtered = cityFilter ? all.filter((r) => r.cityId === cityFilter) : all;

  // Bucket rows by cityId so a single response object tells the operator
  // "Toronto: 4 datasets, 1234 records, freshest 2h ago, oldest 5d ago"
  // without forcing them to walk a flat array.
  interface CityBucket {
    cityId: string;
    datasets: Array<{ dataset: string; source: string; record_count: number; succeeded_at: string; age_seconds: number }>;
    freshest_age_seconds: number | null;
    oldest_age_seconds: number | null;
    total_records: number;
  }
  const byCity = new Map<string, CityBucket>();
  for (const row of filtered) {
    let bucket = byCity.get(row.cityId);
    if (!bucket) {
      bucket = {
        cityId: row.cityId,
        datasets: [],
        freshest_age_seconds: null,
        oldest_age_seconds: null,
        total_records: 0,
      };
      byCity.set(row.cityId, bucket);
    }
    bucket.datasets.push({
      dataset: row.dataset,
      source: row.source,
      record_count: row.recordCount,
      succeeded_at: row.succeededAt,
      age_seconds: row.ageSeconds,
    });
    bucket.total_records += row.recordCount;
    bucket.freshest_age_seconds = bucket.freshest_age_seconds === null
      ? row.ageSeconds
      : Math.min(bucket.freshest_age_seconds, row.ageSeconds);
    bucket.oldest_age_seconds = bucket.oldest_age_seconds === null
      ? row.ageSeconds
      : Math.max(bucket.oldest_age_seconds, row.ageSeconds);
  }

  const cities = Array.from(byCity.values()).sort((a, b) => a.cityId.localeCompare(b.cityId));

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal-coverage',
        filter: { city: cityFilter },
        cities,
        summary: {
          cities_with_cache: cities.length,
          total_cached_datasets: filtered.length,
          total_cached_records: filtered.reduce((s, r) => s + r.recordCount, 0),
          freshest_age_seconds: filtered.length ? Math.min(...filtered.map((r) => r.ageSeconds)) : null,
          oldest_age_seconds: filtered.length ? Math.max(...filtered.map((r) => r.ageSeconds)) : null,
        },
        fetched_at: new Date().toISOString(),
      },
      ctx,
    ),
  );
};

/* ============================================================================
 *  GET /v1/municipal/facets
 *  GET /v1/municipal/search
 *
 *  Faceted-search infrastructure for Canadian open data. Token-optimization
 *  (`_fields`, `_limit`, `_format`, `_summary`, `_normalize`) is applied by
 *  buildSuccess() in response.ts — these handlers just produce dense domain
 *  data and let the envelope builder do the trimming.
 *
 *  Canadian-specific taxonomy:
 *    - 13 provinces/territories, bilingual EN/FR labels
 *    - 4 jurisdictional levels: federal / provincial / territorial / municipal / indigenous
 *    - 4 portal types: ckan / socrata / arcgis / custom
 *    - 4 freshness buckets: fresh_1h / today / this_week / older
 *    - 8 sector buckets (derived from canonical dataset name to topic):
 *        finance, planning, transportation, public_safety, health,
 *        environment, indigenous, governance
 * ========================================================================== */

// ============================================================================
// Bilingual taxonomy — English/French display support for facet dimensions
// ----------------------------------------------------------------------------
// We surface label_en + label_fr side-by-side on facet objects and a derived
// `label_preferred` resolved by the ?lang= query option (default: en). This is
// a product localization choice; it does not assert a source-data license rule.
// ============================================================================

export type Locale = 'en' | 'fr';

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ['en', 'fr'] as const;

function resolveLocale(raw: string | null | undefined): Locale | 'invalid' {
  if (!raw) return 'en';
  const v = raw.trim().toLowerCase();
  if (v === 'en' || v === 'en-ca' || v === 'en-us') return 'en';
  if (v === 'fr' || v === 'fr-ca') return 'fr';
  return 'invalid';
}

/**
 * Per-locale label selector. Falls back to the EN label if the FR translation
 * is missing for a given dimension (authoritative Government of Canada
 * terminology is used wherever canonical FR strings exist).
 */
function labelFor(loc: Locale, en: string, fr: string): string {
  return loc === 'fr' && fr ? fr : en;
}

// Bilingual province/territory labels for English/French product localization.
export const PROVINCE_LABELS: Record<string, { en: string; fr: string; iso: string; jurisdiction: string }> = {
  AB: { en: 'Alberta',                       fr: 'Alberta',                    iso: 'CA-AB', jurisdiction: 'provincial'   },
  BC: { en: 'British Columbia',              fr: 'Colombie-Britannique',       iso: 'CA-BC', jurisdiction: 'provincial'   },
  MB: { en: 'Manitoba',                      fr: 'Manitoba',                   iso: 'CA-MB', jurisdiction: 'provincial'   },
  NB: { en: 'New Brunswick',                 fr: 'Nouveau-Brunswick',          iso: 'CA-NB', jurisdiction: 'provincial'   },
  NL: { en: 'Newfoundland and Labrador',     fr: 'Terre-Neuve-et-Labrador',    iso: 'CA-NL', jurisdiction: 'provincial'   },
  NS: { en: 'Nova Scotia',                   fr: 'Nouvelle-Écosse',            iso: 'CA-NS', jurisdiction: 'provincial'   },
  NT: { en: 'Northwest Territories',         fr: 'Territoires du Nord-Ouest',  iso: 'CA-NT', jurisdiction: 'territorial'  },
  NU: { en: 'Nunavut',                       fr: 'Nunavut',                    iso: 'CA-NU', jurisdiction: 'territorial'  },
  ON: { en: 'Ontario',                       fr: 'Ontario',                    iso: 'CA-ON', jurisdiction: 'provincial'   },
  PE: { en: 'Prince Edward Island',          fr: 'Île-du-Prince-Édouard',      iso: 'CA-PE', jurisdiction: 'provincial'   },
  QC: { en: 'Quebec',                        fr: 'Québec',                     iso: 'CA-QC', jurisdiction: 'provincial'   },
  SK: { en: 'Saskatchewan',                  fr: 'Saskatchewan',               iso: 'CA-SK', jurisdiction: 'provincial'   },
  YT: { en: 'Yukon',                         fr: 'Yukon',                      iso: 'CA-YT', jurisdiction: 'territorial'  },
};

// Sector classifications — derived from canonical dataset slugs. Authoritative
// Government of Canada sectoral terminology in both languages.
export const SECTOR_LABELS: Record<string, { en: string; fr: string }> = {
  finance:         { en: 'Finance',                              fr: 'Finances'                          },
  planning:        { en: 'Planning and Development',             fr: 'Urbanisme et aménagement'         },
  transportation:  { en: 'Transportation',                       fr: 'Transport'                         },
  public_safety:   { en: 'Public Safety',                        fr: 'Sécurité publique'                 },
  health:          { en: 'Health',                               fr: 'Santé'                             },
  environment:     { en: 'Environment',                          fr: 'Environnement'                     },
  indigenous:      { en: 'Indigenous Affairs',                   fr: 'Affaires autochtones'              },
  governance:      { en: 'Governance',                           fr: 'Gouvernance'                       },
};

// Portal backend types — no per-language translation needed (CKAN, Socrata,
// ArcGIS are proper nouns); the `custom` bucket is the only one that needs a
// French label for the public-facing type.
export const PORTAL_TYPE_LABELS: Record<string, { en: string; fr: string }> = {
  ckan:    { en: 'CKAN',                   fr: 'CKAN'                          },
  socrata: { en: 'Socrata',                fr: 'Socrata'                       },
  arcgis:  { en: 'ArcGIS',                 fr: 'ArcGIS'                        },
  custom:  { en: 'Custom Portal',          fr: 'Portail personnalisé'          },
  unknown: { en: 'Unknown',                fr: 'Inconnu'                       },
};

// Freshness buckets — bilingual labels for human display.
export const FRESHNESS_LABELS: Record<string, { en: string; fr: string }> = {
  fresh_1h:  { en: 'Last hour',          fr: 'Dernière heure'        },
  today:     { en: 'Last 24 hours',      fr: 'Dernières 24 heures'   },
  this_week: { en: 'Last 7 days',        fr: '7 derniers jours'      },
  older:     { en: 'Older than 7 days',  fr: 'Plus de 7 jours'       },
};

// Jurisdictional classifications — surfaced across portal/province facets and
// per-record provenance blocks. Federal + Indigenous added in gap-9 for katzilla
// parity (federal endpoints + Indigenous datasets tracked separately).
export const JURISDICTION_LABELS: Record<string, { en: string; fr: string }> = {
  federal:     { en: 'Federal',      fr: 'Fédéral'        },
  provincial:  { en: 'Provincial',   fr: 'Provincial'     },
  territorial: { en: 'Territorial',  fr: 'Territorial'    },
  municipal:   { en: 'Municipal',    fr: 'Municipal'      },
  indigenous:  { en: 'Indigenous',   fr: 'Autochtone'     },
};

// City name overrides — only the cities whose English name differs from the
// official Government of Canada French name get entries. All others fall back
// to the portal.name from MUNICIPAL_PORTALS (treated as identical in both
// languages). St. John's, Saint John, Yellowknife, Whitehorse, Iqaluit, etc.
// are proper nouns traditionally spelled the same way in both languages.
const CITY_NAMES_FR: Record<string, string> = {
  montreal:   'Montréal',
  'quebec':   'Québec', // city (capital); the province is also Québec
};

// Canonical dataset → sector mapping. Used to derive a sector facet bucket
// from the dataset slug without requiring an explicit sector tag in the
// upstream portal. Federal/provincial datasets (open.canada.ca, provincial OGs)
// typically use these same slugs in their themes.
const DATASET_SECTORS: Record<string, string> = {
  'budget':              'finance',
  'building-permits':    'planning',
  'permits':             'planning',
  'zoning':              'planning',
  'development':         'planning',
  'transport':           'transportation',
  'transit':             'transportation',
  '311-calls':           'public_safety',
  'crime':               'public_safety',
  'health':              'health',
  'environment':         'environment',
  'air-quality':         'environment',
  'water-quality':       'environment',
  'maps':                'governance',
  'council':             'governance',
};

const FRESHNESS_BUCKETS: Array<{ bucket: string; lo: number; hi: number }> = [
  { bucket: 'fresh_1h',  lo: 0,      hi: 3600    },
  { bucket: 'today',     lo: 3600,   hi: 86400   },
  { bucket: 'this_week', lo: 86400,  hi: 604800  },
  { bucket: 'older',     lo: 604800, hi: Number.POSITIVE_INFINITY },
];

function parseMulti(s: string | null | undefined): string[] {
  return (s ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function parseFreshWithin(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d+)(s|m|h|d)$/i.exec(s.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * mult;
}

/**
 * GET /v1/municipal/facets
 *
 * Aggregate counts per dimension for the Canadian municipal corpus. Falls
 * back to the MUNICIPAL_PORTALS registry when the cache is empty so clients
 * see the full supported surface even before any live fetch has succeeded.
 *
 * Response shape:
 *   {
 *     cities:        [{value, label, count, record_count}],
 *     provinces:     [{value, label_en, label_fr, iso, jurisdiction, count, record_count}],
 *     portal_types:  [{value, count, record_count}],
 *     datasets:      [{value, sector, count, record_count}],
 *     sectors:       [{value, count, record_count}],
 *     freshness:     [{bucket, label, count, record_count}],
 *     summary:       { total_cities, total_datasets, total_records, generated_at }
 *   }
 *
 * ?city=<id> filter narrows the response to a single city (city facet only).
 * ?province=<code> filter narrows to a single province.
 * ?min_records=<n> drops facets whose record_count is below n (UI noise gate).
 */
export const municipalFacetsHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const cityFilter = parseMulti(url.searchParams.get('city'));
  const provinceFilter = parseMulti(url.searchParams.get('province'));
  const minRecords = parseInt(url.searchParams.get('min_records') ?? '0', 10) || 0;

  // Resolve ?lang= opt (en default; reject unsupported with VALIDATION_ERROR)
  const langRaw = url.searchParams.get('lang');
  const langResolved = resolveLocale(langRaw);
  if (langResolved === 'invalid') {
    return langValidationError(langRaw);
  }
  const lang: Locale = langResolved;

  const coverage = loadMunicipalRecordCoverage();
  const now = Date.now();

  // Per-city bucket (cache-derived, bilingual)
  interface CityFacets { value: string; label_en: string; label_fr: string; label_preferred: string; count: number; record_count: number; }
  const cityMap = new Map<string, CityFacets>();

  // Per-portal-type bucket (bilingual)
  interface PortalFacets { value: string; label_en: string; label_fr: string; label_preferred: string; count: number; record_count: number; }
  const portalMap = new Map<string, PortalFacets>();

  // Per-dataset bucket (also derives sector)
  interface DatasetFacets { value: string; label_en: string; label_fr: string; label_preferred: string; sector: string | null; sector_label_en: string | null; sector_label_fr: string | null; count: number; record_count: number; }
  const datasetMap = new Map<string, DatasetFacets>();

  // Per-province bucket (bilingual)
  interface ProvinceFacets {
    value: string;
    label_en: string;
    label_fr: string;
    label_preferred: string;
    iso: string;
    /**
     * Compatibility alias — machine-readable jurisdictional classification
     * ('federal' | 'provincial' | 'territorial' | 'municipal' | 'indigenous').
     * Kept alongside jurisdiction_en/fr/preferred so existing clients that
     * filter by `province.jurisdiction === 'provincial'` continue to work.
     */
    jurisdiction: string;
    jurisdiction_en: string;
    jurisdiction_fr: string;
    jurisdiction_preferred: string;
    cities_count: number;
    count: number;
    record_count: number;
  }
  const provinceMap = new Map<string, ProvinceFacets>();

  // Freshness bucket counters (bilingual)
  interface FreshnessFacets {
    bucket: string;
    /** Compatibility alias for pre-bilingual clients: English label only. */
    label: string;
    label_en: string;
    label_fr: string;
    label_preferred: string;
    count: number;
    record_count: number;
  }
  const freshnessMap = new Map<string, FreshnessFacets>(
    FRESHNESS_BUCKETS.map((b) => {
      const lbl = FRESHNESS_LABELS[b.bucket] ?? { en: b.bucket, fr: b.bucket };
      return [b.bucket, {
        bucket: b.bucket,
        label: lbl.en, // compat alias (English); deprecated in favour of label_en/fr/preferred
        label_en: lbl.en,
        label_fr: lbl.fr,
        label_preferred: labelFor(lang, lbl.en, lbl.fr),
        count: 0,
        record_count: 0,
      }];
    }),
  );

  for (const r of coverage) {
    const portal = MUNICIPAL_PORTALS[r.cityId];
    if (cityFilter.length && !cityFilter.includes(r.cityId)) continue;
    if (provinceFilter.length && portal && !provinceFilter.includes(portal.province.toLowerCase())) continue;

    const cityNameEn = portal?.name ?? r.cityId;
    const cityNameFr = portal ? (CITY_NAMES_FR[cityIdLower(portal, r.cityId)] ?? portal.name) : r.cityId;
    const cityBucket = cityMap.get(r.cityId) ?? {
      value: r.cityId,
      label_en: cityNameEn,
      label_fr: cityNameFr,
      label_preferred: labelFor(lang, cityNameEn, cityNameFr),
      count: 0,
      record_count: 0,
    };
    cityBucket.count++;
    cityBucket.record_count += r.recordCount;
    cityMap.set(r.cityId, cityBucket);

    const portalType = portal?.portalType ?? 'unknown';
    const pl = PORTAL_TYPE_LABELS[portalType] ?? { en: portalType, fr: portalType };
    const portalBucket = portalMap.get(portalType) ?? {
      value: portalType,
      label_en: pl.en,
      label_fr: pl.fr,
      label_preferred: labelFor(lang, pl.en, pl.fr),
      count: 0,
      record_count: 0,
    };
    portalBucket.count++;
    portalBucket.record_count += r.recordCount;
    portalMap.set(portalType, portalBucket);

    const sector = DATASET_SECTORS[r.dataset] ?? null;
    const sectorLbl = sector ? SECTOR_LABELS[sector] : null;
    const dsKey = `${r.cityId}|${r.dataset}`;
    const dsBucket = datasetMap.get(dsKey) ?? {
      value: r.dataset,
      label_en: humanizeDatasetName(r.dataset),
      label_fr: humanizeDatasetName(r.dataset),
      label_preferred: humanizeDatasetName(r.dataset),
      sector,
      sector_label_en: sectorLbl?.en ?? null,
      sector_label_fr: sectorLbl?.fr ?? null,
      count: 0,
      record_count: 0,
    };
    dsBucket.count++;
    dsBucket.record_count += r.recordCount;
    datasetMap.set(dsKey, dsBucket);

    if (portal) {
      const provKey = portal.province;
      const provLabels = PROVINCE_LABELS[provKey];
      const jur = provLabels?.jurisdiction ?? 'municipal';
      const jurLbl = JURISDICTION_LABELS[jur] ?? { en: jur, fr: jur };
      const provBucket = provinceMap.get(provKey) ?? {
        value: provKey,
        label_en: provLabels?.en ?? provKey,
        label_fr: provLabels?.fr ?? provKey,
        label_preferred: labelFor(lang, provLabels?.en ?? provKey, provLabels?.fr ?? provKey),
        iso:   provLabels?.iso ?? `CA-${provKey}`,
        jurisdiction: jur, // machine code (compat with pre-bilingual clients)
        jurisdiction_en: jurLbl.en,
        jurisdiction_fr: jurLbl.fr,
        jurisdiction_preferred: labelFor(lang, jurLbl.en, jurLbl.fr),
        cities_count: 0,
        count: 0,
        record_count: 0,
      };
      if (!provBucket.count) provBucket.cities_count = 0;
      provBucket.count++;
      provBucket.record_count += r.recordCount;
      provinceMap.set(provKey, provBucket);
    }

    for (const b of FRESHNESS_BUCKETS) {
      if (r.ageSeconds >= b.lo && r.ageSeconds < b.hi) {
        const fb = freshnessMap.get(b.bucket)!;
        fb.count++;
        fb.record_count += r.recordCount;
        break;
      }
    }
  }

  // Recompute cities_count per province (one per city in map)
  for (const prov of provinceMap.values()) {
    let n = 0;
    for (const c of cityMap.values()) {
      const portal = MUNICIPAL_PORTALS[c.value];
      if (portal?.province === prov.value) n++;
    }
    prov.cities_count = n;
  }

  // Sector facets — aggregate dataset facets by sector with bilingual labels
  interface SectorFacets { value: string; label_en: string; label_fr: string; label_preferred: string; count: number; record_count: number; }
  const sectorMap = new Map<string, SectorFacets>();
  for (const ds of datasetMap.values()) {
    if (!ds.sector || !ds.sector_label_en) continue;
    const lbl = { en: ds.sector_label_en, fr: ds.sector_label_fr ?? ds.sector_label_en };
    const sb = sectorMap.get(ds.sector) ?? {
      value: ds.sector,
      label_en: lbl.en,
      label_fr: lbl.fr,
      label_preferred: labelFor(lang, lbl.en, lbl.fr),
      count: 0,
      record_count: 0,
    };
    sb.count++;
    sb.record_count += ds.record_count;
    sectorMap.set(ds.sector, sb);
  }

  // Apply min_records gate
  const gate = <T extends { record_count: number }>(arr: T[]): T[] =>
    arr.filter((x) => x.record_count >= minRecords);

  // Seed zero-buckets for provinces/cities/datasets that exist in the
  // registry but have zero cache entries — so the UI shows them as
  // available-but-empty rather than missing.
  for (const [cityId, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    if (cityFilter.length && !cityFilter.includes(cityId)) continue;
    if (!cityMap.has(cityId)) {
      const en = portal.name;
      const fr = CITY_NAMES_FR[cityIdLower(portal, cityId)] ?? portal.name;
      cityMap.set(cityId, {
        value: cityId,
        label_en: en,
        label_fr: fr,
        label_preferred: labelFor(lang, en, fr),
        count: 0,
        record_count: 0,
      });
    }
  }
  for (const [code, labels] of Object.entries(PROVINCE_LABELS)) {
    if (provinceFilter.length && !provinceFilter.includes(code.toLowerCase())) continue;
    if (!provinceMap.has(code)) {
      const jurLbl = JURISDICTION_LABELS[labels.jurisdiction] ?? { en: labels.jurisdiction, fr: labels.jurisdiction };
      provinceMap.set(code, {
        value: code,
        label_en: labels.en,
        label_fr: labels.fr,
        label_preferred: labelFor(lang, labels.en, labels.fr),
        iso: labels.iso,
        jurisdiction: labels.jurisdiction, // machine code (compat)
        jurisdiction_en: jurLbl.en,
        jurisdiction_fr: jurLbl.fr,
        jurisdiction_preferred: labelFor(lang, jurLbl.en, jurLbl.fr),
        cities_count: 0,
        count: 0,
        record_count: 0,
      });
    }
  }

  const sortByCount = <T extends { count: number; record_count: number; value: string }>(a: T, b: T) =>
    (b.record_count - a.record_count) || a.value.localeCompare(b.value);

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal-facets',
        taxonomy: 'canada',
        locale: lang,
        cities: gate(Array.from(cityMap.values()).sort(sortByCount)),
        provinces: gate(Array.from(provinceMap.values()).sort((a, b) => a.value.localeCompare(b.value))),
        portal_types: gate(Array.from(portalMap.values()).sort(sortByCount)),
        datasets: gate(Array.from(datasetMap.values()).sort(sortByCount)),
        sectors: gate(Array.from(sectorMap.values()).sort(sortByCount)),
        freshness: gate(Array.from(freshnessMap.values())),
        summary: {
          total_cities: cityMap.size,
          total_datasets: datasetMap.size,
          total_records: coverage.reduce((s, r) => s + r.recordCount, 0),
          supported_provinces: Object.keys(PROVINCE_LABELS).length,
          generated_at: new Date(now).toISOString(),
        },
      },
      ctx,
    ),
  );
};

// Helper: canonicalize cityId lookup key for the CITY_NAMES_FR map.
function cityIdLower(portal: { name: string } | undefined, cityId: string): string {
  // MUNICIPAL_PORTALS keys match the canonical English lowercased form for
  // most cities (toronto, vancouver, montreal, etc.).
  return cityId.toLowerCase();
}

// Helper: produce a human-readable Title-Case label from a kebab-case
// dataset slug. EN and FR are intentionally identical here — dataset names
// like "Building Permits" / "Air Quality" are universally understood across
// both Official Languages; the authoritative FR translations live in the
// SECTOR_LABELS / PORTAL_TYPE_LABELS / FRESHNESS_LABELS constants where they
// carry real linguistic weight (Urbanisme, Sécurité publique, etc.).
function humanizeDatasetName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * GET /v1/municipal/search
 *
 * Cache-first full-text + multi-facet search across cached municipal records.
 * Search is OFFLINE-FIRST: it never triggers upstream HTTP fetches (those
 * are reserved for /v1/municipal/<city>). The freshness gate + jurisdiction +
 * language filters let consumers pin to a freshness SLA without ever
 * hitting rate limits on upstream portals.
 *
 * Query params:
 *   ?q=                — full-text on cached record JSON blob (case-insensitive substring)
 *   ?cities=           — comma list (e.g. toronto,montreal)
 *   ?provinces=        — comma list (ON,QC,BC,...)
 *   ?datasets=         — comma list (budget,permits,...)
 *   ?portal_types=     — comma list (ckan,socrata,arcgis,custom)
 *   ?sector=           — single (finance,planning,transportation,public_safety,health,environment,indigenous,governance)
 *   ?jurisdiction=     — single (federal/provincial/territorial/municipal/indigenous) — informational; current data is municipal only
 *   ?language=         — comma list (en,fr,bilingual) — informational; metadata only
 *   ?fresh_within=24h  — ISO-8601-ish: 30s, 5m, 1h, 24h, 7d. Caps age in seconds.
 *   ?limit=50          — cap results (also honours _limit from QueryOptions)
 *
 * Response shape:
 *   { records, applied_filters, pagination, source_breakdown }
 */
export const municipalSearchHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const q              = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const citiesFilter   = parseMulti(url.searchParams.get('cities'));
  const provincesFilter = parseMulti(url.searchParams.get('provinces'));
  const datasetsFilter = parseMulti(url.searchParams.get('datasets'));
  const portalTypesFilter = parseMulti(url.searchParams.get('portal_types'));
  const sectorFilter   = (url.searchParams.get('sector') ?? '').toLowerCase() || null;
  const jurisdictionFilter = (url.searchParams.get('jurisdiction') ?? '').toLowerCase() || null;
  const languageFilter = parseMulti(url.searchParams.get('language'));
  const cursor         = url.searchParams.get('cursor');
  const freshWithinSec = parseFreshWithin(url.searchParams.get('fresh_within'));
  const explicitLimit  = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit          = Math.max(1, Math.min(500, explicitLimit));

  // Resolve ?lang= opt
  const langRaw = url.searchParams.get('lang');
  const langResolved = resolveLocale(langRaw);
  if (langResolved === 'invalid') {
    return langValidationError(langRaw);
  }
  const lang: Locale = langResolved;

  // Decode base64url offset cursor to continue pagination. If parsing fails,
  // treat as start-of-results (don't throw) — defensive against stale tokens.
  const cursorOffset = (() => {
    if (!cursor) return 0;
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const n = parseInt(decoded, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  })();

  const records: UnifiedMunicipalRecord[] = [];
  const sourceBreakdown = new Map<string, { value: string; count: number; record_count: number }>();
  let globalIndex = 0;
  const startIndex = cursorOffset;

  for (const [cityId, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    if (citiesFilter.length && !citiesFilter.includes(cityId.toLowerCase())) continue;
    if (provincesFilter.length && !provincesFilter.includes(portal.province.toLowerCase())) continue;
    if (portalTypesFilter.length && !portalTypesFilter.includes(portal.portalType.toLowerCase())) continue;
    if (jurisdictionFilter === 'municipal' && !cityId) continue; // all current data is municipal — no-op filter

    for (const ds of portal.datasets) {
      if (datasetsFilter.length && !datasetsFilter.includes(ds)) continue;
      if (sectorFilter && DATASET_SECTORS[ds] !== sectorFilter) continue;

      const cached = loadMunicipalRecordCache(cityId, ds);
      if (!cached) continue;

      const ageSec = Math.round((Date.now() - new Date(cached.succeededAt).getTime()) / 1000);
      if (freshWithinSec !== null && ageSec > freshWithinSec) continue;

      // Full-text filter on the cached records JSON blob (excluding the
      // provenance block we strip at write time). Cheap substring match;
      // future work: FTS5 virtual table over records_json.
      if (q) {
        const blob = JSON.stringify(cached.records).toLowerCase();
        if (!blob.includes(q)) continue;
      }

      // Source anatomy counter
      const srcKey = `${cityId}/${ds}`;
      const src = sourceBreakdown.get(srcKey) ?? { value: srcKey, count: 0, record_count: 0 };
      src.count++;
      src.record_count = cached.recordCount;
      sourceBreakdown.set(srcKey, src);

      // Per-portal bilingual context for record-level provenance
      const municipalityEn = portal.name;
      const municipalityFr = CITY_NAMES_FR[cityIdLower(portal, cityId)] ?? portal.name;
      const provCode = portal.province;
      const provLbl = PROVINCE_LABELS[provCode];
      const jur = provLbl?.jurisdiction ?? 'municipal';
      const jurLbl = JURISDICTION_LABELS[jur] ?? { en: jur, fr: jur };

      for (const rec of cached.records) {
        // Skip records before the cursor offset (pagination)
        if (globalIndex < startIndex) { globalIndex++; continue; }
        const recAny = rec as Record<string, unknown>;
        const citationPayload = JSON.stringify({ source: portal.baseUrl, ...rec });
        const citationHash = createHash('sha256').update(citationPayload).digest('hex');
        records.push({
          id: `${cityId}:${ds}:${String(recAny.id ?? globalIndex)}`,
          municipality: municipalityEn,
          municipalityId: cityId,
          province: portal.province,
          dataset: ds,
          title: String(recAny.title ?? ds),
          url: String(recAny.url ?? portal.baseUrl),
          format: portal.portalType,
          lastModified: (recAny.lastModified as string | null | undefined) ?? null,
          created: (recAny.created as string | null | undefined) ?? null,
          portalType: portal.portalType,
          provenance: {
            source_url: String(recAny.url ?? portal.baseUrl),
            source_organization_en: municipalityEn,
            source_organization_fr: municipalityFr,
            jurisdiction_en: jurLbl.en,
            jurisdiction_fr: jurLbl.fr,
            jurisdiction_preferred: labelFor(lang, jurLbl.en, jurLbl.fr),
            license: (recAny.license as string | undefined) ?? NO_SOURCE_LICENSE_DECLARATION,
            ...(typeof recAny.licenseUrl === 'string' ? { license_url: recAny.licenseUrl } : {}),
            license_basis: recAny.licenseBasis === 'publisher-metadata' || recAny.licenseBasis === 'source-configuration'
              ? recAny.licenseBasis
              : 'no-publisher-declaration',
            ...(typeof recAny.attributionText === 'string' ? { attribution_text: recAny.attributionText } : {}),
            fetched_at: cached.succeededAt,
            citation_hash: `sha256:${citationHash}`,
            from_cache: true,
            cache_age_seconds: ageSec,
          },
        });
        globalIndex++;
        if (records.length >= limit) break;
      }
      if (records.length >= limit) break;
    }
    if (records.length >= limit) break;
  }

  const consumedTo = cursorOffset + records.length;
  // Offset-pagination semantics for next_cursor: if we pushed `limit` records
  // there is definitely more data; if we pushed fewer, we exhausted the scan.
  // (Cursor-past-end is also covered: pushes 0 records → has_more=false.)
  const hasMore = records.length >= limit;

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal-search',
        locale: lang,
        applied_filters: {
          q,
          cities: citiesFilter,
          provinces: provincesFilter,
          datasets: datasetsFilter,
          portal_types: portalTypesFilter,
          sector: sectorFilter,
          jurisdiction: jurisdictionFilter || 'municipal',
          language: languageFilter,
          fresh_within: freshWithinSec,
          limit,
          cursor: cursor ?? null,
        },
        license: NO_SOURCE_LICENSE_DECLARATION,
        license_basis: 'no-publisher-declaration',
        records,
        pagination: {
          total: globalIndex,
          returned: records.length,
          limit,
          consumed_to: consumedTo,
          // Cursor pagination: encode the END of this page as a base64url
          // opaque token so subsequent ?cursor=<token> calls continue from
          // where this one stopped. v2 will migrate to a true keyset cursor
          // backed by the FTS5 virtual table (tracked in gh issue).
          next_cursor: hasMore
            ? Buffer.from(String(consumedTo)).toString('base64url')
            : null,
          has_more: hasMore,
        },
        source_breakdown: Array.from(sourceBreakdown.values()).sort((a, b) =>
          b.record_count - a.record_count || a.value.localeCompare(b.value),
        ),
      },
      ctx,
    ),
  );
};

/**
 * GET /v1/municipal/health
 *
 * Per-city liveness roll-up across the registry. Three buckets:
 *   - "cached"        : cache row exists and is younger than ?stale_after (default 7d)
 *   - "stale"         : cache row exists but older than the staleness threshold
 *   - "uncached"      : no cache row yet — first live fetch has never succeeded
 *
 * The endpoint is read-only and never triggers upstream HTTP fetches —
 * it inspects the persistent SQLite cache that the live route layer
 * populates. Callers can opt into a stricter freshness gate via
 * ?stale_after=24h (returns 5xx gate logic at the freshness bucket level);
 * ?city=toronto narrows the response to one city; ?lang=en|fr wires through.
 *
 * Powers the public status page at /status and the operational dashboard.
 * Together with /v1/municipal/coverage this is the canonical "is the
 * data plane healthy?" surface.
 */
export const municipalHealthHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const cityFilter = parseMulti(url.searchParams.get('city'));
  const staleAfterRaw = url.searchParams.get('stale_after');
  // Reject invalid ?stale_after= values loudly so callers can't silently
  // fall back to the 7-day default when their SLA expectation is wrong.
  let staleAfterSec: number;
  if (staleAfterRaw === null || staleAfterRaw === '') {
    staleAfterSec = 7 * 24 * 3600;
  } else {
    const parsed = parseFreshWithin(staleAfterRaw);
    if (parsed === null) {
      return langValidationError(staleAfterRaw); // same shape; explicit non-fr routing here is fine
    }
    staleAfterSec = parsed;
  }
  const summaryOnly = url.searchParams.get('summary') === 'true' || url.searchParams.get('summary') === '1';

  // Resolve ?lang= opt (en default; reject unsupported with VALIDATION_ERROR)
  const langRaw = url.searchParams.get('lang');
  const langResolved = resolveLocale(langRaw);
  if (langResolved === 'invalid') return langValidationError(langRaw);
  const lang: Locale = langResolved;

  const coverage = loadMunicipalRecordCoverage();
  const now = Date.now();
  const sinceMs = now - staleAfterSec * 1000;

  // Index coverage by (cityId, dataset) for fast lookup
  const cacheByCity = new Map<string, Array<{ dataset: string; recordCount: number; ageSeconds: number; succeededAt: string }>>();
  for (const row of coverage) {
    const arr = cacheByCity.get(row.cityId) ?? [];
    arr.push({ dataset: row.dataset, recordCount: row.recordCount, ageSeconds: row.ageSeconds, succeededAt: row.succeededAt });
    cacheByCity.set(row.cityId, arr);
  }

  interface CityHealth {
    city_id: string;
    label_en: string;
    label_fr: string;
    label_preferred: string;
    province: string;
    portal_type: string;
    portal_type_label_en: string;
    portal_type_label_fr: string;
    portal_url: string;
    jurisdiction_en: string;
    jurisdiction_fr: string;
    jurisdiction_preferred: string;
    status: 'cached' | 'stale' | 'uncached';
    cached_datasets: number;
    cached_records: number;
    freshest_age_seconds: number | null;
    last_succeeded_at: string | null;
  }
  const citiesHealth: CityHealth[] = [];

  const statusCounts = { cached: 0, stale: 0, uncached: 0 } as Record<'cached' | 'stale' | 'uncached', number>;

  for (const [cityId, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    if (cityFilter.length && !cityFilter.includes(cityId.toLowerCase())) continue;
    const rows = cacheByCity.get(cityId) ?? [];
    const totalRecords = rows.reduce((s, r) => s + r.recordCount, 0);
    const freshest = rows.length
      ? rows.reduce((m, r) => (r.succeededAt > m ? r.succeededAt : m), '')
      : null;
    const freshestAge = freshest ? Math.round((now - new Date(freshest).getTime()) / 1000) : null;
    const status: 'cached' | 'stale' | 'uncached' =
      rows.length === 0 ? 'uncached' : freshestAge !== null && freshestAge > staleAfterSec ? 'stale' : 'cached';
    statusCounts[status]++;
    const provCode = portal.province;
    const provLbl = PROVINCE_LABELS[provCode];
    const jur = provLbl?.jurisdiction ?? 'municipal';
    const jurLbl = JURISDICTION_LABELS[jur] ?? { en: jur, fr: jur };
    const cityNameEn = portal.name;
    const cityNameFr = CITY_NAMES_FR[cityIdLower(portal, cityId)] ?? portal.name;
    const portalType = portal.portalType ?? 'unknown';
    const portalLbl = PORTAL_TYPE_LABELS[portalType] ?? { en: portalType, fr: portalType };

    citiesHealth.push({
      city_id: cityId,
      label_en: cityNameEn,
      label_fr: cityNameFr,
      label_preferred: labelFor(lang, cityNameEn, cityNameFr),
      province: provCode,
      portal_type: portalType,
      portal_type_label_en: portalLbl.en,
      portal_type_label_fr: portalLbl.fr,
      portal_url: portal.baseUrl,
      jurisdiction_en: jurLbl.en,
      jurisdiction_fr: jurLbl.fr,
      jurisdiction_preferred: labelFor(lang, jurLbl.en, jurLbl.fr),
      status,
      cached_datasets: rows.length,
      cached_records: totalRecords,
      freshest_age_seconds: freshestAge,
      last_succeeded_at: freshest,
    });
  }

  const cities_total = citiesHealth.length;
  const total_cached_records = citiesHealth.reduce((s, c) => s + c.cached_records, 0);

  // Surface actively-fetching cities first (more cached records = higher rank).
  // Tie-break alphabetically so the order is deterministic.
  const sortByActivity = (a: CityHealth, b: CityHealth) =>
    (b.cached_records - a.cached_records) || a.city_id.localeCompare(b.city_id);

  const responseBody = {
    domain: 'municipal-health',
    locale: lang,
    threshold: {
      stale_after_seconds: staleAfterSec,
      // cutoff_iso marks the wall-clock instant; rows with succeeded_at
      // strictly before this instant are considered stale.
      cutoff_iso: new Date(now - staleAfterSec * 1000).toISOString(),
    },
    summary: {
      cities_total,
      cities_by_status: statusCounts,
      total_cached_records,
      last_check_at: new Date(now).toISOString(),
      applied_filter: cityFilter.length ? cityFilter : null,
    },
    ...(summaryOnly ? {} : { cities: citiesHealth.sort(sortByActivity) }),
  };

  return jsonResponse(buildSuccess(responseBody, ctx));
};
