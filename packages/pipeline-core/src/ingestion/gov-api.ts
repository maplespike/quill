/**
 * Government Data API Clients — Frostbite Data Pipeline
 *
 * Fetchers for Canadian open government data sources.
 * Implements StatCan WDS/SDMX, CKAN portals, and a Katzilla bridge placeholder.
 *
 * Originally planned in: docs/plans/2026-05-10-civic-intelligence-upgrade.md
 * Gov data schema: cloudflare/schema.sql (gov_releases_cache table)
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface GovRelease {
  source: string;
  title: string;
  description: string | null;
  release_date: string | null;
  data_url: string | null;
  jurisdiction: string;
  category: string | null;
}

export interface CKANPackage {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  metadata_created: string;
  metadata_modified: string;
  organization: { name: string; title: string } | null;
}

export interface StatCanRelease {
  productId: string;
  title: string;
  summary: string | null;
  releaseDate: string;
  url: string;
}

/* ------------------------------------------------------------------ */
/*  Statistics Canada WDS REST API                                     */
/* ------------------------------------------------------------------ */

const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';

/**
 * Fetch latest releases from Statistics Canada's Web Data Service.
 * Returns normalized GovRelease objects.
 */
export async function fetchStatCanReleases(
  options: { limit?: number } = {},
): Promise<GovRelease[]> {
  const { limit = 25 } = options;

  try {
    // getAllCubesListLite is the current endpoint (getAllCubes deprecated)
    const response = await fetch(`${STATCAN_WDS_BASE}/getAllCubesListLite`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`StatCan WDS error: ${response.status}`);
    }

    const data: any[] = await response.json();
    const cubes = (Array.isArray(data) ? data : []).slice(0, limit);

    return cubes
      .filter((c: any) => c.productId && (c.cubeTitleEn || c.title))
      .map((c: any) => ({
        source: 'statcan',
        title: c.cubeTitleEn || c.title || 'Untitled',
        description: c.cubeSummaryEn || c.summary || null,
        release_date: c.releaseTime || c.releaseDate || null,
        data_url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${c.productId}`,
        jurisdiction: 'federal',
        category: classifyStatCanCube(c.productId, c.cubeTitleEn || c.title || ''),
      }));
  } catch (error) {
    console.error('StatCan fetch failed:', (error as Error).message);
    return [];
  }
}

/** Crude category assignment based on StatCan product ID ranges and title keywords. */
function classifyStatCanCube(productId: string, title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('gdp') || lower.includes('gross domestic') || lower.includes('inflation') || lower.includes('cpi') || lower.includes('trade') || lower.includes('unemployment')) return 'economy';
  if (lower.includes('population') || lower.includes('demographic') || lower.includes('immigration') || lower.includes('census')) return 'demographics';
  if (lower.includes('crime') || lower.includes('justice') || lower.includes('court') || lower.includes('police')) return 'justice';
  if (lower.includes('health') || lower.includes('hospital') || lower.includes('mortality') || lower.includes('covid')) return 'health';
  if (lower.includes('energy') || lower.includes('emission') || lower.includes('environment') || lower.includes('climate')) return 'environment';
  if (lower.includes('education') || lower.includes('school') || lower.includes('student') || lower.includes('graduate')) return 'education';
  if (lower.includes('income') || lower.includes('poverty') || lower.includes('housing') || lower.includes('tax')) return 'social';
  return 'economy';
}

/* ------------------------------------------------------------------ */
/*  CKAN Portal Client                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch packages from a CKAN data portal.
 * Works with open.canada.ca, data.ontario.ca, catalogue.data.gov.bc.ca, etc.
 */
export async function fetchCKANPackages(
  portal: string,
  options: { rows?: number; query?: string } = {},
): Promise<CKANPackage[]> {
  const { rows = 20, query = '' } = options;

  const url = `${portal}/api/3/action/package_search?rows=${rows}${query ? `&q=${encodeURIComponent(query)}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`CKAN error (${portal}): ${response.status}`);
    }

    const data: any = await response.json();
    if (!data.success || !data.result?.results) {
      return [];
    }

    return data.result.results.map((p: any) => ({
      id: p.id,
      title: p.title,
      notes: p.notes || null,
      url: (p.resources?.[0]?.url) || null,
      metadata_created: p.metadata_created,
      metadata_modified: p.metadata_modified,
      organization: p.organization
        ? { name: p.organization.name, title: p.organization.title }
        : null,
    }));
  } catch (error) {
    console.error(`CKAN fetch failed (${portal}):`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Source Map                                                         */
/* ------------------------------------------------------------------ */

/**
 * Reference: Katzilla (https://katzilla.dev) provides a similar API for
 * US government data (FDA, SEC, Congress, NOAA, Census, FRED, etc.).
 * Our Canadian equivalent will follow the same pattern: one API key,
 * every government dataset, citations on every response.
 */
export const GOV_DATA_SOURCES = [
  { name: 'Statistics Canada', jurisdiction: 'federal', api: 'WDS', endpoint: STATCAN_WDS_BASE },
  { name: 'Open Government Portal', jurisdiction: 'federal', api: 'CKAN', endpoint: 'https://open.canada.ca/data/en' },
  { name: 'Ontario Data Catalogue', jurisdiction: 'ontario', api: 'CKAN', endpoint: 'https://data.ontario.ca' },
  { name: 'BC Data Catalogue', jurisdiction: 'bc', api: 'CKAN', endpoint: 'https://catalogue.data.gov.bc.ca' },
  { name: 'Alberta Open Data', jurisdiction: 'alberta', api: 'CKAN', endpoint: 'https://open.alberta.ca' },
  { name: 'Québec Données', jurisdiction: 'quebec', api: 'CKAN', endpoint: 'https://donneesquebec.ca' },
];
