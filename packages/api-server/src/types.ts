/**
 * MapleSpike — API Server Types
 *
 * Shared types for the multi-tenant API gateway.
 * MapleSpike-quality response envelope with quality, citation, and token optimization.
 */

/* ------------------------------------------------------------------ */
/*  Tenant / Auth                                                      */
/* ------------------------------------------------------------------ */

export type Tier = 'free' | 'pro' | 'business' | 'enterprise' | 'internal';

export interface Tenant {
  id: string;
  name: string;
  email?: string;
  emailVerified: boolean;
  verificationToken?: string;
  tier: Tier;
  isActive: boolean;
  journalismMode: boolean;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  keyHash: string;
  name: string;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/*  User Accounts (for JWT/GitHub OAuth)                               */
/* ------------------------------------------------------------------ */

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string | null;
  githubId: string;
  githubLogin: string;
  githubName: string | null;
  avatarUrl: string | null;
  tier: Tier;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Usage / Rate Limits                                                */
/* ------------------------------------------------------------------ */

export const TIER_LIMITS: Record<Tier, { monthly: number; daily: number }> = {
  free:      { monthly: 1_000,  daily: 35 },
  pro:       { monthly: 50_000, daily: 1_700 },
  business:  { monthly: 250_000, daily: 8_500 },
  enterprise:{ monthly: 1_000_000, daily: 35_000 },
  internal:  { monthly: 1_000_000, daily: 35_000 },
};

/* ------------------------------------------------------------------ */
/*  Query Options (Token Optimization Params)                          */
/* ------------------------------------------------------------------ */

export interface QueryOptions {
  /** Return only these top-level fields (e.g. ['data','meta']) */
  _fields?: string[];
  /** 'full' (default) or 'compact' — compact strips null/empty fields */
  _format?: 'full' | 'compact';
  /** Cap array results to N items */
  _limit?: number;
  /** Pagination offset */
  _page?: number;
  /** Normalize field names across sources */
  _normalize?: boolean;
  /** Unit conversion: 'metric' | 'imperial' */
  _units?: 'metric' | 'imperial';
  /** Return aggregate summary instead of rows */
  _summary?: boolean;
  /** Developer preview data — returns sample responses without live pipeline. For testing/development only. */
  _mock?: boolean;
}

export function parseQueryOptions(url: URL): QueryOptions {
  const opts: QueryOptions = {};

  const fields = url.searchParams.get('_fields');
  if (fields) {
    opts._fields = fields.split(',').map((f) => f.trim()).filter(Boolean);
  }

  const format = url.searchParams.get('_format');
  if (format === 'compact' || format === 'full') {
    opts._format = format;
  }

  const limit = url.searchParams.get('_limit');
  if (limit) {
    const n = parseInt(limit, 10);
    if (!isNaN(n) && n > 0) opts._limit = n;
  }

  const page = url.searchParams.get('_page');
  if (page) {
    const n = parseInt(page, 10);
    if (!isNaN(n) && n > 0) opts._page = n;
  }

  const normalize = url.searchParams.get('_normalize');
  if (normalize === 'true' || normalize === '1') opts._normalize = true;

  const units = url.searchParams.get('_units');
  if (units === 'metric' || units === 'imperial') opts._units = units;

  const summary = url.searchParams.get('_summary');
  if (summary === 'true' || summary === '1') opts._summary = true;

  const mock = url.searchParams.get('_mock');
  if (mock === 'true' || mock === '1') opts._mock = true;

  return opts;
}

/* ------------------------------------------------------------------ */
/*  Response Envelope (MapleSpike-compatible)                            */
/* ------------------------------------------------------------------ */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown[];
}

export interface CitationMeta {
  source_name: string;
  source_url: string;
  retrieved_at: string;
  data_hash: string;
  license: string;
  update_frequency: string;
  original_format?: string;
  citation_text?: string;
  citation_footnote?: string;
}

export interface QualityMeta {
  freshness_seconds: number;
  source_uptime_7d: number;
  confidence: 'high' | 'medium' | 'low';
  certainty_score: number;
  /** ISO timestamp of when this data was last verified against the source */
  last_verified?: string;
  /** Completeness indicator: 'complete' | 'partial' | 'estimated' */
  data_completeness?: string;
}

export interface UsageMeta {
  periodCalls: number;
  periodLimit: number;
  tier: Tier;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
  usage: UsageMeta;
  agent: string;
  action: string;
  authMethod: string;
  creditsCharged: number;
  cacheStatus: 'hit' | 'miss' | 'mock';
  durationMs: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  text: string | null;
  error: ApiError | null;
  meta: ResponseMeta;
  quality: QualityMeta | null;
  citation: CitationMeta | null;
}

/* ------------------------------------------------------------------ */
/*  Request Context (per-request state)                                */
/* ------------------------------------------------------------------ */

export interface RouteContext {
  tenant: Tenant;
  apiKeyId: string;
  requestId: string;
  startTime: number;
  env: Record<string, string | undefined>;
  db: MapleSpikeStorage;
  cache: MapleSpikeCache;
}

/* ------------------------------------------------------------------ */
/*  Storage Abstraction (D1 / local)                                   */
/* ------------------------------------------------------------------ */

export interface MapleSpikeStorage {
  /** Look up tenant + API key by raw key value. Returns null if invalid. */
  authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string; rotatedKey?: { id: string; key: string; expiresAt: string } } | null>;
  /** Get current daily call count for a tenant. */
  getDailyUsage(tenantId: string, date: string): Promise<number>;
  /** Get current monthly call count for a tenant. */
  getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number>;
  /** Increment usage counters for a tenant. */
  incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void>;
  /** Log an audit entry. */
  logAudit(entry: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void>;
  /** Query audit log. */
  queryAudit(filter: AuditQueryParams): Promise<AuditEntry[]>;
  /** List API keys for a tenant. Returns key metadata (not the raw key/hash). */
  listApiKeys(tenantId: string): Promise<Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }>>;
}

export interface MapleSpikeCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export interface AuditEntry {
  id?: number;
  tenantId: string;
  apiKeyId?: string;
  operation: string;
  model?: string;
  endpoint: string;
  inputPreview?: string;
  outputSummary?: string;
  confidence?: number | null;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  createdAt?: string;
}

export interface AuditQueryParams {
  tenantId: string;
  operation?: string;
  success?: boolean;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

/* ------------------------------------------------------------------ */
/*  Route Handler                                                      */
/* ------------------------------------------------------------------ */

export type RouteHandler = (
  request: Request,
  ctx: RouteContext,
  params: Record<string, string>,
) => Promise<Response>;

/* ------------------------------------------------------------------ */
/*  Workers Env (inlined to avoid dep requirement)                     */
/* ------------------------------------------------------------------ */

export interface Env {
  DB: {
    prepare(sql: string): {
      bind(...params: unknown[]): {
        run(): Promise<{ meta: Record<string, unknown> }>;
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
        first<T = Record<string, unknown>>(): Promise<T | null>;
      };
    };
  };
  CACHE: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
  ENVIRONMENT?: string;
  MAPLESPIKE_VERSION?: string;
  MAPLESPIKE_NAME?: string;
  FREE_LIMIT?: string;
  PRO_LIMIT?: string;
  BUSINESS_LIMIT?: string;
  AI_ENDPOINT?: string;
  AI_MODEL?: string;
  JWT_SECRET?: string;
}
