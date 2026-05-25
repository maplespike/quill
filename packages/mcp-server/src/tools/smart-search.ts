// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { fetchStatCanTable } from './statcan-helper.js';
import {
  searchCkan, fetchParliamentDebates, fetchParliamentBills, fetchParliamentVotes,
  fetchPoliticians, fetchGazette, fetchParliamentCommittees,
} from './upstream-fetcher.js';

// ── Intent → Source mapping ─────────────────────────────────────────

interface SourceDef {
  name: string;
  keywords: string[];
  fetch: (q: string, limit: number) => Promise<{ results: Record<string, unknown>[]; total: number }>;
}

const SOURCES: SourceDef[] = [
  { name: 'parliament_debates', keywords: ['debate', 'hansard', 'parliament', 'house of commons', 'said', 'speaker'], fetch: (q, l) => fetchParliamentDebates(q, l) },
  { name: 'parliament_bills', keywords: ['bill', 'legislation', 'c-', 's-', 'law', 'proposed', 'enacted'], fetch: (q, l) => fetchParliamentBills(q, l) },
  { name: 'parliament_votes', keywords: ['vote', 'voted', 'yea', 'nay', 'passed', 'defeated', 'majority'], fetch: (q, l) => fetchParliamentVotes(q, l) },
  { name: 'parliament_mps', keywords: ['mp', 'member', 'politician', 'member of parliament', 'party', 'riding'], fetch: (q, l) => fetchPoliticians(q, l) },
  { name: 'parliament_committees', keywords: ['committee', 'standing committee', 'study', 'witness'], fetch: (q, l) => fetchParliamentCommittees(q, l) },
  { name: 'gazette', keywords: ['regulation', 'gazette', 'regulatory', 'notice', 'proposed regulation'], fetch: (q, l) => fetchGazette(q, l) },
  { name: 'government_ckan', keywords: ['program', 'grant', 'funding', 'department', 'agency', 'data', 'report', 'canada'], fetch: (q, l) => searchCkan(q, l) },
];

function detectSources(query: string): SourceDef[] {
  const lower = query.toLowerCase();
  const matched = SOURCES.filter(s => s.keywords.some(k => lower.includes(k)));
  return matched.length > 0 ? matched : [SOURCES[SOURCES.length - 1]]; // default: CKAN
}

// ── Tool definition ─────────────────────────────────────────────────

export const definition: ToolDefinition = {
  name: 'smart_search',
  description: 'Smart semantic search across all Canadian government data sources. Automatically detects the best sources for your question and searches them in parallel. Sources include: Parliament (debates, bills, votes, MPs, committees), Canada Gazette (regulations), and Government of Canada open data (programs, grants, spending, reports).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language question or search terms (e.g., "What bills are before parliament?", "Find regulations about carbon pricing", "How did MPs vote on the budget?")',
      },
      limit: {
        type: 'number', minimum: 1, maximum: 30, description: 'Results per source (default: 5)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 5, 30);
  if (!query) return { content: { tool: 'smart_search', error: 'No query provided' }, isError: true };

  try {
    const sources = detectSources(query);
    const results = await Promise.allSettled(
      sources.map(s => s.fetch(query, limit).then(r => ({ source: s.name, ...r })))
    );

    const sourceResults: Record<string, { results: Record<string, unknown>[]; total: number }> = {};
    let totalAll = 0;

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sourceResults[r.value.source] = { results: r.value.results, total: r.value.total };
        totalAll += r.value.total;
      }
    }

    return {
      content: {
        tool: 'smart_search',
        query,
        intent: {
          detectedSources: sources.map(s => s.name),
          primarySource: sources[0]?.name ?? 'government_ckan',
        },
        results: sourceResults,
        totalResults: totalAll,
        summary: `Searched ${Object.keys(sourceResults).length} source(s). Found ${totalAll} matching records.`,
        note: 'Results are from government open data sources (OGL-Canada). Verify critical information.',
      },
    };
  } catch (error) {
    return { content: { tool: 'smart_search', status: 'error', error: (error as Error).message }, isError: true };
  }
};
