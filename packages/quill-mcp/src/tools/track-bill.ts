// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { fetchParliamentBills, fetchParliamentDebates, fetchParliamentVotes } from './upstream-fetcher.js';
import { withClaims } from './claims-helper.js';
import { applySourcePolicy, presentParliamentaryToolResult, type ParliamentaryChamber } from '@maplespike/pipeline-core';


function chamberForBillQuery(query: string): ParliamentaryChamber {
  const senate = /\bS-\d/i.test(query);
  const commons = /\bC-\d/i.test(query);
  if (senate && !commons) return 'senate';
  if (commons && !senate) return 'commons';
  return 'both';
}

export const definition: ToolDefinition = {
  name: 'track_bill',
  description: 'Track a Canadian federal bill through Parliament. Combines bill status, related debates, voting records, and regulatory impact from multiple sources. Use this to follow legislation end-to-end.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Bill number or keyword (e.g., "C-", "S-", "budget implementation")' },
    },
    required: ['query'],
  },
};

/** Core tracker — injectable fetchers for tests. Results are discovery-only. */
export async function runTrackBill(
  args: { query?: string },
  fetchers: {
    bills?: typeof fetchParliamentBills;
    debates?: typeof fetchParliamentDebates;
    votes?: typeof fetchParliamentVotes;
  } = {},
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '').trim();
  const chamber = chamberForBillQuery(query);
  if (!query) return presentParliamentaryToolResult({ content: { tool: 'track_bill', error: 'No bill query provided' }, isError: true }, { chamber: chamber });

  const fetchBills = fetchers.bills ?? fetchParliamentBills;
  const fetchDebates = fetchers.debates ?? fetchParliamentDebates;
  const fetchVotes = fetchers.votes ?? fetchParliamentVotes;

  try {
    const [billResult, debateResult, voteResult] = await Promise.all([
      fetchBills(query, 5),
      fetchDebates(query, 5),
      fetchVotes(query, 5),
    ]);

    const bills = billResult.results.map((b: Record<string, unknown>) => ({
      number: b.number, name: (b.name as any)?.en || b.name, session: b.session, introduced: b.introduced,
      legisinfoUrl: b.url ? `https://api.openparliament.ca${b.url}` : null,
    }));
    const relatedDebates = debateResult.results.map((d: Record<string, unknown>) => ({
      date: d.date, number: d.number, url: d.url ? `https://api.openparliament.ca${d.url}` : null,
    }));
    const votes = voteResult.results.map((v: Record<string, unknown>) => ({
      date: v.date, description: (v.description as any)?.en || v.description,
      result: v.result, yea: v.yea_total, nay: v.nay_total,
    }));

    const billsApplied = applySourcePolicy('openparliament', bills);
    const debatesApplied = applySourcePolicy('openparliament', relatedDebates);
    const votesApplied = applySourcePolicy('openparliament', votes);
    const servedBills = billsApplied.records as typeof bills;
    const servedDebates = debatesApplied.records as typeof relatedDebates;
    const servedVotes = votesApplied.records as typeof votes;

    return presentParliamentaryToolResult({
      content: await withClaims({
        tool: 'track_bill',
        query,
        bills: servedBills,
        relatedDebates: servedDebates,
        votes: servedVotes,
        policy: billsApplied.policy,
        crossReferences: {
          totalBills: billResult.total,
          totalDebates: debateResult.total,
          totalVotes: voteResult.total,
        },
        sources: ['api.openparliament.ca/bills', 'api.openparliament.ca/debates', 'api.openparliament.ca/votes'],
      }, [
        ...servedBills.map(b => ({
          claim: `Bill ${b.number}: ${b.name}`,
          value: b,
          sourceName: 'Open Parliament (Bills)',
          sourceUrl: b.legisinfoUrl || 'https://api.openparliament.ca/bills/',
          transformations: ['cross-reference'],
        })),
        ...servedDebates.map(d => ({
          claim: `Related debate: ${d.date} (#${d.number})`,
          value: d,
          sourceName: 'Open Parliament (Debates)',
          sourceUrl: d.url || 'https://api.openparliament.ca/debates/',
          transformations: ['cross-reference'],
        })),
        ...servedVotes.map(v => ({
          claim: `Vote on ${v.date}: ${v.result}`,
          value: v,
          sourceName: 'Open Parliament (Votes)',
          sourceUrl: 'https://api.openparliament.ca/votes/',
          transformations: ['cross-reference'],
        })),
      ]),
    }, { chamber: chamber });
  } catch (error) {
    return presentParliamentaryToolResult({ content: { tool: 'track_bill', status: 'error', error: (error as Error).message }, isError: true }, { chamber: chamber });
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runTrackBill({ query: args.query as string | undefined });
};
