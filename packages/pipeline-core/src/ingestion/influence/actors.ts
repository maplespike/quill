// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Influence Actors Connector — Quill
 *
 * Enriches tracked influence actors with data from:
 *   - CRA Charity listing (every registered Canadian charity)
 *   - open.canada.ca CKAN for grants/contributions
 *   - Committee appearance history (cross-reference)
 *   - Lobbying registry (cross-reference)
 *
 * The CRA charity database is a comprehensive public dataset covering
 * every registered charity in Canada — financials, directors, programs.
 * Many think tanks, NGOs, and advocacy groups are registered charities.
 */

import { httpGet } from '../../utils/http.js';
import { TRACKED_INFLUENCE_ACTORS } from './constants.js';
import type { CraCharityRecord } from './types.js';


/**
 * Search CRA charity database for a specific organization.
 *
 * CRA's public charity search allows querying by BN, name, or keyword.
 * Returns basic charity profile including status and designation.
 */
export async function searchCraCharity(
  query: string,
): Promise<Partial<CraCharityRecord>[]> {
  const searchUrl = `https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?selectedCharityBn=&selectedFdtnBn=&selectedLanguage=en&q=${encodeURIComponent(query)}`;

  try {
    const resp = await httpGet(searchUrl, {
      timeoutMs: 15_000,
    });

    const html = resp.body;
    const results: Partial<CraCharityRecord>[] = [];

    // Parse result table rows
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1];
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (!cells || cells.length < 2) continue;

      const extract = (cell: string) => cell.replace(/<[^>]+>/g, '').trim();

      // Typically: BN, Name, Status, Category
      const bnMatch = row.match(/bn=(\d+)/i) || row.match(/selectedCharityBn=(\d+)/i);
      const bn = bnMatch ? bnMatch[1] : null;

      if (!bn) continue;

      results.push({
        bn: bn,
        legalName: cells[1] ? extract(cells[1]) : query,
        status: cells[2] ? extract(cells[2]) : 'Unknown',
        category: cells[3] ? extract(cells[3]) : null,
        sourceUrl: searchUrl,
        ingestedAt: new Date().toISOString(),
      });
    }

    return results;
  } catch (err) {
    // CRA site may block automated requests
    return [];
  }
}

/**
 * Try to resolve a tracked influence actor's CRA BN by searching the registry.
 * Updates the actor record with CRA data if found.
 */
export async function resolveCraBn(
  actor: typeof TRACKED_INFLUENCE_ACTORS[number],
): Promise<string | null> {
  if (actor.craBn) return actor.craBn;
  if (!actor.isCraCharity) return null;

  // Try exact name search first
  const results = await searchCraCharity(actor.name);
  if (results.length > 0 && results[0].bn) {
    return results[0].bn;
  }

  // Try alias search
  for (const alias of actor.aliases) {
    if (alias === actor.name) continue;
    const aliasResults = await searchCraCharity(alias);
    if (aliasResults.length > 0 && aliasResults[0].bn) {
      return aliasResults[0].bn;
    }
  }

  return null;
}


/**
 * Build search URLs for checking if a tracked actor has appeared
 * before parliamentary committees.
 */
export function buildCommitteeAppearanceSearch(actorName: string): string[] {
  return [
    `https://www.ourcommons.ca/search?sr=${encodeURIComponent(actorName)}&cat=publications&type=evidence`,
    `https://sencanada.ca/en/search/?q=${encodeURIComponent(actorName)}`,
  ];
}

/**
 * Get all tracked actors with their search URLs for
 * committee appearance verification.
 */
export function getActorInvestigationUrls(): {
  name: string;
  category: string;
  priority: string;
  committeeSearchUrl: string;
  lobbyingSearchUrl: string;
  craSearchUrl: string;
}[] {
  return TRACKED_INFLUENCE_ACTORS.map(a => ({
    name: a.name,
    category: a.category,
    priority: a.priority,
    committeeSearchUrl: buildCommitteeAppearanceSearch(a.name)[0],
    lobbyingSearchUrl: `https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=${encodeURIComponent(a.name)}`,
    craSearchUrl: a.isCraCharity
      ? `https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?selectedCharityBn=&selectedFdtnBn=&selectedLanguage=en&q=${encodeURIComponent(a.name)}`
      : '',
  }));
}
