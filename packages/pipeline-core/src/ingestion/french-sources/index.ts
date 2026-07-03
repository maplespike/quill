// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * French Data Sources — MapleSpike Pipeline
 *
 * Static configuration and fetch helpers for French-language Canadian
 * government data sources. Each source exposes a common interface for
 * discovery, searching, and hydration.
 *
 * Sources:
 *   - CanLII FR       (rechercher.canlii.org)
 *   - Québec legislation (legisquebec.gouv.qc.ca)
 *   - Gazette FR      (gazette.gc.ca/...-fra.html)
 *   - StatCan FR      (www150.statcan.gc.ca/n1/fra/)
 *   - Quebec City     (donnees.ville.quebec.qc.ca)
 *   - Montreal        (donnees.montreal.ca)
 */

import { httpGet } from '../../utils/http.js';
import { buildCitation, type Citation } from '../attestation/index.js';

// ─── Source Configuration ──────────────────────────────────────────────

export interface FrenchSourceConfig {
  id: string;
  name: string;
  nameEn: string;
  baseUrl: string;
  searchEndpoint?: string;
  license: string;
  updateFrequency: string;
  lang: 'fr';
  category: 'legal' | 'legislation' | 'gazette' | 'statistics' | 'municipal';
}

export const FRENCH_SOURCES: FrenchSourceConfig[] = [
  {
    id: 'canlii-fr',
    name: 'CanLII (FR)',
    nameEn: 'CanLII French',
    baseUrl: 'https://rechercher.canlii.org',
    searchEndpoint: '/search',
    license: 'CanLII',
    updateFrequency: 'weekly',
    lang: 'fr',
    category: 'legal',
  },
  {
    id: 'legisquebec',
    name: 'Législation Québec',
    nameEn: 'Québec Legislation',
    baseUrl: 'https://legisquebec.gouv.qc.ca',
    searchEndpoint: '/fr/Recherche',
    license: 'Open Government Licence – Québec',
    updateFrequency: 'event-driven',
    lang: 'fr',
    category: 'legislation',
  },
  {
    id: 'gazette-fr',
    name: 'Gazette du Canada (FR)',
    nameEn: 'Canada Gazette French',
    baseUrl: 'https://gazette.gc.ca',
    license: 'Open Government Licence – Canada',
    updateFrequency: 'daily',
    lang: 'fr',
    category: 'gazette',
  },
  {
    id: 'statcan-fr',
    name: 'Statistique Canada',
    nameEn: 'Statistics Canada French',
    baseUrl: 'https://www150.statcan.gc.ca/n1/fra/',
    license: 'Statistics Canada Open Licence',
    updateFrequency: 'monthly',
    lang: 'fr',
    category: 'statistics',
  },
  {
    id: 'quebec-city-data',
    name: 'Données Québec',
    nameEn: 'Quebec City Data',
    baseUrl: 'https://donnees.ville.quebec.qc.ca',
    license: 'Open Government Licence – Québec',
    updateFrequency: 'monthly',
    lang: 'fr',
    category: 'municipal',
  },
  {
    id: 'montreal-data',
    name: 'Données Montréal',
    nameEn: 'Montreal Data',
    baseUrl: 'https://donnees.montreal.ca',
    license: 'Open Government Licence – Québec',
    updateFrequency: 'monthly',
    lang: 'fr',
    category: 'municipal',
  },
];

// ─── Search & Fetch ────────────────────────────────────────────────────

export interface FrenchSourceSearchResult {
  source: FrenchSourceConfig;
  title: string;
  titleEn?: string;
  url: string;
  snippet?: string;
  snippetEn?: string;
  lang: 'fr';
  citation: Citation;
}

/**
 * Build a citation for a French data source record.
 * Attaches ?lang=fr to the source URL and sets the lang field.
 */
export function buildFrenchCitation(
  source: FrenchSourceConfig,
  recordUrl: string,
  dataHash: string,
): Citation {
  const url = recordUrl.includes('?') ? `${recordUrl}&lang=fr` : `${recordUrl}?lang=fr`;
  return buildCitation({
    sourceName: source.name,
    sourceUrl: url,
    dataHash,
    updateFrequency: source.updateFrequency,
    license: source.license,
  });
}

/**
 * Fetch content from a French data source via HTTP GET.
 * Adds fr language preference header.
 */
export async function fetchFrenchSource(
  source: FrenchSourceConfig,
  path: string,
): Promise<{ status: number; body: string; citation: Citation }> {
  const url = `${source.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/json,*/*',
    'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
  };

  const data = await httpGet(url, { headers, timeout: 15000 });
  const hash = await import('../../verification/hashing.js').then(m => m.computeHash(data, 'sha256'));
  const citation = buildFrenchCitation(source, url, hash);

  return { status: 200, body: data, citation };
}

/**
 * Get all French sources or filter by category.
 */
export function getFrenchSources(category?: FrenchSourceConfig['category']): FrenchSourceConfig[] {
  if (!category) return FRENCH_SOURCES;
  return FRENCH_SOURCES.filter(s => s.category === category);
}

/**
 * Get a specific French source by id.
 */
export function getFrenchSource(id: string): FrenchSourceConfig | undefined {
  return FRENCH_SOURCES.find(s => s.id === id);
}
