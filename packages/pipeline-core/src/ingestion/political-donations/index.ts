// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import type { AttributedRecord } from '../../shared/attribution.js';
import { fetchAllDonations } from './fetcher.js';
import { parseContributions, summarizeContributions } from './parser.js';
import { DONATIONS_SOURCES } from './constants.js';

function makeAttribution(name: string, url: string) {
  return buildAttribution(name, {
    sourceUrl: url,
    attributionText: `No publisher license declaration is attached to this source configuration. Consult ${name} terms for the specific dataset and material.`,
  });
}

export async function ingestAllDonations() {
  const results = await fetchAllDonations();

  const attributed: AttributedRecord[] = [];

  for (const r of results) {
    const contributions = await parseContributions(r.rawDonations, r.jurisdiction);
    const source = DONATIONS_SOURCES.find(s => s.jurisdiction === r.jurisdiction);
    const attribution = makeAttribution(r.name, source?.url ?? '');
    attributed.push(withAttribution({
      jurisdiction: r.jurisdiction,
      name: r.name,
      contributions,
      summary: summarizeContributions(contributions),
      error: r.error,
    }, attribution));
  }
  return attributed;
}

export async function ingestDonationsByJurisdiction(jurisdiction: string) {
  const results = await ingestAllDonations();
  return results.find(r => (r.data as { jurisdiction: string }).jurisdiction === jurisdiction) ?? null;
}

export { DONATIONS_SOURCES } from './constants.js';
// Aliases expected by module registry
export const ingestDonations = ingestAllDonations;
export const ingestAllJurisdictions = ingestAllDonations;

export type { DonationAggregate, ContributionSummary } from './types.js';
