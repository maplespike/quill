// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { getNewItems, getSourceStats, registerSeen } from './signal-store.js';
import { searchCkan, fetchGazette, fetchCommittees } from './upstream-fetcher.js';
import { withClaims } from './claims-helper.js';

const WATCHED_SOURCES = [
  { key: 'committees', label: 'House/Senate Committees', fetch: () => fetchCommittees('', 20) },
  { key: 'gazette', label: 'Canada Gazette', fetch: () => fetchGazette('', 20) },
  { key: 'lobbying', label: 'Lobbying Registry', fetch: () => searchCkan('lobbying', 20) },
  { key: 'procurement', label: 'Federal Procurement', fetch: () => searchCkan('procurement contract', 20) },
  { key: 'oversight', label: 'Oversight Bodies', fetch: () => searchCkan('oversight', 20) },
];

export const definition: ToolDefinition = {
  name: 'signal_check',
  description:
    'Check for new or changed items across the government data sources this tool watches ' +
    '(committees, Gazette, lobbying, procurement, oversight). ' +
    'Returns items first seen since the last check, as recorded by this tool\'s local signal store; ' +
    'a source that did not respond yields no items rather than a negative finding. ' +
    'Use this proactively to detect new regulatory filings, committee activity, or lobbying registrations.',
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        items: { type: 'string', enum: WATCHED_SOURCES.map(s => s.key) },
        description: 'Sources to check (default: every watched source)',
      },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const requested = args.sources as string[] | undefined;
    const active = requested
      ? WATCHED_SOURCES.filter(s => requested.includes(s.key))
      : WATCHED_SOURCES;

    const findings: Array<{
      source: string;
      label: string;
      newItems: number;
      items: Array<{ id: string; title: string }>;
    }> = [];

    for (const src of active) {
      try {
        const result = await src.fetch();
        const results = (result as any)?.results ?? [];
        const ids = new Set<string>();

        for (const r of results) {
          const id = String(r.id || r.url || r.name || r.title || Math.random());
          ids.add(id);
        }

        const newItems = getNewItems(src.key, ids);

        // Register all seen items
        for (const r of results) {
          const id = String(r.id || r.url || r.name || r.title || '');
          if (id) registerSeen(src.key, id, String(r.title || r.name || ''));
        }

        findings.push({
          source: src.key,
          label: src.label,
          newItems: newItems.length,
          items: newItems.slice(0, 20).map(n => ({
            id: n.id,
            title: n.title,
          })),
        });
      } catch (err) {
        findings.push({
          source: src.key,
          label: src.label,
          newItems: -1,
          items: [{ id: 'error', title: `Check failed: ${(err as Error).message}` }],
        });
      }
    }

    const totalNew = findings.reduce((s, f) => s + Math.max(0, f.newItems), 0);
    const stats = getSourceStats();

    return {
      content: await withClaims({
        tool: 'signal_check',
        summary: {
          checkedAt: new Date().toISOString(),
          sourcesChecked: active.length,
          totalNewItems: totalNew,
          watchedSources: WATCHED_SOURCES.map(s => s.key),
        },
        findings: findings.filter(f => f.newItems !== 0),
        sourceStats: stats,
      }, findings.map(f => ({
        claim: `New items in ${f.label}: ${f.newItems}`,
        value: f,
        sourceName: f.label,
        sourceUrl: '',
        transformations: ['signal-detection'],
      }))),
    };
  } catch (error) {
    return {
      content: {
        tool: 'signal_check',
        status: 'error',
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
