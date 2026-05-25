// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { fetchParliamentBills, fetchParliamentDebates, fetchParliamentVotes } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'track_bill',
  description: 'Track a Canadian federal bill through Parliament. Combines bill status, related debates, voting records, and regulatory impact from multiple sources. Use this to follow legislation end-to-end.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Bill number or keyword (e.g., "C-", "S-", "budget implementation")' },
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

    return {
      content: {
        tool: 'track_bill',
        query,
        bills: billResult.results.map((b: Record<string, unknown>) => ({
          number: b.number, name: (b.name as any)?.en || b.name, session: b.session, introduced: b.introduced,
          legisinfoUrl: b.url ? `https://api.openparliament.ca${b.url}` : null,
        })),
        relatedDebates: debateResult.results.map((d: Record<string, unknown>) => ({
          date: d.date, number: d.number, url: d.url ? `https://api.openparliament.ca${d.url}` : null,
        })),
        votes: voteResult.results.map((v: Record<string, unknown>) => ({
          date: v.date, description: (v.description as any)?.en || v.description,
          result: v.result, yea: v.yea_total, nay: v.nay_total,
        })),
        crossReferences: {
          totalBills: billResult.total,
          totalDebates: debateResult.total,
          totalVotes: voteResult.total,
        },
        sources: ['api.openparliament.ca/bills', 'api.openparliament.ca/debates', 'api.openparliament.ca/votes'],
      },
    };
  } catch (error) {
    return { content: { tool: 'track_bill', status: 'error', error: (error as Error).message }, isError: true };
  }
};
