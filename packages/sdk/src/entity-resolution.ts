// SPDX-License-Identifier: Apache-2.0
// ---------------------------------------------------------------------------
// MapleSpike SDK — Entity resolution functionality
// ---------------------------------------------------------------------------
import type { QuillResponse, QueryOptions } from './types.js';
import { resolveBaseUrl, buildUrl, buildHeaders, parseResponse } from './query.js';

/** Entity type */
export type EntityType =
  | 'person'
  | 'organization'
  | 'company'
  | 'politician'
  | 'lobbyist'
  | 'charity'
  | 'regulator'
  | 'government-body'
  | 'union'
  | 'university';

/** Entity match confidence */
export type MatchConfidence = 'high' | 'medium' | 'low';

/** Entity record */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  identifiers?: {
    businessNumber?: string;
    registryId?: string;
    [key: string]: string | undefined;
  };
  domains?: string[];
  sourceCounts?: Record<string, number>;
  lastUpdated: string;
}

/** Entity resolution result */
export interface EntityResolutionResult {
  entityId: string;
  name: string;
  type: EntityType;
  confidence: MatchConfidence;
  matches: {
    source: string;
    recordId: string;
    snippet?: string;
  }[];
  merged?: Entity;
}

/** Entity resolution query */
export interface EntityResolutionQuery {
  /** Name to resolve */
  name: string;
  /** Entity type hint */
  type?: EntityType;
  /** Optional identifier */
  businessNumber?: string;
  /** Minimum confidence threshold */
  minConfidence?: MatchConfidence;
  /** Search within specific domains */
  domains?: string[];
  /** Language for results: 'en' (default), 'fr', or 'both' */
  lang?: 'en' | 'fr' | 'both';
  /** French name to resolve */
  nameFr?: string;
  [key: string]: unknown;
}

/** Entity graph node */
export interface EntityGraphNode {
  id: string;
  name: string;
  type: EntityType;
  weight?: number;
}

/** Entity graph edge */
export interface EntityGraphEdge {
  from: string;
  to: string;
  relationship: string;
  weight?: number;
  sources?: string[];
}

/** Entity graph */
export interface EntityGraph {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
}

/**
 * Entity resolution client for resolving entities across MapleSpike datasets
 */
export class EntityResolutionClient {
  private _apiKey?: string;
  private _jwtToken?: string;
  private _baseUrl: string;

  constructor(config: { apiKey?: string; jwtToken?: string; baseUrl?: string } = {}) {
    this._apiKey = config.apiKey;
    this._jwtToken = config.jwtToken;
    this._baseUrl = resolveBaseUrl(config.baseUrl);
  }

  /**
   * Resolve an entity across all datasets
   */
  async resolve(query: EntityResolutionQuery, options?: QueryOptions): Promise<QuillResponse<EntityResolutionResult[]>> {
    const url = buildUrl(this._baseUrl, 'entity', 'resolve', query as Record<string, unknown>, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return parseResponse<EntityResolutionResult[]>(response);
  }

  /**
   * Get entity details by ID
   */
  async getEntity(entityId: string, options?: QueryOptions): Promise<QuillResponse<Entity>> {
    const url = buildUrl(this._baseUrl, 'entity', 'get', { entityId }, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<Entity>(response);
  }

  /**
   * Search for entities
   */
  async searchEntities(query: string, filters: { type?: EntityType; domain?: string; limit?: number } = {}, options?: QueryOptions): Promise<QuillResponse<Entity[]>> {
    const url = buildUrl(this._baseUrl, 'entity', 'search', { q: query, ...filters }, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<Entity[]>(response);
  }

  /**
   * Get entity graph (relationships)
   */
  async getGraph(entityId: string, depth: number = 2, options?: QueryOptions): Promise<QuillResponse<EntityGraph>> {
    const url = buildUrl(this._baseUrl, 'entity', 'graph', { entityId, depth }, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<EntityGraph>(response);
  }

  /**
   * Find similar entities
   */
  async findSimilar(entityId: string, limit: number = 10, options?: QueryOptions): Promise<QuillResponse<Entity[]>> {
    const url = buildUrl(this._baseUrl, 'entity', 'similar', { entityId, limit }, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<Entity[]>(response);
  }

  /**
   * Get entity statistics
   */
  async stats(): Promise<QuillResponse<{
    totalEntities: number;
    entitiesByType: Record<EntityType, number>;
    entitiesByDomain: Record<string, number>;
  }>> {
    const url = buildUrl(this._baseUrl, 'entity', 'stats', {}, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<{
      totalEntities: number;
      entitiesByType: Record<EntityType, number>;
      entitiesByDomain: Record<string, number>;
    }>(response);
  }

  /**
   * Bulk resolve entities
   */
  async bulkResolve(queries: EntityResolutionQuery[], options?: QueryOptions): Promise<QuillResponse<EntityResolutionResult[][]>> {
    const url = buildUrl(this._baseUrl, 'entity', 'bulk-resolve', {}, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ queries }),
    });
    return parseResponse<EntityResolutionResult[][]>(response);
  }
}