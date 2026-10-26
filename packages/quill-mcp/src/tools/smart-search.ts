// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { fetchStatCanTable } from './statcan-helper.js';
import {
  searchCkan, fetchParliamentDebates, fetchParliamentBills, fetchParliamentVotes,
  fetchPoliticians, fetchGazette, fetchParliamentCommittees, searchSocrata,
} from './upstream-fetcher.js';

const SYNONYMS: Record<string, string[]> = {
  drug: ['pharmaceutical', 'medication', 'prescription', 'pharma', 'medicine'],
  health: ['healthcare', 'medical', 'phac', 'cihi', 'wellness'],
  economy: ['economic', 'gdp', 'inflation', 'cpi', 'trade', 'market'],
  tax: ['taxation', 'fiscal', 'revenue', 'levy'],
  environment: ['climate', 'green', 'emission', 'carbon', 'pollution'],
  defence: ['military', 'armed forces', 'dnd', 'veteran'],
  immigration: ['ircc', 'visa', 'refugee', 'citizenship', 'permit'],
  indigenous: ['first nations', 'metis', 'inuit', 'isc', 'rcaanc'],
  lobbying: ['lobby', 'influence', 'advocacy', 'registrant'],
  committee: ['standing committee', 'subcommittee', 'joint committee'],
  vote: ['voted', 'yea', 'nay', 'ballot', 'passed', 'defeated'],
  bill: ['legislation', 'act', 'proposed law', 'c-', 's-'],
  regulation: ['regulatory', 'gazette', 'sor', 'notice'],
  spending: ['budget', 'expenditure', 'grant', 'contract', 'procurement'],
  housing: ['cmhc', 'mortgage', 'rental', 'shelter', 'affordable'],
  labour: ['employment', 'unemployment', 'job', 'wage', 'union'],
  crime: ['criminal', 'police', 'rcmp', 'corrections', 'csc'],
  education: ['school', 'university', 'college', 'student', 'training'],
};

function expandQuery(query: string): string[] {
  const lower = query.toLowerCase();
  const expanded = new Set<string>([query]);
  for (const [word, syns] of Object.entries(SYNONYMS)) {
    if (lower.includes(word)) syns.forEach(s => expanded.add(s));
  }
  return Array.from(expanded);
}

interface SourceDef {
  name: string;
  keywords: string[];
  fetch: (q: string, limit: number) => Promise<{ results: Record<string, unknown>[]; total: number }>;
}

const SOURCES: SourceDef[] = [
  { name: 'parliament_debates', keywords: ['debate', 'hansard', 'parliament', 'house of commons', 'said', 'speaker'], fetch: (q, l) => fetchParliamentDebates(q, l) },
  { name: 'parliament_bills', keywords: ['bill', 'legislation', 'c-', 's-', 'law', 'proposed', 'enacted'], fetch: (q, l) => fetchParliamentBills(q, l) },
  { name: 'parliament_votes', keywords: ['vote', 'voted', 'yea', 'nay', 'passed', 'defeated', 'ballot'], fetch: (q, l) => fetchParliamentVotes(q, l) },
  { name: 'parliament_mps', keywords: ['mp', 'member', 'politician', 'member of parliament', 'party', 'riding'], fetch: (q, l) => fetchPoliticians(q, l) },
  { name: 'parliament_committees', keywords: ['committee', 'standing committee', 'study', 'witness'], fetch: (q, l) => fetchParliamentCommittees(q, l) },
  { name: 'gazette', keywords: ['regulation', 'gazette', 'regulatory', 'notice', 'sor'], fetch: (q, l) => fetchGazette(q, l) },
  { name: 'government_health', keywords: ['health', 'healthcare', 'medical', 'drug', 'pharmaceutical', 'recall', 'covid'], fetch: (q, l) => searchCkan(q + ' health', l) },
  { name: 'government_economy', keywords: ['economy', 'gdp', 'inflation', 'cpi', 'trade', 'fiscal'], fetch: (q, l) => searchCkan(q + ' economy', l) },
  { name: 'government_environment', keywords: ['environment', 'climate', 'emission', 'carbon', 'pollution', 'weather'], fetch: (q, l) => searchCkan(q + ' environment', l) },
  { name: 'government_immigration', keywords: ['immigration', 'ircc', 'visa', 'refugee', 'citizenship'], fetch: (q, l) => searchCkan(q + ' immigration', l) },
  { name: 'government_labour', keywords: ['labour', 'employment', 'unemployment', 'job', 'wage', 'union'], fetch: (q, l) => searchCkan(q + ' labour', l) },
  { name: 'government_spending', keywords: ['spending', 'budget', 'expenditure', 'contract', 'procurement', 'grant'], fetch: (q, l) => searchCkan(q + ' spending', l) },
  { name: 'government_housing', keywords: ['housing', 'cmhc', 'mortgage', 'rental', 'shelter'], fetch: (q, l) => searchCkan(q + ' housing', l) },
  { name: 'government_crime', keywords: ['crime', 'police', 'rcmp', 'criminal', 'justice', 'courts'], fetch: (q, l) => searchCkan(q + ' crime', l) },
  { name: 'government_defence', keywords: ['defence', 'military', 'dnd', 'veteran', 'armed forces'], fetch: (q, l) => searchCkan(q + ' defence', l) },
  { name: 'government_indigenous', keywords: ['indigenous', 'first nations', 'metis', 'inuit', 'native'], fetch: (q, l) => searchCkan(q + ' indigenous', l) },
  { name: 'province_ns', keywords: ['nova scotia', 'halifax', 'ns '], fetch: (q, l) => searchSocrata('novascotia', q, l) },
  { name: 'province_nb', keywords: ['new brunswick', 'fredericton', 'nb '], fetch: (q, l) => searchSocrata('newbrunswick', q, l) },
  { name: 'government_general', keywords: [], fetch: (q, l) => searchCkan(q, l) },
];

function detectSources(query: string): SourceDef[] {
  const lower = query.toLowerCase();
  const matched = SOURCES.filter(s => s.keywords.length > 0 && s.keywords.some(k => lower.includes(k)));
  return matched.length > 0 ? matched : [SOURCES[SOURCES.length - 1]];
}

// #3: Time-series
const TIME_TABLES: Record<string, { id: string; label: string }> = {
  cpi: { id: '18100004', label: 'Consumer Price Index' },
  gdp: { id: '36100114', label: 'Gross Domestic Product' },
  population: { id: '17100009', label: 'Population estimates' },
  labour: { id: '14100270', label: 'Labour force' },
};

function detectTimeSeries(query: string): string | null {
  const l = query.toLowerCase();
  if (l.includes('cpi') || l.includes('inflation')) return 'cpi';
  if (l.includes('gdp') || l.includes('economic growth')) return 'gdp';
  if (l.includes('population')) return 'population';
  if (l.includes('unemployment') || l.includes('labour') || l.includes('jobs')) return 'labour';
  return null;
}

async function fetchTimeSeries(key: string, limit = 20): Promise<{ label: string; data: Record<string, unknown>[]; source: string } | null> {
  const t = TIME_TABLES[key];
  if (!t) return null;
  try {
    const { rows } = await fetchStatCanTable(t.id);
    return { label: t.label, data: rows.slice(0, limit), source: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=' + t.id };
  } catch { return null; }
}

// #4: Citations
function buildMeta(source: string, count: number) {
  return {
    source,
    totalEntries: count,
    retrievedAt: new Date().toISOString(),
    license: 'Dataset-specific publisher license declarations are included on individual results where supplied; no blanket source license is asserted.',
  };
}

// #5: Trends
async function fetchTrends(limit = 5) {
  const r: Record<string, { items: Record<string, unknown>[]; total: number }> = {};
  for (const [name, fn] of Object.entries({
    gazette: () => fetchGazette('', limit),
    debates: () => fetchParliamentDebates('', limit),
    bills: () => fetchParliamentBills('', limit),
  })) {
    try { const d = await fn(); r[name] = { items: d.results, total: d.total }; } catch { r[name] = { items: [], total: 0 }; }
  }
  return r;
}

// ── Tool ────────────────────────────────────────────────────────────

export const definition: ToolDefinition = {
  name: 'smart_search',
  description:
    'Intent-aware search across the Canadian government data sources this tool is configured to reach. ' +
    'Understands intent, expands synonyms, detects time-series queries, and summarizes recent changes. ' +
    'Configured sources include Parliament (debates, bills, votes, MPs, committees), Gazette (regulations), and ' +
    'government open data (health, economy, environment, immigration, spending, etc.) — coverage varies by source availability, ' +
    'so results reflect only the sources that responded.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Question or keywords (e.g., "inflation trends", "health regulations", "what changed this week")' },
      mode: { type: 'string', enum: ['search', 'trends'], default: 'search', description: '"search" or "trends"' },
      limit: { type: 'number', minimum: 1, maximum: 30, default: 5 },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const mode = (args.mode as string) || 'search';
  const limit = Math.min((args.limit as number) ?? 5, 30);

  // Trends mode
  if (mode === 'trends') {
    try {
      const trends = await fetchTrends(limit);
      return { content: {
        tool: 'smart_search', mode: 'trends',
        trends: Object.entries(trends).map(([s, d]) => ({ source: s, total: d.total, items: d.items.map((i: Record<string, unknown>) => ({ title: (i.title || i.name || "").toString().slice(0, 200) })) })),
        ...buildMeta('multiple', Object.values(trends).reduce((a, t) => a + t.total, 0)),
      } };
    } catch (e) { return { content: { tool: 'smart_search', error: (e as Error).message }, isError: true }; }
  }

  // Search mode
  const query = String(args.query ?? '').trim();
  if (!query) return { content: { tool: 'smart_search', error: 'No query' }, isError: true };

  const expanded = expandQuery(query);
  const sources = detectSources(query);
  const timeKey = detectTimeSeries(query);

  const [searchRes, tsData] = await Promise.all([
    Promise.allSettled(sources.map(s => s.fetch(query, limit).then(r => ({ source: s.name, ...r })))),
    timeKey ? fetchTimeSeries(timeKey, limit) : Promise.resolve(null),
  ]);

  const results: Record<string, { results: Record<string, unknown>[]; total: number }> = {};
  let total = 0;
  for (const r of searchRes) {
    if (r.status === 'fulfilled') { results[r.value.source] = { results: r.value.results, total: r.value.total }; total += r.value.total; }
  }

  return {
    content: {
      tool: 'smart_search', mode: 'search', query,
      synonyms: expanded.slice(1),
      sourcesSearched: Object.keys(results),
      timeSeries: tsData,
      results, totalResults: total,
      ...buildMeta(sources[0]?.name ?? 'ckan', total),
    },
  };
};
