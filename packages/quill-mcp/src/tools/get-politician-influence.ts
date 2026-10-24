// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchPoliticians, fetchParliamentVotes, fetchEntityCrossReference } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'get_politician_influence',
  description: 'Assembled influence profile for a Canadian politician. Combines MP info, lobbying meetings, voting records, and GIC appointments from openparliament.ca and CKAN. Name matching is approximate, so confirm the politician is the intended one; a missing section means no matching record was retrieved, not that no such record exists.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 2000, description: 'Politician name (e.g., "Justin Trudeau", "Pierre Poilievre", "Chrystia Freeland")' },
    },
    required: ['name'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const name = String(args.name ?? '').trim();
  if (!name) return { content: { tool: 'get_politician_influence', error: 'No name provided' }, isError: true };

  try {
    const [mpSearch, xref] = await Promise.all([
      fetchPoliticians(name, 5),
      fetchEntityCrossReference(name),
    ]);

    const mp = mpSearch.results[0] as Record<string, unknown> | undefined;

    return {
      content: {
        tool: 'get_politician_influence',
        query: name,
        mpFound: !!mp,
        mpDetails: mp ? {
          name: (mp.name as any)?.en || mp.name,
          party: (mp.current_party as any)?.short_name?.en || 'unknown',
          riding: (mp.current_riding as any)?.name?.en || 'unknown',
          photoUrl: mp.image || null,
        } : null,
        crossReferences: {
          lobbyingRecords: xref.lobbyingRecords,
          gicAppointments: xref.gicAppointments,
        },
        openParliamentUrl: mp?.url ? `https://api.openparliament.ca${mp.url}` : null,
        sources: ['api.openparliament.ca', 'ouvert.canada.ca'],
      },
    };
  } catch (error) {
    return { content: { tool: 'get_politician_influence', status: 'error', error: (error as Error).message }, isError: true };
  }
};
