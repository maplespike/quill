/**
 * MapleSpike — Government Data Endpoints
 *
 * GET /v1/gov/releases — Government data releases
 * GET /v1/gov/search — Search across all gov data sources
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { fetchStatCanReleases, fetchCKANPackages, GOV_DATA_SOURCES } from '@maplespike/pipeline-core';
import type { GovRelease } from '@maplespike/pipeline-core';
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

  // Fetch live data from pipeline-core (StatCan WDS API)
  let releases: GovRelease[] = [];
  try {
    const statCanReleases = await fetchStatCanReleases({ limit: 5 });
    if (statCanReleases.length > 0) {
      releases = statCanReleases;
    }
  } catch {
    // Live fetch failed
  }

  // Tertiary: hardcoded sample releases for development
  if (releases.length === 0) {
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

  // Search pipeline data (local, works offline)
  const pipelineData = loadPipelineData();
  const pipelineReleases: GovRelease[] = pipelineData ? pipelineDataToReleases(pipelineData) : [];
  const qLower = query.toLowerCase();
  const pipelineMatches = pipelineReleases.filter(
    (r) =>
      r.title.toLowerCase().includes(qLower) ||
      (r.description && r.description.toLowerCase().includes(qLower)) ||
      (r.category && r.category.toLowerCase().includes(qLower)),
  );

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
      pipeline: pipelineMatches,
      ckan: ckanResults,
      releases: sampleMatches,
    },
    total: pipelineMatches.length + ckanResults.length + sampleMatches.length,
  }, ctx));
};

/* ------------------------------------------------------------------ */
/*  Pipeline Data Loading                                              */
/* ------------------------------------------------------------------ */

const PIPELINE_DATA_PATHS = [
  resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
  resolve('/data/projects/own/maplespike/packages/portal/assets/pipeline-data.json'),
];

function loadPipelineData(): Record<string, unknown> | null {
  for (const p of PIPELINE_DATA_PATHS) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function pipelineDataToReleases(pipelineData: Record<string, unknown>): GovRelease[] {
  const releases: GovRelease[] = [];
  const sources = pipelineData.sources as Record<string, { status: string; records: number; data: Record<string, unknown>[] }> | undefined;
  if (!sources) return releases;

  // Map each source's data array to GovRelease objects
  for (const [sourceKey, sourceVal] of Object.entries(sources)) {
    if (!sourceVal.data || !Array.isArray(sourceVal.data)) continue;

    for (const item of sourceVal.data) {
      const r = item as Record<string, unknown>;
      let title = '';
      let description = '';
      let releaseDate: string | null = null;
      let dataUrl: string | null = null;

      // Extract fields heuristically based on what's available
      title = (r.title as string) || (r.packageTitle as string) || (r.name as string) || (r.committee as string) || '';
      description = (r.description as string) || (r.notes as string) || (r.summary as string) || (r.resourceDescription as string) || '';
      releaseDate = (r.release_date as string) || (r.date as string) || (r.publication_date as string) || (r.lastModified as string) || null;
      dataUrl = (r.data_url as string) || (r.url as string) || (r.source as string) || (r.resourceUrl as string) || null;

      if (!title) continue;

      const jurisdiction = sourceKey === 'provincialLobbying'
        ? ((r.province as string) || 'provincial')
        : sourceKey === 'hoc' || sourceKey === 'senate' || sourceKey === 'gic' || sourceKey === 'oversight'
          ? 'federal'
          : 'federal';

      const categoryMap: Record<string, string> = {
        hoc: 'government',
        senate: 'government',
        gic: 'appointments',
        lmia: 'labour',
        oversight: 'oversight',
        elections: 'elections',
        corporate: 'corporate',
        lobbying: 'lobbying',
        procurement: 'spending',
        influence: 'influence',
        provincialLobbying: 'lobbying',
        gazette: 'regulations',
        canlii: 'legal',
      };

      releases.push({
        source: sourceKey,
        title,
        description: description || null,
        release_date: releaseDate,
        data_url: dataUrl,
        jurisdiction,
        category: categoryMap[sourceKey] || null,
      });
    }
  }

  return releases;
}

export const dataHandler: RouteHandler = async (_request, ctx) => {
  const pipelineData = loadPipelineData();

  if (!pipelineData) {
    return jsonResponse(
      buildError('NOT_FOUND', 'Pipeline data file not found. Run the data pipeline first.', ctx),
      404,
    );
  }

  return jsonResponse(buildSuccess(pipelineData, ctx));
};
