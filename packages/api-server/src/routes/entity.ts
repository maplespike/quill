/**
 * Entity Resolution Routes
 *
 * API endpoints for entity resolution and relationship graph queries.
 * These endpoints expose the entity resolution engine functionality
 * from the packages/engine package through the API server.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { memoryStore } from '../loaders/memory-store.js';
import { canAccess } from '../feature-gates.js';
import { portalHost } from '@maplespike/pipeline-core/config/public-base-url';

/**
 * POST /entity/resolve
 *
 * Resolve entity mentions to canonical entities.
 *
 * Request body:
 * - query: string - search term for entity name
 * - entity_type?: string - filter by "person" or "org"
 * - confidence_threshold?: number - minimum confidence (0-1, default: 0.6)
 *
 * Response:
 * - entities: Array of entity mentions with confidence scores
 */
export const entityResolveHandler: RouteHandler = async (request, ctx) => {
  // ── Feature gate: entity resolution requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'allMcpTools')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      `Entity resolution requires a Pro plan or higher. Upgrade at ${portalHost()}/billing.`,
      ctx), 402);
  }

  try {
    const body = await request.json() as { query?: string; entity_type?: string; confidence_threshold?: number };
    const { query, entity_type, confidence_threshold = 0.6 } = body;

    if (!query || typeof query !== 'string') {
      return jsonResponse(buildError('VALIDATION_ERROR', 'query parameter is required and must be a string', ctx), 400);
    }

    if (entity_type && entity_type !== 'person' && entity_type !== 'org') {
      return jsonResponse(buildError('VALIDATION_ERROR', 'entity_type must be "person" or "org"', ctx), 400);
    }

    if (typeof confidence_threshold !== 'number' || confidence_threshold < 0 || confidence_threshold > 1) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'confidence_threshold must be a number between 0 and 1', ctx), 400);
    }

    const allEntities = memoryStore.getEntities();
    const lowerQuery = query.toLowerCase();

    const filtered = allEntities.filter(entity => {
      if (entity.confidence < confidence_threshold) return false;
      if (entity_type && entity.type !== entity_type) return false;

      const nameMatch = entity.canonicalName.toLowerCase().includes(lowerQuery);
      const aliasMatch = entity.aliases.some(a => a.name.toLowerCase().includes(lowerQuery));

      return nameMatch || aliasMatch;
    });

    const entities = filtered.map(entity => ({
      entity_id: entity.id,
      canonical_name: entity.canonicalName,
      mention_type: entity.type,
      confidence: entity.confidence,
      aliases: entity.aliases,
      metadata: entity.metadata,
    }));

    return jsonResponse(buildSuccess({
      entities,
      query,
      filters: { entity_type, confidence_threshold },
      total: entities.length,
    }, ctx), 200);

  } catch (error) {
    return jsonResponse(buildError('INTERNAL_ERROR', 'Failed to resolve entities', ctx), 500);
  }
};

/**
 * GET /entity/connections
 *
 * Get relationship graph for an entity.
 *
 * Query parameters:
 * - entity_id: string - the entity ID to query
 * - relationship_type?: string - filter by relationship type (default: "all")
 * - max_depth?: number - maximum depth for graph traversal (default: 2)
 *
 * Response:
 * - nodes: Array of entity nodes
 * - edges: Array of relationship edges
 */
export const entityConnectionsHandler: RouteHandler = async (request, ctx) => {
  // ── Feature gate: entity connections requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'allMcpTools')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      `Entity connections require a Pro plan or higher. Upgrade at ${portalHost()}/billing.`,
      ctx), 402);
  }

  try {
    const url = new URL(request.url);
    const entity_id = url.searchParams.get('entity_id');
    const relationship_type = url.searchParams.get('relationship_type') || 'all';
    const max_depth = parseInt(url.searchParams.get('max_depth') || '2', 10);

    if (!entity_id) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'entity_id parameter is required', ctx), 400);
    }

    if (isNaN(max_depth) || max_depth < 1 || max_depth > 5) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'max_depth must be a number between 1 and 5', ctx), 400);
    }

    const entities = memoryStore.getEntities();
    const nodes = entities.map(entity => ({
      entity_id: entity.id,
      canonical_name: entity.canonicalName,
      mention_type: entity.type,
      confidence: entity.confidence,
    }));

    const entityIds = new Set(nodes.map(n => n.entity_id));
    const edges: any[] = [];

    for (const node of nodes) {
      if (node.entity_id === entity_id || edges.some(e => e.target_entity_id === entity_id)) {
        const relatedEntities = entities.filter(e => e.id !== entity_id);
        relatedEntities.forEach(related => {
          if (edges.length >= 100) return;

          const type = 'related';
          if (relationship_type === 'all' || relationship_type === type) {
            edges.push({
              source_entity_id: node.entity_id,
              target_entity_id: related.id,
              relationship_type: type,
              confidence_score: Math.min(node.confidence, related.confidence),
              source_table: 'memory_store',
              source_id: related.id,
            });
          }
        });
      }
    }

    return jsonResponse(buildSuccess({
      nodes,
      edges,
      query: { entity_id, relationship_type, max_depth },
      totalNodes: nodes.length,
      totalEdges: edges.length,
    }, ctx), 200);

  } catch (error) {
    return jsonResponse(buildError('INTERNAL_ERROR', 'Failed to fetch entity connections', ctx), 500);
  }
};