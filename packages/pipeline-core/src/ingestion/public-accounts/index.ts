// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import type { AttributedRecord } from '../../shared/attribution.js';
import { fetchAllPublicAccounts } from './fetcher.js';
import { parseAccountRecords, summarizeAccounts } from './parser.js';
import { PUBLIC_ACCOUNTS_SOURCES } from './constants.js';
import type { AccountEntry, AccountSummary } from './types.js';

function makeAttribution(name: string, url: string) {
  return buildAttribution(name, {
    sourceUrl: url,
    attributionText: `No publisher license declaration is attached to this source configuration. Consult ${name} terms for the specific dataset and material.`,
  });
}

export async function ingestAllPublicAccounts() {
  const results = await fetchAllPublicAccounts();

  const attributed: AttributedRecord[] = [];

  for (const r of results) {
    const entries = await parseAccountRecords(r.rawRecords, r.level);
    const source = PUBLIC_ACCOUNTS_SOURCES.find(s => s.level === r.level);
    const attribution = makeAttribution(r.name, source?.url ?? '');
    attributed.push(withAttribution({
      level: r.level,
      name: r.name,
      entries,
      summary: summarizeAccounts(entries),
      error: r.error,
    }, attribution));
  }
  return attributed;
}

export async function ingestPublicAccountsByLevel(level: string) {
  const results = await ingestAllPublicAccounts();
  return results.find(r => (r.data as { level: string }).level === level) ?? null;
}

export { PUBLIC_ACCOUNTS_SOURCES } from './constants.js';
// Aliases expected by module registry
export const ingestPublicAccounts = ingestAllPublicAccounts;
export async function getDepartmentSpending(department: string) {
  const results = await ingestAllPublicAccounts();
  return results.find(r => (r.data as { level: string }).level === department) ?? null;
}

export type { AccountEntry, AccountSummary } from './types.js';
