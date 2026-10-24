// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { AccountEntry, AccountSummary } from './types.js';

export async function parseAccountEntry(
  raw: Record<string, unknown>,
  level: string,
): Promise<AccountEntry | null> {
  const category = raw.category ?? raw.accountType ?? raw.type;
  const fiscalYear = raw.fiscalYear ?? raw.year ?? raw.fiscal_year;
  const amount = raw.amount ?? raw.value ?? raw.total;
  const description = raw.description ?? raw.account ?? raw.name;

  if (!category || !fiscalYear || !description) return null;

  return {
    id: await computeHash(`${level}:${String(fiscalYear)}:${String(description)}`),
    level,
    category: String(category),
    fiscalYear: parseInt(String(fiscalYear), 10),
    amount: parseFloat(String(amount ?? 0)),
    description: String(description),
    currency: raw.currency ? String(raw.currency) : 'CAD',
  };
}

export async function parseAccountRecords(
  rawRecords: Record<string, unknown>[],
  level: string,
): Promise<AccountEntry[]> {
  const results: AccountEntry[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseAccountEntry(raw, level);
    if (parsed) results.push(parsed);
  }
  return results;
}

export function summarizeAccounts(entries: AccountEntry[]): AccountSummary {
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  return {
    totalEntries: entries.length,
    totalAmount: entries.reduce((s, e) => s + e.amount, 0),
    categories: Array.from(byCategory.entries()).map(([category, totalAmount]) => ({
      category,
      totalAmount,
      count: entries.filter(e => e.category === category).length,
    })),
  };
}
