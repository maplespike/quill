// SPDX-License-Identifier: AGPL-3.0-only
/**
 * SDK example — federated cross-reference agent.
 *
 * "What does every registry say about X?" in two REST calls:
 *
 *   1. POST /v1/entity/resolve          resolve a name to a canonical
 *                                       `quill://entity/{id}` id
 *   2. GET  /v1/entities/{id}/links     per-registry evidence buckets plus the
 *                                       relationship connections layer
 *
 * Those two routes are the non-MCP twins of the Quill MCP tools
 * `resolve_entity` / `linked_entities`; `search_cross_reference` is the same
 * graph walk exposed as one tool call. (`/v1/entities/{id}/links` requires a
 * Business tier key because it mirrors the premium `linked_entities` tool —
 * the resolve call itself is Pro+.)
 *
 * Run it:
 *   QUILL_API_KEY=... pnpm --filter @maplespike/sdk exec tsx examples/crossref-agent.ts
 *
 * The resolver accepts a MapleSpike-shaped client and the links call accepts
 * an injectable `fetchImpl`, so the flow can run against mocks in tests — see
 * packages/sdk/src/examples.test.ts.
 */

import type {
  EntityResolutionQuery,
  EntityResolutionResult,
  QueryOptions,
  QuillResponse,
} from '@maplespike/sdk';

/** Structural subset of the SDK client the demo needs. */
export interface ResolveClient {
  entityResolution: {
    resolve(
      query: EntityResolutionQuery,
      options?: QueryOptions,
    ): Promise<QuillResponse<EntityResolutionResult[]>>;
  };
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CrossrefOptions {
  /** Name (or alias) to cross-reference. */
  name: string;
  /** Optional entity type hint. */
  type?: EntityResolutionQuery['type'];
  baseUrl?: string;
  apiKey?: string;
  /** Injectable resolver client (defaults to a real MapleSpike instance). */
  client?: ResolveClient;
  /** Injectable fetch for the links call (defaults to global fetch). */
  fetchImpl?: FetchLike;
  /** Confidence threshold used when picking a match. */
  minConfidence?: 'high' | 'medium' | 'low';
}

export interface EntityLinkBucket {
  registry: string;
  count: number;
  modules?: string[];
  dateRange?: { from: string | null; to: string | null };
  [key: string]: unknown;
}

/** Response of `GET /v1/entities/{id}/links` (the `linked_entities` surface). */
export interface EntityLinksResult {
  entity: {
    id: string;
    uri: string;
    canonicalName: string;
    type: string;
    confidence: string;
    aliases?: string[];
  };
  registries: EntityLinkBucket[];
  totalAppearances: number;
  connections: Array<{ name: string; relationship: string; confidence?: string }>;
  connectionCount: number;
  summary: string;
}

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8085';

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

function baseUrlOf(value?: string): string {
  return (value ?? process.env.QUILL_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Build the real SDK client lazily so the demo can run fully mocked. */
async function loadDefaultClient(options: CrossrefOptions): Promise<ResolveClient> {
  const { MapleSpike } = await import('@maplespike/sdk');
  return new MapleSpike({ apiKey: options.apiKey, baseUrl: baseUrlOf(options.baseUrl) });
}

/** Resolve a name to the best matching canonical entity id. */
export async function resolveEntity(
  options: CrossrefOptions,
): Promise<EntityResolutionResult | null> {
  const client: ResolveClient = options.client ?? (await loadDefaultClient(options));

  const query: EntityResolutionQuery = { name: options.name };
  if (options.type) query.type = options.type;

  const resolved = await client.entityResolution.resolve(query);
  const threshold = CONFIDENCE_RANK[options.minConfidence ?? 'medium'] ?? 2;
  const ranked = [...(resolved.data ?? [])].sort(
    (a, b) => (CONFIDENCE_RANK[b.confidence] ?? 0) - (CONFIDENCE_RANK[a.confidence] ?? 0),
  );
  return ranked.find((match) => (CONFIDENCE_RANK[match.confidence] ?? 0) >= threshold) ?? null;
}

/** Fetch the per-registry cross-reference for a canonical entity id or URI. */
export async function entityLinks(options: {
  entityId: string;
  baseUrl?: string;
  apiKey?: string;
  type?: 'person' | 'organization' | 'auto';
  fetchImpl?: FetchLike;
}): Promise<QuillResponse<EntityLinksResult>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.apiKey) headers['X-API-Key'] = options.apiKey;

  const id = options.entityId.replace(/^quill:\/\/entity\//, '');
  const query = options.type && options.type !== 'auto' ? `?type=${options.type}` : '';
  const response = await fetchImpl(
    `${baseUrlOf(options.baseUrl)}/v1/entities/${encodeURIComponent(id)}/links${query}`,
    { headers },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Entity links failed — HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return (await response.json()) as QuillResponse<EntityLinksResult>;
}

export interface CrossrefReport {
  resolved: EntityResolutionResult;
  links: EntityLinksResult;
  /** One-line answer for a human or an agent prompt. */
  summary: string;
}

/** Resolve then cross-reference — the federated query in one call. */
export async function crossrefAgent(options: CrossrefOptions): Promise<CrossrefReport> {
  const resolved = await resolveEntity(options);
  if (!resolved) {
    throw new Error(`No entity matched "${options.name}" at or above the confidence threshold`);
  }

  const links = await entityLinks({
    entityId: resolved.entityId,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    type: options.type === 'organization' || options.type === 'person' ? options.type : undefined,
    fetchImpl: options.fetchImpl,
  });

  return { resolved, links: links.data, summary: links.data.summary };
}

export async function main(): Promise<void> {
  const report = await crossrefAgent({ name: 'Acme Consulting Inc.', type: 'organization' });
  console.log(report.summary);
  console.log('canonical entity:', report.links.entity.uri);
  for (const bucket of report.links.registries) {
    console.log(`- ${bucket.registry}: ${bucket.count} record(s)`);
  }
  if (report.links.connectionCount > 0) {
    console.log('connections:', report.links.connectionCount);
  }
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('/crossref-agent.ts');

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
