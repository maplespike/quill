// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike MCP Tool — linked_entities
 *
 * "What does each registry say about X?" — one call assembling evidence
 * across lobbying, GIC, committees, corporate, CanLII, elections, and more,
 * with per-registry confidence. A thin adapter over the populated entity
 * graph (shared resolver in @maplespike/pipeline-core) — not a new engine.
 *
 * This is the composition surface of the WS-2 cross-reference hub: other
 * MCPs and agents can call it to link a named entity across registries
 * without re-implementing ingestion or entity resolution.
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { crossReferenceEntity, toEntityUri } from '@maplespike/pipeline-core';
import { withClaims } from './claims-helper.js';

export const definition: ToolDefinition = {
  name: 'linked_entities',
  description:
    'Cross-reference an entity across the registries Quill currently tracks (lobbying, GIC, committees, corporate, CanLII, elections, oversight, municipal, provincial). ' +
    'Resolves the name to its canonical entity, then assembles per-registry evidence with confidence. ' +
    'A registry with no linked record returns no hits; confidence is a resolver score, not a source attestation. ' +
    'Use this to answer "what does each registry say about X" in a single call.',
  descriptions: {
    "fr-CA": "Référencer une entité dans tous les registres suivis par Quill (lobbying, GIC, comités, entreprises, CanLII, élections, surveillance, municipal, provincial) avec un niveau de confiance par registre.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        maxLength: 500,
        description: 'Entity name to cross-reference (person or organization)',
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
        description: 'Fuzzy matching threshold (default: 0.7)',
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
        tool: 'linked_entities',
        query: '',
        error: 'No name provided. Specify a person or organization to cross-reference.',
      },
      isError: true,
    };
  }

  const type = (args.type as string) ?? 'auto';
  const threshold = (args.threshold as number) ?? 0.7;

  try {
    const ref = crossReferenceEntity({ name, type, threshold });

    if (!ref) {
      return {
        content: {
          tool: 'linked_entities',
          query: name,
          error:
            `No resolved entity found for "${name}". The entity graph may be sparse — ` +
            `run the cross-reference ingestion (ROADMAP Phase 5.3 §Ph10) to populate it, ` +
            `or try get_entity_profile for live upstream cross-reference.`,
        },
        isError: true,
      };
    }

    const { entity, registries, connections, connectionCount } = ref;

    return {
      content: await withClaims({
        tool: 'linked_entities',
        query: name,
        entity: {
          id: entity.id,
          uri: toEntityUri(entity.id),
          canonicalName: entity.canonicalName,
          type: entity.type,
          confidence: entity.confidence,
          aliases: entity.aliases,
        },
        registries,
        totalAppearances: entity.appearances.length,
        connectionCount,
        connections,
        summary:
          `${entity.canonicalName} appears in ${entity.appearances.length} record(s) across ` +
          `${registries.length} registry(/ies)` +
          (connectionCount > 0 ? ` and has ${connectionCount} known connection(s).` : '.'),
      }, entity.appearances.map(a => ({
        claim: `Appearance in ${a.module}: ${a.role || 'mentioned'}${a.date ? ` (${a.date})` : ''}`,
        value: a,
        sourceName: a.module,
        sourceUrl: a.sourceUrl || '',
        transformations: ['entity-resolution', 'registry-grouping'],
      }))),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cross-reference failed';
    return {
      content: {
        tool: 'linked_entities',
        query: name,
        error: message,
      },
      isError: true,
    };
  }
};
