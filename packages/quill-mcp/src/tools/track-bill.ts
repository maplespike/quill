// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { fetchParliamentBills, fetchParliamentDebates, fetchParliamentVotes } from './upstream-fetcher.js';
import { withClaims } from './claims-helper.js';

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

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  if (!query) return { content: { tool: 'track_bill', error: 'No bill query provided' }, isError: true };

  try {
    const [billResult, debateResult, voteResult] = await Promise.all([
      fetchParliamentBills(query, 5),
      fetchParliamentDebates(query, 5),
      fetchParliamentVotes(query, 5),
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

    return {
      content: await withClaims({
        tool: 'track_bill',
        query,
        bills,
        relatedDebates,
        votes,
        crossReferences: {
          totalBills: billResult.total,
          totalDebates: debateResult.total,
          totalVotes: voteResult.total,
        },
        sources: ['api.openparliament.ca/bills', 'api.openparliament.ca/debates', 'api.openparliament.ca/votes'],
      }, [
        ...bills.map(b => ({
          claim: `Bill ${b.number}: ${b.name}`,
          value: b,
          sourceName: 'Open Parliament (Bills)',
          sourceUrl: b.legisinfoUrl || 'https://api.openparliament.ca/bills/',
          transformations: ['cross-reference'],
        })),
        ...relatedDebates.map(d => ({
          claim: `Related debate: ${d.date} (#${d.number})`,
          value: d,
          sourceName: 'Open Parliament (Debates)',
          sourceUrl: d.url || 'https://api.openparliament.ca/debates/',
          transformations: ['cross-reference'],
        })),
        ...votes.map(v => ({
          claim: `Vote on ${v.date}: ${v.result}`,
          value: v,
          sourceName: 'Open Parliament (Votes)',
          sourceUrl: 'https://api.openparliament.ca/votes/',
          transformations: ['cross-reference'],
        })),
      ]),
    };
  } catch (error) {
    return { content: { tool: 'track_bill', status: 'error', error: (error as Error).message }, isError: true };
  }
};
