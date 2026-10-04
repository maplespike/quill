// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Socrata API Client — Quill
 *
 * Fetcher for provincial Socrata-based open data portals (NS, NB, PE).
 * Uses the SODA (Socrata Open Data API) catalog and resource endpoints.
 */

import { httpGet } from '../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SocrataView {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  category: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  downloadCount: number | null;
  url: string | null;
}

export interface SocrataSource {
  province: string;
  endpoint: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Provincial Socrata Source Map                                      */
/* ------------------------------------------------------------------ */

export const PROVINCIAL_SOCRATA_SOURCES: Record<string, SocrataSource> = {
  ns: { province: 'ns', endpoint: 'https://data.novascotia.ca', label: 'Nova Scotia Open Data' },
  nb: { province: 'nb', endpoint: 'https://gnb.socrata.com', label: 'New Brunswick Open Data' },
  pe: { province: 'pe', endpoint: 'https://data.princeedwardisland.ca', label: 'Prince Edward Island Open Data' },
};

/* ------------------------------------------------------------------ */
/*  Socrata Catalog Fetcher                                            */
/* ------------------------------------------------------------------ */

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

export async function fetchSocrataCatalog(
  endpoint: string,
  options: { query?: string; limit?: number } = {},
): Promise<SocrataView[]> {
  const { query = '', limit = 20 } = options;
  const url = `${endpoint}/api/views?q=${encodeURIComponent(query)}&limit=${limit}`;

  try {
    const resp = await httpGet(url, {
      timeoutMs: 15000,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      throw new Error(`Socrata catalog error (${endpoint}): ${resp.statusCode}`);
    }

    const data: any = await resp.json();
    if (!Array.isArray(data)) return [];

    return data.map((v: any) => ({
      id: v.id ?? '',
      name: v.name ?? 'Untitled',
      description: v.description ?? null,
      type: v.type ?? null,
      category: v.category ?? null,
      createdAt: v.createdAt ?? null,
      updatedAt: v.updatedAt ?? null,
      downloadCount: v.viewType?.downloadCount ?? v.downloadCount ?? null,
      url: v.webUri ? `${endpoint}${v.webUri}` : null,
    }));
  } catch (error) {
    console.error(`Socrata catalog fetch failed (${endpoint}):`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Socrata Dataset Fetcher                                            */
/* ------------------------------------------------------------------ */

export async function fetchSocrataDataset(
  endpoint: string,
  datasetId: string,
  limit: number = 20,
): Promise<Record<string, unknown>[]> {
  const url = `${endpoint}/resource/${datasetId}.json?$limit=${limit}`;

  try {
    const resp = await httpGet(url, {
      timeoutMs: 15000,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      throw new Error(`Socrata dataset error (${endpoint}/${datasetId}): ${resp.statusCode}`);
    }

    const data: any = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Socrata dataset fetch failed (${endpoint}/${datasetId}):`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  All Provincial Socrata Sources                                     */
/* ------------------------------------------------------------------ */

export async function fetchAllProvincialSocrata(
  query: string,
): Promise<{ source: string; views: SocrataView[] }[]> {
  const results: { source: string; views: SocrataView[] }[] = [];

  for (const [, src] of Object.entries(PROVINCIAL_SOCRATA_SOURCES)) {
    const views = await fetchSocrataCatalog(src.endpoint, { query, limit: 20 });
    results.push({ source: src.label, views });
  }

  return results;
}
