// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchEntityCrossReference } from './upstream-fetcher.js';
import { withClaims } from './claims-helper.js';

export const definition: ToolDefinition = {
  name: 'get_entity_profile',
  description: 'Cross-reference a person across MP, lobbying, and GIC data.',
  inputSchema: { type: 'object', properties: {
    name: { type: 'string', maxLength: 2000, description: 'Person name' },
  }, required: ['name'] },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const name = String(args.name ?? '').trim();
  if (!name) return { content: { tool: 'get_entity_profile', error: 'No name' }, isError: true };
  try {
    const profile = await fetchEntityCrossReference(name);
    return { content: await withClaims({
      tool: 'get_entity_profile', query: name, mpFound: !!profile.mp,
      mpDetails: profile.mp ? {
        name: (profile.mp as any).name?.en || (profile.mp as any).name,
        party: (profile.mp as any).current_party?.short_name?.en || 'unknown',
        riding: (profile.mp as any).current_riding?.name?.en || 'unknown',
      } : null,
      lobbyingRecords: profile.lobbyingRecords, gicAppointments: profile.gicAppointments,
    }, [
      ...(profile.mp ? [{
        claim: `MP profile for ${name}`,
        value: profile.mp,
        sourceName: 'Open Parliament',
        sourceUrl: (profile.mp as any)?.url ? `https://api.openparliament.ca${(profile.mp as any).url}` : '',
        transformations: ['entity-resolution'],
      }] : []),
      ...((profile.lobbyingRecords ?? 0) > 0 ? [{
        claim: `Lobbying records for ${name}`,
        value: { count: profile.lobbyingRecords },
        sourceName: 'Lobbying Registry',
        sourceUrl: '',
        transformations: ['entity-resolution'],
      }] : []),
      ...((profile.gicAppointments ?? 0) > 0 ? [{
        claim: `GIC appointments for ${name}`,
        value: { count: profile.gicAppointments },
        sourceName: 'Governor-in-Council Appointments',
        sourceUrl: '',
        transformations: ['entity-resolution'],
      }] : []),
    ]) };
  } catch (error) {
    return { content: { tool: 'get_entity_profile', status: 'error', error: (error as Error).message }, isError: true };
  }
};