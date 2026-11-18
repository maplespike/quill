// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike MCP Tool — find_connections
 *
 * Discovers the network of relationships around a person or organization.
 * Returns connected entities, relationship types, and confidence scores.
 *
 * Enables conflict-of-interest detection: "Did this lobbyist also work for
 * government?", "Who in this committee has financial ties to the bill's
 * stakeholders?"
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { resolveEntity, findConnections } from '@maplespike/pipeline-core';
import { withClaims } from './claims-helper.js';

export const definition: ToolDefinition = {
  name: 'find_connections',
  description:
    'Discover the relationship network around a person or organization. ' +
    'Returns connected entities (people, organizations), relationship types ' +
    '(employs, lobbies, directs, owns), and confidence scores. Use this for ' +
    'conflict-of-interest detection, influence mapping, and network analysis. ' +
    'Example: find who a committee witness is connected to via lobbying or corporate roles.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        maxLength: 2000,
        description: 'Name to center the network on — person or organization',
      },
      type: {
        type: 'string',
        enum: ['person', 'organization', 'auto'],
        description: 'Entity type hint (default: auto-detect)',
      },
      maxConnections: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum connections to return (default: 20)',
      },
    },
    required: ['name'],
  },
};

export const handler: ToolHandler = async (args) => {
  const name = (args.name as string)?.trim();
  if (!name) {
    return {
      content: {
        tool: 'find_connections',
        query: '',
        error: 'No name provided. Specify a person or organization to find connections for.',
      },
      isError: true,
    };
  }

  const maxConnections = Math.min((args.maxConnections as number) ?? 20, 50);

  try {
    const { center, connections } = findConnections(name);

    if (!center.id) {
      return {
        content: {
          tool: 'find_connections',
          query: name,
          error: `No entity found matching "${name}". Try a different name or check the entity resolution module.`,
        },
        isError: true,
      };
    }

    const limited = connections.slice(0, maxConnections);

    return {
      content: await withClaims({
        tool: 'find_connections',
        query: name,
        center: {
          canonicalName: center.canonicalName,
          type: center.type,
          confidence: center.confidence,
          aliases: center.aliases,
        },
        connections: limited.map((c) => ({
          relationship: c.relationshipType,
          weight: c.weight,
          source: c.source.canonicalName,
          sourceType: c.source.type,
          target: c.target.canonicalName,
          targetType: c.target.type,
          discoveredBy: c.sourceModule,
        })),
        totalConnections: connections.length,
        summary:
          connections.length > 0
            ? `${center.canonicalName} has ${connections.length} connection(s) across ${new Set(connections.map((c) => c.sourceModule)).size} source module(s).`
            : `${center.canonicalName} has no known connections in the entity graph.`,
      }, limited.map(c => ({
        claim: `Connection: ${center.canonicalName} —${c.relationshipType}→ ${c.target.canonicalName}`,
        value: c,
        sourceName: c.sourceModule,
        sourceUrl: '',
        transformations: ['entity-graph-traversal'],
      }))),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection discovery failed';
    return {
      content: {
        tool: 'find_connections',
        query: name,
        error: message,
      },
      isError: true,
    };
  }
};
