/**
 * Quill — Government Data Endpoints
 *
 * GET /v1/gov/releases — Government data releases
 * GET /v1/gov/search — Search across all gov data sources
 *
 * HONEST DATA POLICY: This route never serves hardcoded sample data.
 * When the live StatCan WDS fetch fails or returns empty, the response
 * is an empty array — never fabricated records. Status is surfaced via
 * `provenance.status` so callers can tell 'live' from 'unavailable'.
 */

import type { RouteHandler } from '../types.js';
import { getReleaseSnapshot } from '../services/gov-releases-cache.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import {
  fetchStatCanReleases,
  fetchCKANPackages,
  GOV_DATA_SOURCES,
  statcanAttributionNotice,
} from '@maplespike/pipeline-core';
import type { GovRelease } from '@maplespike/pipeline-core';

interface ReleaseEnvelope {
  releases: GovRelease[];
  total: number;
  /** Required Statistics Canada source notice (Open Licence — "as is" reproduction). */
  attribution: string;
  sources: { name: string; jurisdiction: string }[];
  filters: { jurisdiction: string | null; category: string | null; limit: number };
  provenance: {
    status: 'live' | 'unavailable';
    source_count: number;
    fetched_at: string;
    errors: string[];
    /** True when the rows came from the shared snapshot rather than a fresh fetch. */
    cached: boolean;
    /** Age of the rows in seconds; null when no rows were ever fetched. */
    age_seconds: number | null;
  };
}

/** GET /v1/gov/releases */
export const listReleasesHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const jurisdiction = url.searchParams.get('jurisdiction');
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  // One shared snapshot of the StatCan releases, refreshed on a timer, so the
  // request never awaits the upstream's full latency (19 s measured on
  // 2026-10-24, against a 173 ms p50 for the rest of the API). A failed fetch
  // surfaces in provenance.errors — never as hand-written fake records.
  const read = await getReleaseSnapshot({
    fetcher: () => fetchStatCanReleases({ limit: 20 }),
  });
  const errors = [...read.snapshot.errors];
  let releases: GovRelease[] = read.snapshot.releases;
  const liveSourceCount = read.snapshot.live && releases.length > 0 ? 1 : 0;
  const fetchedAt = read.snapshot.fetchedAt;

  if (jurisdiction) {
    releases = releases.filter((r) => r.jurisdiction === jurisdiction);
  }
  if (category) {
    releases = releases.filter((r) => r.category === category);
  }
  releases = releases.slice(0, limit);

  const envelope: ReleaseEnvelope = {
    releases,
    total: releases.length,
    attribution: statcanAttributionNotice(),
    sources: GOV_DATA_SOURCES.map((s) => ({
      name: s.name,
      jurisdiction: s.jurisdiction,
    })),
    filters: {
      jurisdiction: jurisdiction || null,
      category: category || null,
      limit,
    },
    provenance: {
      status: liveSourceCount > 0 && releases.length > 0 ? 'live' : 'unavailable',
      source_count: liveSourceCount,
      fetched_at: fetchedAt,
      errors,
      // A cached snapshot is still a real fetch; its age says how real.
      cached: read.cached,
      age_seconds: read.ageSeconds,
    },
  };

  return jsonResponse(buildSuccess(envelope, ctx));
};

/** GET /v1/gov/search */
export const searchGovHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const jurisdiction = url.searchParams.get('jurisdiction') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  if (!query) {
    return jsonResponse(
      buildError('MISSING_QUERY', 'Query parameter "q" is required', ctx),
      400,
    );
  }

  // Search via CKAN (pipeline-core). Returns honest empty list on
  // failure instead of fabricated records.
  let ckanResults: Array<{
    id: string;
    title: string;
    notes: string | null;
    url: string | null;
    metadata_created: string;
    metadata_modified: string;
    organization: { name: string; title: string } | null;
  }> = [];
  const errors: string[] = [];

  try {
    const portal = jurisdiction
      ? GOV_DATA_SOURCES.find((s) => s.jurisdiction === jurisdiction)?.endpoint
      : 'https://open.canada.ca/data/en';
    if (portal) {
      ckanResults = await fetchCKANPackages(portal, { rows: limit, query });
    } else {
      errors.push(`No CKAN portal configured for jurisdiction: "${jurisdiction}"`);
    }
  } catch (err) {
    errors.push(
      `CKAN search failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const results = ckanResults.slice(0, limit).map((r) => ({
    title: r.title,
    description: r.notes || '',
    source: r.organization?.name || 'CKAN',
    date: r.metadata_created || '',
    category: '',
    url: r.url || '',
  }));

  return jsonResponse(
    buildSuccess(
      {
        results,
        total: results.length,
        query,
        jurisdiction: jurisdiction || null,
        provenance: {
          status: results.length > 0 ? 'live' : 'unavailable',
          source_count: 1,
          fetched_at: new Date().toISOString(),
          errors,
        },
      },
      ctx,
    ),
  );
};
