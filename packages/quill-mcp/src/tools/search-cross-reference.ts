/**
 * MapleSpike MCP Tool — search_cross_reference
 *
 * Cross-reference engine — links entities across committees, corporate,
 * lobbying, GIC, elections, CanLII, and influence modules.
 *
 * WS-2 rewrite: this is now graph-backed (queries entity_links/entities via
 * the shared resolver in @maplespike/pipeline-core) instead of the old
 * CKAN keyword facade. Returns
 * per-registry hits with link confidence for a named entity.
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { resolveEntity, findConnections, toEntityUri } from '@maplespike/pipeline-core';
import { searchCkan } from './upstream-fetcher.js';

/** Map entity_mentions.module_name → canonical registry bucket. */
const MODULE_TO_REGISTRY: Record<string, string> = {
  lobbying: 'lobbying',
  'provincial-lobbying': 'lobbying',
  'ontario-lobbying': 'lobbying',
  'quebec-lobbying': 'lobbying',
  gic: 'gic',
  committees: 'committees',
  'parliamentary-voting': 'committees',
  debates: 'committees',
  corporate: 'corporate',
  'corporate-filings': 'corporate',
  'sedar-plus': 'corporate',
  'crown-corporations': 'corporate',
  'cra-charity': 'corporate',
  'proactive-disclosure': 'corporate',
  procurement: 'corporate',
  contracts: 'corporate',
  canlii: 'canlii',
  a2aj: 'canlii',
  legislation: 'canlii',
  elections: 'elections',
  oversight: 'oversight',
  municipal: 'municipal',
  'municipal-long-tail': 'municipal',
  'regional-authorities': 'municipal',
  provincial: 'provincial',
  'provincial-ckan': 'provincial',
  'provincial-legislatures': 'provincial',
};

function registryForModule(moduleName: string): string {
  return MODULE_TO_REGISTRY[moduleName] ?? 'other';
}

export const definition: ToolDefinition = {
  name: 'search_cross_reference',
  description:
    'Cross-reference engine — resolves an entity name across committees, corporate, lobbying, GIC, elections, CanLII, and influence modules. ' +
    'Returns per-registry hits with link confidence (graph-backed, not keyword search); ' +
    'a registry with no linked record contributes no hits. ' +
    'Use this to see what each linked registry says about a person or organization.',
  descriptions: {
    "fr-CA": "Moteur de référence croisée — résout un nom d'entité dans les comités, entreprises, lobbying, GIC, élections, CanLII et modules d'influence, avec confiance par registre.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Entity name to cross-reference (person or organization, e.g. "John Smith" or "Lockheed Martin Canada")',
      },
      limit: {
        type: 'number',
        description: 'Max results per registry (default 20)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.max(1, Math.min(Number(args.limit ?? 20), 100));

  if (!query) {
    return {
      content: {
        tool: 'search_cross_reference',
        query: '',
        error: 'No entity name provided. Pass a person or organization name to cross-reference.',
      },
      isError: true,
    };
  }

  try {
    const entity = resolveEntity(query, 'auto', 0.6);

    if (!entity.id) {
      // Graph miss — degrade gracefully to the keyword search instead of
      // hard-erroring (the tool is paid/standard and previously accepted
      // arbitrary keywords). The `note` keeps the graph-backed intent
      // explicit: this is a fallback, not the primary path.
      try {
        const result = await searchCkan(query, limit);
        return {
          content: {
            tool: 'search_cross_reference',
            query,
            limit,
            graph: false,
            note:
              `No resolved entity found for "${query}" in the cross-reference graph — ` +
              `returned keyword matches instead. Run the cross-reference ingestion to populate ` +
              `the entity graph (ROADMAP Phase 5.3 §Ph10), or try get_entity_profile for live ` +
              `upstream cross-reference.`,
            ...result,
          },
        };
      } catch (fallbackErr) {
        return {
          content: {
            tool: 'search_cross_reference',
            query,
            graph: false,
            error:
              `No resolved entity found for "${query}" and the keyword fallback failed: ` +
              `${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}. ` +
              `Populate the entity graph to enable cross-registry linking.`,
          },
          isError: true,
        };
      }
    }

    // Group appearances by canonical registry bucket.
    const byRegistry = new Map<string, typeof entity.appearances>();
    for (const appearance of entity.appearances) {
      const registry = registryForModule(appearance.module);
      const list = byRegistry.get(registry) ?? [];
      list.push(appearance);
      byRegistry.set(registry, list);
    }

    const registries = Array.from(byRegistry.entries())
      .map(([registry, appearances]) => ({
        registry,
        count: appearances.length,
        modules: Array.from(new Set(appearances.map(a => a.module))),
        confidence: Math.round(entity.confidence * 100) / 100,
        hits: appearances.slice(0, limit).map(a => ({
          module: a.module,
          role: a.role,
          date: a.date,
          summary: a.summary,
          sourceUrl: a.sourceUrl,
        })),
      }))
      .sort((a, b) => b.count - a.count);

    // Connections (relationship layer).
    const { connections } = findConnections(entity.canonicalName, 1, 0.6);
    const totalLinks = entity.appearances.length + connections.length;

    return {
      content: {
        tool: 'search_cross_reference',
        query,
        limit,
        graph: true,
        entity: {
          id: entity.id,
          uri: toEntityUri(entity.id),
          canonicalName: entity.canonicalName,
          type: entity.type,
          confidence: entity.confidence,
        },
        registries,
        totalLinks,
        connectionCount: connections.length,
        summary:
          `${entity.canonicalName} has ${totalLinks} cross-reference link(s) across ` +
          `${registries.length} registry(/ies) with confidence ${Math.round(entity.confidence * 100)}%.`,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_cross_reference',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
