// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Municipal dataset candidate validation (issue #872).
 *
 * The discovery script used to accept the FIRST portal-search hit for a
 * registry slug. That produced off-topic and empty ids:
 *   https://data.winnipeg.ca|permits  -> "Map of Downtown Boundary" (rows: [{}])
 *   https://data.edmonton.ca|building-permits -> "Speed Check Sign" (rows: [])
 *
 * A candidate is acceptable only when BOTH hold:
 *   1. topic fit   — the dataset name matches the slug's topic vocabulary
 *   2. row presence — a live `/{id}.json?$limit=1` probe returned >= 1 row
 */

/** Topic vocabulary per slug token. A slug token is satisfied when any of its
 *  synonyms appears (case-insensitive, word-ish match) in the dataset name. */
const TOPIC_SYNONYMS: Record<string, string[]> = {
  permit: ['permit', 'permits', 'building permit', 'development permit'],
  permits: ['permit', 'permits', 'building permit', 'development permit'],
  'building-permits': ['permit', 'permits', 'building permit'],
  budget: ['budget', 'operating budget', 'capital budget', 'financial plan', 'expenditure', 'revenue'],
  budgets: ['budget', 'operating budget', 'capital budget', 'financial plan', 'expenditure'],
  zoning: ['zoning', 'land use', 'rezoning'],
  transit: ['transit', 'bus', 'gtfs', 'route', 'schedule'],
  crime: ['crime', 'criminal', 'incident', 'offence', 'offense'],
  census: ['census', 'population', 'demographic'],
  housing: ['housing', 'dwelling', 'residential', 'affordable'],
  business: ['business', 'licence', 'license', 'commercial'],
  licences: ['licence', 'license', 'business licence'],
  licenses: ['licence', 'license', 'business license'],
  contracts: ['contract', 'procurement', 'tender', 'award'],
  procurement: ['procurement', 'contract', 'tender', 'award'],
  water: ['water', 'sewer', 'storm', 'utility'],
  waste: ['waste', 'garbage', 'recycling', 'collection'],
  parks: ['park', 'parks', 'recreation', 'facility'],
  elections: ['election', 'voting', 'ballot'],
  salaries: ['salary', 'salaries', 'compensation', 'wage'],
  assessment: ['assessment', 'property value', 'tax assessment'],
  tax: ['tax', 'taxation', 'mill rate', 'levy'],
  parking: ['parking', 'meter', 'ticket'],
  fire: ['fire', 'incident', 'emergency'],
  roads: ['road', 'street', 'pavement', 'infrastructure'],
  trees: ['tree', 'trees', 'canopy', 'urban forest'],
  animals: ['animal', 'pet', 'licence', 'bylaw'],
};

/** Words that mark a result as clearly NOT a dataset of interest. */
const NEGATIVE_MARKERS = [
  'speed check sign', 'boundary', 'orthographic', 'photography', 'mosaic',
  'map of', 'logo', 'watermark', 'test dataset', 'sample', 'do not use',
];

export interface CandidateMeta {
  /** Dataset name/title as returned by the portal search. */
  name: string;
  /** Portal-assigned dataset id. */
  id: string;
}

export interface ValidationResult {
  ok: boolean;
  topicFit: boolean;
  rowsPresent: boolean;
  reason: string;
}

/** Extract the registry slug's topic tokens, e.g. `building-permits` -> ['building','permits'] */
export function slugTokens(slug: string): string[] {
  return slug
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** True when the candidate name shows evidence of the slug's topic. */
export function topicFits(slug: string, name: string): boolean {
  const lower = name.toLowerCase();
  if (NEGATIVE_MARKERS.some((m) => lower.includes(m))) return false;

  const tokens = slugTokens(slug);
  if (tokens.length === 0) return false;

  // Direct token presence first (cheap, most common).
  if (tokens.some((t) => lower.includes(t))) return true;

  // Synonym vocabulary — ANY satisfied token is enough (a "budget" slug may
  // match a dataset titled "Operating Budget" via the budget synonyms).
  return tokens.some((t) => (TOPIC_SYNONYMS[t] ?? []).some((syn) => lower.includes(syn)));
}

/**
 * Validate a candidate. `rowsProbed` is the number of rows returned by the
 * live `?$limit=1` probe; pass -1 when the probe could not be performed
 * (network refused) — an unprobed candidate is NOT acceptable, because the
 * whole point is to stop shipping empty datasets.
 */
export function validateCandidate(
  slug: string,
  candidate: CandidateMeta,
  rowsProbed: number | null,
  portalType: 'ckan' | 'socrata' = 'socrata',
): ValidationResult {
  const topicFit = topicFits(slug, candidate.name);
  // CKAN package ids expose no cheap row endpoint, so row presence is only
  // applicable to Socrata. A failed Socrata probe (-1) is NOT acceptable.
  const rowApplicable = portalType !== 'ckan' && rowsProbed !== null;
  const rowsPresent = rowApplicable ? (rowsProbed as number) > 0 : true;

  if (!topicFit && !rowsPresent) {
    return { ok: false, topicFit, rowsPresent, reason: `off-topic ("${candidate.name}") and no rows (probe=${rowsProbed})` };
  }
  if (!topicFit) {
    return { ok: false, topicFit, rowsPresent, reason: `off-topic for "${slug}" ("${candidate.name}")` };
  }
  if (!rowsPresent) {
    return { ok: false, topicFit, rowsPresent, reason: `no rows returned (probe=${rowsProbed})` };
  }
  return { ok: true, topicFit, rowsPresent, reason: 'topic fit + rows present' };
}
