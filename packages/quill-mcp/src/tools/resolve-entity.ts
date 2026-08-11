/**
 * MapleSpike MCP Tool — resolve_entity
 *
 * Resolves a person or organization name to all known mentions across
 * every ingestion module. Returns a consolidated profile with aliases,
 * source appearances, roles, and dates.
 *
 * Data sources: committees, lobbying, SEDI, corporate registry,
 * procurement, OpenCorporates, and all other modules.
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { resolveEntity } from '@maplespike/pipeline-core';
import { withClaims } from './claims-helper.js';

export const definition: ToolDefinition = {
  name: 'resolve_entity',
  description:
    'Resolve a person or organization name to all known mentions across every MapleSpike data source. ' +
    'Returns a consolidated profile with canonical name, aliases, all source appearances (committees, ' +
    'lobbying, procurement, corporate, etc.), roles, and dates. Use this when you need to find ' +
    'everything the system knows about a specific person or organization.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name to resolve — person (e.g. "John Smith") or organization (e.g. "Lockheed Martin Canada")',
      },
      type: {
        type: 'string',
        enum: ['person', 'organization', 'auto'],
        description: 'Entity type hint (default: auto-detect)',
      },
      threshold: {
        type: 'number',
        minimum: 0.5,
        maximum: 1.0,
        description: 'Fuzzy matching threshold (default: 0.7, higher = stricter)',
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
        tool: 'resolve_entity',
        query: '',
        error: 'No name provided. Please specify a person or organization name to resolve.',
      },
      isError: true,
    };
  }

  const type = (args.type as string) ?? 'auto';
  const threshold = (args.threshold as number) ?? 0.7;

  try {
    const result = resolveEntity(name, type, threshold);
    return {
      content: await withClaims({
        tool: 'resolve_entity',
        query: name,
        type: result.type,
        canonicalName: result.canonicalName,
        confidence: result.confidence,
        aliases: result.aliases,
        appearances: result.appearances,
        totalAppearances: result.appearances.length,
        summary: `${result.canonicalName} appears in ${result.appearances.length} record(s) across ${new Set(result.appearances.map(a => a.module)).size} module(s).`,
      }, result.appearances.map(a => ({
        claim: `Appearance in ${a.module}: ${a.role || 'mentioned'}${a.date ? ` (${a.date})` : ''}`,
        value: a,
        sourceName: a.module,
        sourceUrl: a.sourceUrl || '',
        transformations: ['entity-resolution'],
      }))),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Entity resolution failed';
    return {
      content: {
        tool: 'resolve_entity',
        query: name,
        error: message,
      },
      isError: true,
    };
  }
};
