// ---------------------------------------------------------------------------
// MapleSpike SDK — Main entry point
// ---------------------------------------------------------------------------
import type { SdkConfig, MapleSpikeResponse, QueryOptions, AgentProxy } from './types.js';
import { resolveBaseUrl, buildUrl, buildHeaders, parseResponse } from './query.js';
import { getMockResponse } from './mock.js';
import { setApiKey, setJwtToken, clearAuth } from './auth.js';

export type { MapleSpikeResponse, QueryOptions, AgentProxy } from './types.js';
export type {
  ResponseMeta,
  ResponseQuality,
  Citation,
  AuthConfig,
  SdkConfig,
  MapleSpikeApiError,
  AgentDefinition,
  ActionDefinition,
} from './types.js';
export { MapleSpikeError } from './types.js';
export { getAgent, listAgents, listActions, AGENTS } from './agents.js';
export { getApiKey, setApiKey, getJwtToken, setJwtToken, isAuthenticated, clearAuth } from './auth.js';
export { buildUrl, buildHeaders, resolveBaseUrl } from './query.js';
export { getMockResponse } from './mock.js';

/**
 * MapleSpike — typed client for the MapleSpike civilian intelligence API.
 *
 * ```ts
 * const ms = new MapleSpike({ apiKey: 'ms_live_...' });
 * const result = await ms.query('committees', 'committee-membership', { parliament: 44 });
 * console.log(result.data);
 * ```
 */
export class MapleSpike {
  private _apiKey?: string;
  private _jwtToken?: string;
  private _baseUrl: string;

  constructor(config: SdkConfig = {}) {
    this._apiKey = config.apiKey;
    this._jwtToken = config.jwtToken;
    this._baseUrl = resolveBaseUrl(config.baseUrl);

    // Sync to auth module
    if (config.apiKey) setApiKey(config.apiKey);
    if (config.jwtToken) setJwtToken(config.jwtToken);
  }

  // ─── Configuration ───────────────────────────────────────────────────────

  /** Get or set the API key */
  get apiKey(): string | undefined {
    return this._apiKey;
  }

  set apiKey(key: string | undefined) {
    this._apiKey = key;
    setApiKey(key);
  }

  /** Get or set the JWT token */
  get jwtToken(): string | undefined {
    return this._jwtToken;
  }

  set jwtToken(token: string | undefined) {
    this._jwtToken = token;
    setJwtToken(token);
  }

  /** Get or set the base URL */
  get baseUrl(): string {
    return this._baseUrl;
  }

  set baseUrl(url: string) {
    this._baseUrl = resolveBaseUrl(url);
  }

  /** Full-reset of auth state */
  clearAuth(): void {
    this._apiKey = undefined;
    this._jwtToken = undefined;
    clearAuth();
  }

  /** Check whether any auth is configured */
  isAuthenticated(): boolean {
    return !!(this._apiKey || this._jwtToken);
  }

  // ─── Query API ───────────────────────────────────────────────────────────

  /**
   * Execute a structured query against a MapleSpike agent action.
   *
   * @param agent  Agent name (e.g. "committees", "corporate")
   * @param action Action name (e.g. "committee-membership", "corporation-profile")
   * @param params Action-specific parameters
   * @param options Query options (mock mode, field projection, pagination, etc.)
   */
  async query<T = unknown>(
    agent: string,
    action: string,
    params?: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<MapleSpikeResponse<T>> {
    // Mock mode — no network call
    if (options?._mock) {
      return getMockResponse(agent, action) as MapleSpikeResponse<T>;
    }

    const url = buildUrl(this._baseUrl, agent, action, params, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);

    const response = await fetch(url, { headers });
    return parseResponse<T>(response);
  }

  /**
   * Begin a chained query: `ms.agent('committees').action('committee-membership', { ... })`
   */
  agent(name: string): AgentProxy {
    const self = this;
    const agentName = name;
    return {
      _agent: agentName,
      agent(n: string): AgentProxy {
        return self.agent(n);
      },
      async action(
        action: string,
        params?: Record<string, unknown>,
        options?: QueryOptions,
      ): Promise<MapleSpikeResponse<unknown>> {
        return self.query(agentName, action, params, options);
      },
    };
  }
}

// ─── Default export ─────────────────────────────────────────────────────────

export default MapleSpike;
