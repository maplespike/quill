/**
 * CivInt Canada — API Server Types
 *
 * Shared types for the multi-tenant API gateway.
 */

/* ------------------------------------------------------------------ */
/*  Tenant / Auth                                                      */
/* ------------------------------------------------------------------ */

export type Tier = 'free' | 'pro' | 'business' | 'enterprise' | 'internal';

export interface Tenant {
  id: string;
  name: string;
  email?: string;
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
/*  Response Envelope                                                  */
/* ------------------------------------------------------------------ */

export interface ApiError {
  code: string;
  message: string;
}

export interface CitationMeta {
  source: string;
  timestamp: string;
  hash: string;
  license: string;
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
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ResponseMeta;
  citations: CitationMeta[];
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
  db: CivIntStorage;
  cache: CivIntCache;
}

/* ------------------------------------------------------------------ */
/*  Storage Abstraction (D1 / local)                                   */
/* ------------------------------------------------------------------ */

export interface CivIntStorage {
  /** Look up tenant + API key by raw key value. Returns null if invalid. */
  authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string } | null>;
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
}

export interface CivIntCache {
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
  CIVINT_VERSION?: string;
  CIVINT_NAME?: string;
  FREE_LIMIT?: string;
  PRO_LIMIT?: string;
  BUSINESS_LIMIT?: string;
  AI_ENDPOINT?: string;
  AI_MODEL?: string;
}
