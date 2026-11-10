// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Entity Detail Routes
 *
 * REST surface for the `quill://entity/{id}` composition scheme and the
 * linked_entities cross-reference results. Non-MCP clients (other APIs,
 * local agent frameworks, journalists' tools) get the same entity graph and
 * the same per-registry cross-reference surface as the MCP tools, backed by
 * the shared resolver in @maplespike/pipeline-core.
 *
 * Endpoints:
 *   GET /v1/entities/{id}        — entity profile (id or quill://entity/... URI)
 *   GET /v1/entities/{id}/links  — per-registry cross-reference + connections
 *
 * Pricing (tier gating):
 *   - Entity profile: Pro+ (mirrors resolve_entity — micro, $0.001)
 *   - Cross-reference links: Business+ (mirrors linked_entities — premium, $0.10)
 * The free tier is discovery/metadata only (decision #803); both routes are
 * data queries and are NOT on the free-tier whitelist.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { canAccess } from '../feature-gates.js';
import {
  getEntityById,
  fromEntityUri,
  toEntityUri,
  crossReferenceEntity,
  entityGraphAvailable,
} from '@maplespike/pipeline-core';

/**
 * Normalize a route param into a raw entity id.
 *
 * The route pattern captures the raw URL-encoded segment, so a caller passing
 * `quill://entity/ent_1` sends `quill%3A%2F%2Fentity%2Fent_1` — decode first,
 * THEN strip the quill://entity/ prefix (if any).
 */
function normalizeEntityId(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // malformed encoding — fall through to fromEntityUri with the raw value
  }
  return fromEntityUri(decoded);
}

/**
 * Shared 404 response: distinguishes "entity graph not populated" (the
 * cross-reference ingestion hasn't run) from "id not found" so operators
 * know which remediation applies.
 */
function entityNotFoundResponse(raw: string, ctx: Parameters<RouteHandler>[1]): Response {
  const message = entityGraphAvailable()
    ? `No entity found for id "${raw}".`
    : `Entity graph not populated — run the cross-reference ingestion (engine run) to populate it, then retry.`;
  return jsonResponse(buildError('NOT_FOUND', message, ctx), 404);
}

/**
 * GET /v1/entities/{id}
 *
 * Returns the resolved entity profile: canonical name, type, confidence,
 * aliases, appearances, and the canonical `quill://entity/{id}` URI.
 *
 * Path param:
 * - id: raw entity id OR a full `quill://entity/{id}` URI
 *
 * Response:
 * - entity: ResolvedEntityResult + uri
 */
export const entityByIdHandler: RouteHandler = async (request, ctx, params) => {
  // ── Feature gate: entity profiles require Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'allMcpTools')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'Entity profiles require a Pro plan or higher. Upgrade at quill.maplespike.ca/billing.',
      ctx), 402);
  }

  try {
    const raw = params?.id ?? '';
    if (!raw) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'entity id is required', ctx), 400);
    }

    const id = normalizeEntityId(raw);
    const entity = getEntityById(id);

    if (!entity) {
      return entityNotFoundResponse(raw, ctx);
    }

    return jsonResponse(buildSuccess({
      entity: {
        ...entity,
        uri: toEntityUri(entity.id),
      },
    }, ctx), 200);

  } catch (error) {
    return jsonResponse(buildError('INTERNAL_ERROR', 'Failed to fetch entity', ctx), 500);
  }
};

/**
 * GET /v1/entities/{id}/links
 *
 * Cross-references an entity across every registry Quill tracks (lobbying,
 * GIC, committees, corporate, CanLII, elections, oversight, municipal,
 * provincial). Returns per-registry evidence buckets with counts, date
 * ranges, module lists, and the relationship connections layer.
 *
 * Path param:
 * - id: raw entity id OR a full `quill://entity/{id}` URI
 *
 * Response: same shape as the linked_entities MCP tool (entity, registries,
 * totalAppearances, connections, connectionCount, summary).
 */
export const entityLinksHandler: RouteHandler = async (request, ctx, params) => {
  // ── Feature gate: cross-reference reports require Business tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'crossReferenceReports')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'Entity cross-reference links require a Business plan or higher. Upgrade at quill.maplespike.ca/billing.',
      ctx), 402);
  }

  try {
    const raw = params?.id ?? '';
    if (!raw) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'entity id is required', ctx), 400);
    }

    const url = new URL(request.url);
    // Accept 'org' as a shorthand for 'organization' and normalize before use,
    // so the value passed to the resolver always matches the entities table's
    // stored type ('organization').
    const typeParam = url.searchParams.get('type') || 'auto';
    const type = typeParam === 'org' ? 'organization' : typeParam;
    if (type !== 'auto' && type !== 'person' && type !== 'organization') {
      return jsonResponse(buildError('VALIDATION_ERROR', 'type must be "person", "organization", or "auto"', ctx), 400);
    }

    const id = normalizeEntityId(raw);
    const ref = crossReferenceEntity({ id, type, threshold: 0.7 });

    if (!ref) {
      return entityNotFoundResponse(raw, ctx);
    }

    const { entity, registries, totalAppearances, connections, connectionCount } = ref;
    const summary =
      `${entity.canonicalName} appears in ${totalAppearances} record(s) across ` +
      `${registries.length} registry(/ies)` +
      (connectionCount > 0 ? ` and has ${connectionCount} known connection(s).` : '.');

    return jsonResponse(buildSuccess({
      entity: {
        id: entity.id,
        uri: toEntityUri(entity.id),
        canonicalName: entity.canonicalName,
        type: entity.type,
        confidence: entity.confidence,
        aliases: entity.aliases,
      },
      registries,
      totalAppearances,
      connections,
      connectionCount,
      summary,
    }, ctx), 200);

  } catch (error) {
    return jsonResponse(buildError('INTERNAL_ERROR', 'Failed to fetch entity links', ctx), 500);
  }
};
