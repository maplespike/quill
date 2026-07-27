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
 *   - This bounds the worst-case fetch (no "flush every portal" option).
 *
 * municipalCityHandler (GET /v1/municipal/<city>):
 *   - Single-city live fetch (matches user-specified URL semantics).
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import {
  ingestMunicipalDataset,
  MUNICIPAL_PORTALS,
} from '@maplespike/pipeline-core/municipal';
import {
  runLivePipeline,
  type RecordProvenance,
  type AggregateProvenance,
  normalizeFilterString,
  OGL_CANADA_LICENSE,
} from './_live.js';
import { createHash } from 'node:crypto';
import type { MunicipalRecord, MunicipalIngestionResult } from '@maplespike/pipeline-core';

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

/** Pick a subset of MUNICIPAL_PORTALS that match the caller's filter params. */
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
    }
  }
  return jobs;
}

/**
 * Run matched portal x dataset jobs with bounded concurrency + per-job soft
 * timeout. Concurrency cap of 4 prevents 50-portal-Promise.all bursts from
 * triggering upstream CKAN 503s. The per-job timeout fires a synthetic
 * `errors: ["Job exceeded Nms per-portal ceiling"]` so callers see a clean
 * `status: 'partial'` envelope even when one city goes slow.
 *
 * IMPORTANT: ingestMunicipalDataset / fetchMunicipalDataset do not accept
 * AbortSignal, so the underlying HTTP fetch keeps running detached after
 * the timeout fires. The response body is what the caller sees; the leaked
 * fetch will garbage-collect on its own once the response body is parsed.
 * Threading AbortSignal through pipeline-core's API surface is a larger
 * change scoped for a separate PR.
 */
async function ingestMatchedPortals(
  jobs: PerPortalJob[],
  perJobTimeoutMs: number,
): Promise<MunicipalIngestionResult[]> {
  const MAX_CONCURRENCY = 4;
  const cappedJobs = jobs.slice(0, 50);
  const results: MunicipalIngestionResult[] = [];

  for (let i = 0; i < cappedJobs.length; i += MAX_CONCURRENCY) {
    const slice = cappedJobs.slice(i, i + MAX_CONCURRENCY);
    const settled = await Promise.all(
      slice.map(async (job): Promise<MunicipalIngestionResult> => {
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
        const result = await Promise.race([jobPromise, timeoutPromise]);
        clearTimeout(timer);
        return result;
      }),
    );
    results.push(...settled);

    // Tiny jitter between waves to avoid lockstep bursts to upstream CKANs.
    if (i + MAX_CONCURRENCY < cappedJobs.length) {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  return results;
}

function buildEnvelope(
  results: MunicipalIngestionResult[],
  fetchedAt: string,
  durationMs: number,
): { records: UnifiedMunicipalRecord[]; provenance: AggregateProvenance } {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;
  const records: UnifiedMunicipalRecord[] = [];

  for (const r of results) {
    if (r.errors && r.errors.length > 0) {
      failed++;
      errors.push(...r.errors.map((e) => `[${r.municipality}] ${e}`));
    } else {
      success++;
    }
    for (const rec of r.records ?? []) {
      // Full 64-hex SHA-256 of `{source, ...record}` content — matches
      // `/v1/citation/<hash>` validator `/^[a-f0-9]{64}$/i` after strip.
      const citation_payload = JSON.stringify({ source: r.source, ...rec });
      const citation_hash = `sha256:${createHash('sha256')
        .update(citation_payload)
        .digest('hex')}`;
      records.push({
        ...(rec as MunicipalRecord),
        municipality: r.municipality || rec.municipality || rec.municipalityId,
        provenance: {
          source_url: rec.url ?? r.source,
          fetched_at: fetchedAt,
          citation_hash,
          license: OGL_CANADA_LICENSE,
        },
      });
    }
  }

  return {
    records,
    provenance: {
      status: failed === 0 ? 'live' : success === 0 ? 'unavailable' : 'partial',
      freshness_seconds: Math.round(durationMs / 100) / 10,
      source_count: results.length,
      fetched_at: fetchedAt,
      errors,
    },
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

  const live = await runLivePipeline(ctx, cacheKey, async () => {
    const startedAt = Date.now();
    const fetchedAt = new Date().toISOString();
    const results = await ingestMatchedPortals(jobs, 10_000);
    const envelope = buildEnvelope(results, fetchedAt, Date.now() - startedAt);
    // Wrap in { municipal: [...] } so _live shape detection works (Record<string, IngestionResultLike>)
    return {
      municipal: {
        records: envelope.records as unknown as Array<{
          url?: string;
          [key: string]: unknown;
        }>,
        recordsFound: envelope.records.length,
        errors: envelope.provenance.errors,
      },
    };
  }, { ttlSeconds: 600 });

  let records = live.records;
  records = records.slice(0, limit);

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal',
        records,
        provenance: live.provenance,
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

  const live = await runLivePipeline(ctx, cacheKey, async () => {
    const startedAt = Date.now();
    const fetchedAt = new Date().toISOString();
    const jobs = selectPortals(city, dataset, null);
    const results = await ingestMatchedPortals(jobs, 12_000);
    return {
      municipal: {
        records: results.flatMap((r) => r.records as MunicipalRecord[]),
        recordsFound: results.reduce((sum, r) => sum + (r.records?.length ?? 0), 0),
        errors: results.flatMap((r) => r.errors),
      },
    };
  }, { ttlSeconds: 900 });

  return jsonResponse(
    buildSuccess(
      {
        domain: 'municipal',
        city,
        records: live.records,
        provenance: live.provenance,
        filters: { city, dataset: dataset || null },
      },
      ctx,
    ),
  );
};
