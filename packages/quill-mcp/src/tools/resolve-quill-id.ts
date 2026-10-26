// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — resolve-quill-id (Context7-shape shell, 1 of 2)
 *
 * Collapses the 199-tool surface into a two-call interaction loop:
 *   1. resolve-quill-id  — question → ranked canonical IDs
 *   2. query-quill       — ID + question (+args) → routed tool execution
 *
 * Modeled on Context7's resolve-library-id: canonical ID, name, description,
 * and quality signals (here: provenance/cadence + featured status instead of
 * reputation scores). The routing table is BUILT FROM the live tool registry
 * via quill://tool-index semantics — no hand-maintained duplicate.
 *
 * ID scheme:
 *   /{category}            → search_* / domain tools (e.g. /committees, /statcan)
 *   /{category}/{dataset}  → specific sub-capability (e.g. /ircc/study-permits)
 *   quill://entity/{name}  → entity graph (routed to resolve_entity)
 *   featured               → the 7 cross-reference/influence tools (#838)
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { FEATURED_TOOLS } from './discover-tools.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface RouteEntry {
  /** Canonical Quill ID (e.g. "/committees", "/ircc/study-permits"). */
  id: string;
  /** Routed tool name in the live registry. */
  toolName: string;
  /** Human name for display. */
  name: string;
  description: string;
  /** Route class: domain search, graph, verification, etc. */
  kind: 'search' | 'graph' | 'verify' | 'meta' | 'query';
  /** Provenance signal 0–100 (pipeline data-quality score, stub-sourced). */
  provenance: number;
  /** Update cadence hint from the description, when derivable. */
  cadence?: string;
  featured: boolean;
  /** Keywords that boost this route in resolution ranking. */
  keywords: string[];
}

// ─── Category extraction (toolName → canonical ID) ────────────────────────

/** Domain words that add resolution signal when they appear in a description. */
const STOPWORDS = new Set([
  'search', 'query', 'get', 'find', 'data', 'canadian', 'canada', 'government',
  'return', 'returns', 'including', 'across', 'using', 'based', 'official',
  'records', 'source', 'sources', 'public', 'federal', 'information',
]);

/** Known cadence phrases → normalized hint. */
function detectCadence(description: string): string | undefined {
  const d = description.toLowerCase();
  if (/\b(real.?time|live)\b/.test(d)) return 'real-time';
  if (/\bdaily\b/.test(d)) return 'daily';
  if (/\bweekly\b/.test(d)) return 'weekly';
  if (/\bmonthly\b/.test(d)) return 'monthly';
  if (/\b(annual|yearly|per.year)\b/.test(d)) return 'annual';
  if (/\bquarterly\b/.test(d)) return 'quarterly';
  return undefined;
}

/**
 * Derive a canonical ID from a tool name.
 * search_ircc_study_permits → /ircc/study-permits
 * search_committees         → /committees
 * query_gdp                 → /gdp (query_* treated as first-class datasets)
 * resolve_entity            → quill://entity (graph class)
 */
export function toolNameToId(toolName: string): string | null {
  if (toolName === 'resolve_entity' || toolName === 'linked_entities' || toolName === 'find_connections') {
    return 'quill://entity';
  }
  const searchMatch = /^search_([a-z0-9]+)(?:_([a-z0-9_]+))?$/.exec(toolName);
  if (searchMatch) {
    const domain = searchMatch[1];
    const sub = searchMatch[2];
    return sub ? `/${domain}/${sub.replace(/_/g, '-')}` : `/${domain}`;
  }
  const queryMatch = /^(?:query|get)_([a-z0-9_]+)$/.exec(toolName);
  if (queryMatch) return `/${queryMatch[1].replace(/_/g, '-')}`;
  return null;
}

function classify(toolName: string): RouteEntry['kind'] {
  if (toolName === 'verify_claim' || toolName === 'get_citation' || toolName === 'citation') return 'verify';
  if (toolName === 'resolve_entity' || toolName === 'linked_entities' || toolName === 'find_connections') return 'graph';
  if (toolName === 'discover_tools' || toolName === 'explore_catalog' || toolName === 'get_module_health') return 'meta';
  if (/^(search|query|get)_/.test(toolName)) return 'search';
  return 'query';
}

/** Derive keywords from tool name + description (for ranking). */
function deriveKeywords(toolName: string, description: string): string[] {
  const nameWords = toolName.replace(/^(search|query|get)_/, '').split(/_/).filter(w => w.length > 2);
  const descWords = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
  return [...new Set([...nameWords, ...descWords.slice(0, 12)])];
}

/**
 * Build the routing table from the live registry.
 * Cached after first call; the registry is static at runtime.
 */
let routeTable: RouteEntry[] | null = null;

export async function buildRouteTable(): Promise<RouteEntry[]> {
  if (routeTable) return routeTable;
  const { getAllTools } = await import('./index.js');
  const entries: RouteEntry[] = [];
  const seenIds = new Map<string, number>(); // id → collision count

  for (const t of getAllTools()) {
    const def = t.definition;
    const id = toolNameToId(def.name) ?? `/tool/${def.name}`;
    const collision = seenIds.get(id) ?? 0;
    seenIds.set(id, collision + 1);
    const finalId = collision > 0 ? `${id}#${collision + 1}` : id;
    const desc = typeof def.description === 'string' ? def.description : '';
    entries.push({
      id: finalId,
      toolName: def.name,
      name: def.name.replace(/_/g, ' '),
      description: desc.slice(0, 240),
      kind: classify(def.name),
      provenance: def.name.includes('ckan') ? 70 : 85, // stub: pipeline quality scores land via #839/#840
      cadence: detectCadence(desc),
      featured: FEATURED_TOOLS.includes(def.name),
      keywords: deriveKeywords(def.name, desc),
    });
  }

  // Featured routes first, then by kind weight, then alphabetical.
  const kindWeight: Record<RouteEntry['kind'], number> = { graph: 0, verify: 1, search: 2, query: 3, meta: 4 };
  entries.sort((a, b) =>
    Number(b.featured) - Number(a.featured)
    || kindWeight[a.kind] - kindWeight[b.kind]
    || a.id.localeCompare(b.id),
  );

  routeTable = entries;
  return entries;
}

/** Test hook — clear the memoized table. */
export function resetRouteTable(): void {
  routeTable = null;
}

// ─── Resolution ranking ───────────────────────────────────────────────────

export interface ResolvedId {
  id: string;
  toolName: string;
  name: string;
  description: string;
  kind: RouteEntry['kind'];
  provenance: number;
  cadence?: string;
  featured: boolean;
  /** Why this ranked (top matched keywords). */
  matchedOn: string[];
}

/**
 * Rank routes against a natural-language question.
 * BM25-lite: exact keyword hits on name > description > featured boost.
 */
export function resolveQuestion(question: string, table: RouteEntry[], limit = 5): ResolvedId[] {
  const q = question.toLowerCase();
  const qTokens = new Set(q.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(t => t.length > 2));
  const scored: Array<{ entry: RouteEntry; score: number; matched: string[] }> = [];

  for (const entry of table) {
    let score = 0;
    const matched: string[] = [];
    const idLower = entry.id.toLowerCase();
    const nameLower = entry.toolName.toLowerCase();

    for (const kw of entry.keywords) {
      if (qTokens.has(kw) || q.includes(kw)) {
        score += 3;
        matched.push(kw);
      }
    }
    // Whole-token name hits are strong.
    for (const token of qTokens) {
      if (nameLower.includes(token) && token.length > 3) score += 2;
      if (idLower.includes(token) && token.length > 3) score += 1;
    }
    if (entry.featured) score += 1.5;

    if (score > 0) scored.push({ entry, score, matched: [...new Set(matched)].slice(0, 4) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ entry, matched }) => ({
    id: entry.id,
    toolName: entry.toolName,
    name: entry.name,
    description: entry.description,
    kind: entry.kind,
    provenance: entry.provenance,
    cadence: entry.cadence,
    featured: entry.featured,
    matchedOn: matched,
  }));
}

// ─── Tool surface ─────────────────────────────────────────────────────────

export const definition: ToolDefinition = {
  name: 'resolve_quill_id',
  description:
    'Resolve a question about Canadian public data into canonical Quill IDs you can pass to query_quill. ' +
    'Returns ranked IDs (e.g. /committees, /ircc/study-permits, quill://entity) with descriptions, ' +
    'provenance scores (Quill-computed record-quality signals, not publisher declarations), ' +
    'update cadence, and the underlying tool each ID routes to. ' +
    'You MUST call this before query_quill unless the user provided an ID directly. ' +
    'Do not call more than 3 times per question.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 500,
        description: 'The user\'s question or task — used to rank which Quill IDs are relevant. ' +
          'Do not include sensitive or confidential information.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Max results (default 5)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min(Math.max(Number(args.limit ?? 5), 1), 10);

  if (!query) {
    return {
      content: { tool: 'resolve_quill_id', error: 'No query provided.' },
      isError: true,
    };
  }

  const table = await buildRouteTable();
  const results = resolveQuestion(query, table, limit);

  return {
    content: {
      tool: 'resolve_quill_id',
      query,
      instructions:
        results.length > 0
          ? 'Pass one of these IDs to query_quill with your question. Use the exact id string.'
          : 'No strong match — try resolve_quill_id with different terms, or call discover_tools with a topic word.',
      results,
      total: results.length,
    },
  };
};
