// SPDX-License-Identifier: MIT
/**
 * Quill — query-quill (Context7-shape shell, 2 of 2)
 *
 * The single execution entry point: a canonical ID (from resolve_quill_id)
 * + a question (+ optional arguments) routes to the underlying registry tool
 * and returns its result enriched with:
 *   - the routed tool name + ID (so agents can cite what answered)
 *   - a verification pointer (claim hash / verify_claim recipe) when the
 *     result carries a citation — the Context7 differentiator: checkable
 *     answers, not just fresh ones.
 *
 * The 199 handlers stay untouched behind the router.
 */

import type { ToolDefinition, ToolHandler, ToolResponse } from './types.js';
import { buildRouteTable, type RouteEntry } from './resolve-quill-id.js';

/** Extract a citation/claim hash from a tool response, anywhere in the envelope. */
function findClaimHash(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findClaimHash(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = value as Record<string, unknown>;
  for (const key of ['sha256', 'claim_sha256', 'citation_hash', 'hash']) {
    const v = obj[key];
    if (typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v)) return v;
  }
  for (const v of Object.values(obj)) {
    const found = findClaimHash(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function envelope(result: ToolResponse, routed: {
  id: string;
  toolName: string;
  kind: RouteEntry['kind'];
}, query: string): ToolResponse {
  const base = (result.content && typeof result.content === 'object' && !Array.isArray(result.content))
    ? result.content as Record<string, unknown>
    : { result: result.content };

  const hash = findClaimHash(result.content);
  const verification = hash
    ? {
        claim_sha256: hash,
        verify: `Call verify_claim with hash "${hash}" to check whether this record hash is present in Quill's claim store. This does not authenticate the source.`,
      }
    : undefined;

  return {
    content: {
      ...base,
      _quill_route: {
        id: routed.id,
        routed_tool: routed.toolName,
        kind: routed.kind,
        query,
      },
      ...(verification ? { _quill_verification: verification } : {}),
    },
    isError: result.isError,
  };
}

export const definition: ToolDefinition = {
  name: 'query_quill',
  description:
    'Execute a Canadian public data query by Quill ID. You MUST call resolve_quill_id first to obtain a valid ID ' +
    '(format: /category, /category/dataset, or quill://entity) UNLESS the user provided one directly. ' +
    'Each result reports the routed tool name and, when available, a SHA-256 claim hash with a ' +
    'verify_claim recipe for checking the canonical record hash; this does not authenticate the source. Do not call this tool more than 3 times per question.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Canonical Quill ID from resolve_quill_id (e.g. "/committees", "/ircc/study-permits", "quill://entity").',
      },
      query: {
        type: 'string',
        maxLength: 500,
        description: 'What to look up — scoped to a single concept. The routed tool receives this as its primary query.',
      },
      args: {
        type: 'object',
        description: 'Optional tool-specific arguments (limit, filters, dates) forwarded to the routed tool.',
        additionalProperties: true,
      },
    },
    required: ['id', 'query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const id = String(args.id ?? '').trim();
  const query = String(args.query ?? '').trim();

  if (!id || !query) {
    return {
      content: { tool: 'query_quill', error: 'Both "id" and "query" are required. Call resolve_quill_id first to get a valid id.' },
      isError: true,
    };
  }

  const table = await buildRouteTable();
  const bareId = id.split('#')[0].toLowerCase();

  // quill://entity → canonical graph entry
  const effectiveId = bareId.startsWith('quill://entity') ? 'quill://entity' : bareId;
  const route = table.find(r => r.id.toLowerCase() === effectiveId)
    // Tolerant match: /ircc/study-permits vs /ircc/study_permits drift
    ?? table.find(r => r.id.toLowerCase().replace(/-/g, '_') === effectiveId.replace(/-/g, '_'));

  if (!route) {
    const suggestions = table
      .filter(r => r.kind === 'search' || r.kind === 'graph')
      .slice(0, 8)
      .map(r => r.id);
    return {
      content: {
        tool: 'query_quill',
        error: `Unknown Quill ID: ${id}`,
        hint: 'Call resolve_quill_id with your question to get valid IDs.',
        example_ids: suggestions,
      },
      isError: true,
    };
  }

  // Route into the live registry.
  const { getAllTools } = await import('./index.js');
  const tool = getAllTools().find(t => t.definition.name === route.toolName);
  if (!tool) {
    return {
      content: { tool: 'query_quill', error: `Route ${id} points to tool "${route.toolName}" which is not registered.` },
      isError: true,
    };
  }

  // Argument mapping: query maps to the target tool's most likely primary
  // parameter; explicit args win.
  const forward: Record<string, unknown> = { ...(args.args as Record<string, unknown> | undefined) };
  const schemaProps = (tool.definition.inputSchema?.properties ?? {}) as Record<string, { type?: string }>;
  const queryParamCandidates = ['q', 'query', 'search', 'term', 'keyword', 'name', 'topic'];
  const queryKey = queryParamCandidates.find(k => k in schemaProps)
    ?? Object.keys(schemaProps).find(k => schemaProps[k]?.type === 'string');
  if (queryKey && forward[queryKey] === undefined) forward[queryKey] = query;
  if (forward.query === undefined && 'query' in schemaProps) forward.query = query;

  try {
    const result = await tool.handler(forward);
    return envelope(result, { id: route.id, toolName: route.toolName, kind: route.kind }, query);
  } catch (e) {
    return {
      content: {
        tool: 'query_quill',
        error: `Routed tool "${route.toolName}" threw: ${(e as Error).message}`,
        _quill_route: { id: route.id, routed_tool: route.toolName },
      },
      isError: true,
    };
  }
};
