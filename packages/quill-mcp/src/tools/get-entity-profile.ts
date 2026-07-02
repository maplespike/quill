// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchEntityCrossReference } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'get_entity_profile',
  description: 'Cross-reference a person across MP, lobbying, and GIC data.',
  inputSchema: { type: 'object', properties: {
    name: { type: 'string', description: 'Person name' },
  }, required: ['name'] },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const name = String(args.name ?? '').trim();
  if (!name) return { content: { tool: 'get_entity_profile', error: 'No name' }, isError: true };
  try {
    const profile = await fetchEntityCrossReference(name);
    return { content: {
      tool: 'get_entity_profile', query: name, mpFound: !!profile.mp,
      mpDetails: profile.mp ? {
        name: (profile.mp as any).name?.en || (profile.mp as any).name,
        party: (profile.mp as any).current_party?.short_name?.en || 'unknown',
        riding: (profile.mp as any).current_riding?.name?.en || 'unknown',
      } : null,
      lobbyingRecords: profile.lobbyingRecords, gicAppointments: profile.gicAppointments,
    } };
  } catch (error) {
    return { content: { tool: 'get_entity_profile', status: 'error', error: (error as Error).message }, isError: true };
  }
};