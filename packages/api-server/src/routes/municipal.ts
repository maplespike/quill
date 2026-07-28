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
  OGL_CANADA_LICENSE,
} from './_live.js';
import { globalCache } from '../cache.js';
import { createHash } from 'node:crypto';
import type { MunicipalRecord, MunicipalIngestionResult } from '@maplespike/pipeline-core';
import {
  saveMunicipalRecordCache,
  loadMunicipalRecordCache,
  loadMunicipalRecordCoverage,
} from '../cache/municipal.js';

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
        license: OGL_CANADA_LICENSE,
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
