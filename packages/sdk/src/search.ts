// SPDX-License-Identifier: Apache-2.0
// ---------------------------------------------------------------------------
// MapleSpike SDK — Search functionality
// ---------------------------------------------------------------------------
import type { QuillResponse, QueryOptions } from './types.js';
import { resolveBaseUrl, buildUrl, buildHeaders, parseResponse } from './query.js';

/** Search query parameters */
export interface SearchQuery {
  /** Search query string */
  query: string;
  /** Limit number of results */
  limit?: number;
  /** Filter by domain/agent */
  domain?: string;
  /** Sort order */
  sort?: 'relevance' | 'date' | 'name';
  /** Date range filter */
  dateFrom?: string;
  /** Date range filter */
  dateTo?: string;
  [key: string]: unknown;
}

/** Cross-domain search result */
export interface SearchResult {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  source: string;
  url?: string;
  score: number;
  domain: string;
  timestamp?: string;
}

/**
 * Cross-domain search functionality for MapleSpike
 */
export class SearchClient {
  private _apiKey?: string;
  private _jwtToken?: string;
  private _baseUrl: string;

  constructor(config: { apiKey?: string; jwtToken?: string; baseUrl?: string } = {}) {
    this._apiKey = config.apiKey;
    this._jwtToken = config.jwtToken;
    this._baseUrl = resolveBaseUrl(config.baseUrl);
  }

  /**
   * Search across all domains
   */
  async search(query: SearchQuery, options?: QueryOptions): Promise<QuillResponse<SearchResult[]>> {
    const url = buildUrl(this._baseUrl, 'search', 'global', query as Record<string, unknown>, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<SearchResult[]>(response);
  }

  /**
   * Search within a specific domain
   */
  async searchDomain(domain: string, query: SearchQuery, options?: QueryOptions): Promise<QuillResponse<SearchResult[]>> {
    const url = buildUrl(this._baseUrl, 'search', domain, { ...query, domain } as Record<string, unknown>, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<SearchResult[]>(response);
  }

  /**
   * Get search suggestions/autocomplete
   */
  async suggestions(query: string, limit: number = 5): Promise<QuillResponse<string[]>> {
    const url = buildUrl(this._baseUrl, 'search', 'suggestions', { q: query, limit }, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<string[]>(response);
  }

  /**
   * Get search statistics
   */
  async stats(): Promise<QuillResponse<{ totalDomains: number; indexedRecords: number }>> {
    const url = buildUrl(this._baseUrl, 'search', 'stats', {}, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<{ totalDomains: number; indexedRecords: number }>(response);
  }
}