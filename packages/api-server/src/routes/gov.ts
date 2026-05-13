/**
 * CivInt Canada — Government Data Endpoints
 *
 * GET /v1/gov/releases — Government data releases
 * GET /v1/gov/search — Search across all gov data sources
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { fetchStatCanReleases, fetchCKANPackages, GOV_DATA_SOURCES } from '@civint/pipeline-core';
import type { GovRelease } from '@civint/pipeline-core';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Sample data for development                                        */
/* ------------------------------------------------------------------ */

const SAMPLE_RELEASES: GovRelease[] = [
  {
    source: 'statcan',
    title: 'Gross domestic product, March 2026',
    description: 'Real GDP grew 0.3% in March, driven by goods-producing industries.',
    release_date: '2026-05-10',
    data_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610043401',
    jurisdiction: 'federal',
    category: 'economy',
  },
  {
    source: 'statcan',
    title: 'Consumer Price Index, April 2026',
    description: 'CPI rose 2.1% year over year, within Bank of Canada target range.',
    release_date: '2026-05-09',
    data_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401',
    jurisdiction: 'federal',
    category: 'economy',
  },
  {
    source: 'statcan',
    title: 'Labour Force Survey, May 2026',
    description: 'Employment increased by 45,000 jobs, unemployment rate stable at 5.8%.',
    release_date: '2026-05-08',
    data_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701',
    jurisdiction: 'federal',
    category: 'economy',
  },
  {
    source: 'open.canada.ca',
    title: 'Federal Contract Awards — April 2026',
    description: 'Monthly report of federal contracts valued over $10,000.',
    release_date: '2026-05-07',
    data_url: 'https://open.canada.ca/en/search/contracts',
    jurisdiction: 'federal',
    category: 'spending',
  },
  {
    source: 'data.ontario.ca',
    title: 'Ontario Health Indicators — Q1 2026',
    description: 'Quarterly health system performance data including wait times and capacity.',
    release_date: '2026-05-06',
    data_url: 'https://data.ontario.ca/dataset/health-indicators',
    jurisdiction: 'ontario',
    category: 'health',
  },
];

/* ------------------------------------------------------------------ */
/*  Handlers                                                           */
/* ------------------------------------------------------------------ */

export const listReleasesHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const jurisdiction = url.searchParams.get('jurisdiction');
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  // Try fetching live data from pipeline-core
  let releases: GovRelease[] = [];
  try {
    const statCanReleases = await fetchStatCanReleases({ limit: 5 });
    if (statCanReleases.length > 0) {
      releases = statCanReleases;
    } else {
      releases = SAMPLE_RELEASES;
    }
  } catch {
    releases = SAMPLE_RELEASES;
  }

  // Filter
  if (jurisdiction) {
    releases = releases.filter((r) => r.jurisdiction === jurisdiction);
  }
  if (category) {
    releases = releases.filter((r) => r.category === category);
  }

  releases = releases.slice(0, limit);

  return jsonResponse(buildSuccess({
    releases,
    total: releases.length,
    sources: GOV_DATA_SOURCES.map((s) => ({ name: s.name, jurisdiction: s.jurisdiction })),
    filters: { jurisdiction: jurisdiction || null, category: category || null, limit },
  }, ctx));
};

export const searchGovHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const jurisdiction = url.searchParams.get('jurisdiction') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  if (!query) {
    return jsonResponse(buildError('MISSING_QUERY', 'Query parameter "q" is required', ctx), 400);
  }

  // Try CKAN search via pipeline-core
  let ckanResults: Array<{ id: string; title: string; notes: string | null; url: string | null; metadata_created: string; metadata_modified: string; organization: { name: string; title: string } | null }> = [];
  try {
    const portal = jurisdiction
      ? GOV_DATA_SOURCES.find((s) => s.jurisdiction === jurisdiction)?.endpoint
      : 'https://open.canada.ca/data/en';
    if (portal) {
      ckanResults = await fetchCKANPackages(portal, { rows: limit, query });
    } else {
      ckanResults = [];
    }
  } catch {
    ckanResults = [];
  }

  // Also filter sample data
  const sampleMatches = SAMPLE_RELEASES.filter(
    (r) =>
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(query.toLowerCase())),
  );

  return jsonResponse(buildSuccess({
    query,
    results: {
      ckan: ckanResults,
      releases: sampleMatches,
    },
    total: ckanResults.length + sampleMatches.length,
  }, ctx));
};

/* ------------------------------------------------------------------ */
/*  Pipeline Data Endpoint                                             */
/* ------------------------------------------------------------------ */

const PIPELINE_DATA_PATHS = [
  resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
  resolve('/data/projects/own/civint/packages/portal/assets/pipeline-data.json'),
];

export const dataHandler: RouteHandler = async (_request, ctx) => {
  // Find the pipeline data file
  let pipelineDataPath: string | null = null;
  for (const p of PIPELINE_DATA_PATHS) {
    if (existsSync(p)) {
      pipelineDataPath = p;
      break;
    }
  }

  if (!pipelineDataPath) {
    return jsonResponse(
      buildError('NOT_FOUND', 'Pipeline data file not found. Run the data pipeline first.', ctx),
      404,
    );
  }

  try {
    const raw = readFileSync(pipelineDataPath, 'utf-8');
    const data = JSON.parse(raw);
    return jsonResponse(buildSuccess(data, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read pipeline data';
    return jsonResponse(buildError('DATA_READ_ERROR', message, ctx), 500);
  }
};
