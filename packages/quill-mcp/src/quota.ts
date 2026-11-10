// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike Quill — freemium call quota
 *
 * Spec: every hosted caller gets 1000 free tool calls per calendar month (UTC).
 * After that, calls fall through to the existing x402 per-call payment path
 * (micro $0.001 / standard $0.01 / premium $0.10 / enterprise $1.00).
 *
 * Identity-aware. Three modes:
 *   - `self-hosted:<session>`  stdio / direct spawn — user runs the server,
 *                              quotas are NOT enforced (matches the api-server's
 *                              "community" plan).
 *   - `api-key:<sha256>`       SSE with `Authorization: Bearer` — hashed key.
 *   - `anonymous-ip:<sha256>`  SSE without auth, dev mode only. Logged loudly.
 *
 * Storage: in-memory Map with optional atomic JSON snapshot at
 * QUOTA_PERSIST_PATH for single-node persistence across restarts.
 *
 * Production multi-node deployments should bind this to Cloudflare KV or D1
 * (Federation TODO after Cloudflare account provisioning — no ADR yet).
 *
 * Opt-in: `QUOTA_ENABLED=true` to gate. Default off so existing `npx` users
 * keep their zero-config experience.
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino from 'pino';
// Re-export for backward compatibility — transports (cli.ts, index.ts)
// that still call setCurrentIdentity directly will continue to work.
// New code should prefer context.runWithIdentity() instead.
export { setCurrentIdentity, getCurrentIdentity, clearCurrentIdentity } from './context.js';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'silent'),
});

// ─── Constants ──────────────────────────────────────────────────────────

export const DEFAULT_FREE_QUOTA = 1000;
const CALENDAR_MONTH_KEY_LEN = 7; // "YYYY-MM"
const PERSIST_DEBOUNCE_MS = 5000;

// ─── Types ──────────────────────────────────────────────────────────────

export type QuotaMode = 'self-hosted' | 'api-key' | 'anonymous-ip';

export interface QuotaIdentity {
  /** Stable hashed identifier (never expose raw token / IP to logs). */
  hashed: string;
  /** Mode tag — drives "should we even count?" logic. */
  mode: QuotaMode;
  /** Human-readable label for headers / debug logs (hashed already). */
  label: string;
}

/** Quota state for a single identity in a single calendar month. */
interface QuotaState {
  /** Number of calls consumed in the current period. */
  used: number;
  /** Period key, e.g. "2026-07". Reset when this changes. */
  period: string;
  /** First time this period was seen (ms). Used for `firstSeenAt`. */
  firstSeenAt: number;
}

/** Public read-only view returned by `getStatus()`. */
export interface QuotaStatus {
  enabled: boolean;
  mode: QuotaMode;
  identity: string;          // hashed label
  used: number;
  limit: number;             // DEFAULT_FREE_QUOTA
  remaining: number;
  resetAt: string;           // ISO timestamp of next reset
  period: string;            // "YYYY-MM"
  percentUsed: number;       // 0..100 (capped at 100)
  /** First call ever recorded for this identity (ISO), null if never. */
  firstSeenAt: string | null;
  /** True when free quota is exhausted and would require x402 payment. */
  exceedsFreeQuota: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function currentPeriod(now: Date = new Date()): string {
  // Calendar month UTC, "YYYY-MM"
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function nextResetIso(period: string): string {
  // First day of the month AFTER period, 00:00 UTC.
  const [y, m] = period.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return next.toISOString();
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Resolve the hashed identity for a request.
 *
 * @param mode 'self-hosted' | 'api-key' | 'anonymous-ip'
 * @param rawTokenOrIp plaintext token (Bearer) or remote IP — never logged
 */
export function buildIdentity(mode: QuotaMode, rawTokenOrIp: string): QuotaIdentity {
  if (mode === 'self-hosted') {
    return { hashed: `self-hosted:${sha256Hex(rawTokenOrIp || randomUUID())}`, mode, label: 'self-hosted' };
  }
  if (mode === 'api-key') {
    return { hashed: `api-key:${sha256Hex(rawTokenOrIp)}`, mode, label: 'api-key:<hashed>' };
  }
  return { hashed: `anonymous-ip:${sha256Hex(rawTokenOrIp)}`, mode, label: 'anonymous-ip:<hashed>' };
}

// ─── Tracker ────────────────────────────────────────────────────────────

export class QuotaTracker {
  private states = new Map<string, QuotaState>();
  private freeLimit: number;
  private enabled: boolean;
  private persistPath: string | null;
  private persistTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(opts?: { freeLimit?: number; enabled?: boolean; persistPath?: string | null }) {
    this.freeLimit = opts?.freeLimit
      ?? (() => {
        const env = parseInt(process.env.QUILL_FREE_QUOTA ?? '', 10);
        return Number.isFinite(env) && env > 0 ? env : DEFAULT_FREE_QUOTA;
      })();
    this.enabled = opts?.enabled ?? process.env.QUOTA_ENABLED === 'true';
    this.persistPath = opts?.persistPath ?? process.env.QUOTA_PERSIST_PATH ?? null;

    if (this.enabled && this.persistPath) {
      this.load();
      log.info({ persistPath: this.persistPath, limit: this.freeLimit }, 'quota: persistence enabled');
    }

    if (this.enabled) {
      log.info({ freeLimit: this.freeLimit }, 'quota: enabled (1000-free/month then x402)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Get current status for an identity without consuming. */
  getStatus(id: QuotaIdentity): QuotaStatus {
    const period = currentPeriod();
    const state = this.states.get(id.hashed);

    if (!this.enabled) {
      return {
        enabled: false,
        mode: id.mode,
        identity: id.label,
        used: state?.used ?? 0,
        limit: Infinity,
        remaining: Infinity,
        resetAt: nextResetIso(state?.period ?? period),
        period: state?.period ?? period,
        percentUsed: 0,
        firstSeenAt: state?.firstSeenAt ? new Date(state.firstSeenAt).toISOString() : null,
        exceedsFreeQuota: false,
      };
    }

    const used = state?.period === period ? state.used : 0;
    const remaining = Math.max(0, this.freeLimit - used);
    return {
      enabled: true,
      mode: id.mode,
      identity: id.label,
      used,
      limit: this.freeLimit,
      remaining,
      resetAt: nextResetIso(period),
      period,
      percentUsed: Math.min(100, Math.round((used / this.freeLimit) * 100)),
      firstSeenAt: state?.firstSeenAt ? new Date(state.firstSeenAt).toISOString() : null,
      exceedsFreeQuota: used >= this.freeLimit,
    };
  }

  /**
   * Decide whether a call from `id` invoking `toolName` (with `toolPriceUsd`)
   * should be allowed right now.
   *
   * Returns:
   *   - { allowed: true }                            → proceed
   *   - { allowed: false, status: 'free_exhausted' } → caller is over quota
   *                                                   and tool is not free
   */
  preflight(id: QuotaIdentity, toolName: string, toolPriceUsd: number):
    | { allowed: true; status: QuotaStatus }
    | { allowed: false; reason: 'quota_exceeded'; status: QuotaStatus; toolPriceUsd: number }
  {
    // Self-hosted callers are never gated — they're running the server themselves.
    if (!this.enabled || id.mode === 'self-hosted') {
      return { allowed: true, status: this.getStatus(id) };
    }

    const status = this.getStatus(id);

    // Free tools (priceUsd === 0) always pass, even when over quota.
    // They're discovery / health / cache management — abuse risk is bounded
    // by per-domain token buckets in pipeline-core.
    if (toolPriceUsd === 0) {
      return { allowed: true, status };
    }

    if (status.exceedsFreeQuota) {
      return {
        allowed: false,
        reason: 'quota_exceeded',
        status,
        toolPriceUsd,
      };
    }

    return { allowed: true, status };
  }

  /**
   * Record a successful tool call. Increments counter only when tracking is
   * meaningful (paid tools under quota, or any free tool). Cache hits and
   * errors are NOT counted — see caller responsibility.
   *
   * Returns the post-increment QuotaStatus.
   *
   * Concurrency: Node.js is single-threaded, so the read-modify-write
   * sequence `Map.get -> +1 -> Map.set` is atomic with respect to V8 ticks.
   * There is no `await` between `Map.get` and the mutation, so another
   * tool handler cannot interleave. **This guarantee holds ONLY within a
   * single Node process**. Multi-instance deployments MUST move state to
   * Cloudflare KV (atomic counters; eventual-consistency accepts ~1s drift)
   * or D1 (single-writer atomicity). Federation TODO — no ADR yet.
   */
  recordCall(id: QuotaIdentity): QuotaStatus {
    if (!this.enabled || id.mode === 'self-hosted') {
      return this.getStatus(id);
    }

    // Single-threaded guarantee: from Map.get() through the set, no I/O, no
    // awaits, no scheduler yields. Safe to read-modify-write atomically.
    const period = currentPeriod();
    const existing = this.states.get(id.hashed);

    if (!existing || existing.period !== period) {
      this.states.set(id.hashed, {
        used: 1,
        period,
        firstSeenAt: existing?.firstSeenAt ?? Date.now(),
      });
    } else {
      existing.used += 1;
    }

    this.dirty = true;
    this.schedulePersist();

    return this.getStatus(id);
  }

  /** Persist now (used on SIGTERM). */
  flushSync(): void {
    if (!this.enabled || !this.persistPath || !this.dirty) return;
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      const tmp = `${this.persistPath}.tmp`;
      writeFileSync(tmp, JSON.stringify({
        version: 1,
        freeLimit: this.freeLimit,
        states: [...this.states.entries()],
      }, null, 2));
      renameSync(tmp, this.persistPath);
      this.dirty = false;
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'quota: persist failed');
    }
  }

  private schedulePersist(): void {
    if (!this.persistPath || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.flushSync();
    }, PERSIST_DEBOUNCE_MS);
  }

  private load(): void {
    if (!this.persistPath || !existsSync(this.persistPath)) return;
    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(raw) as { version: number; states: [string, QuotaState][] };
      if (parsed.version !== 1) {
        log.warn({ version: parsed.version }, 'quota: unknown state version, ignoring');
        return;
      }
      this.states = new Map(parsed.states);
      log.info({ count: this.states.size }, 'quota: state restored from disk');
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'quota: failed to load persisted state');
    }
  }

  /** Test helper — wipe all state. */
  reset(): void {
    this.states.clear();
    this.dirty = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  /** Test helper — total identities tracked. */
  size(): number {
    return this.states.size;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────
// One tracker per process. The Pine server, CLI, and SSE server all share it.

let singleton: QuotaTracker | null = null;

export function getQuotaTracker(): QuotaTracker {
  if (!singleton) singleton = new QuotaTracker();
  return singleton;
}

/**
 * Compatibility helpers — set / get / clear the request-scoped identity.
 * Prefer `context.runWithIdentity()` for new code (wraps AsyncLocalStorage.run).

/**
 * Build the standard `X-Quota-*` response headers from a status.
 * Lets clients (Cursor, Claude Desktop plugins, web overlays) see quota
 * pressure in dev tools without polling.
 */
export function quotaHeaders(status: QuotaStatus): Record<string, string> {
  if (!status.enabled) return {};
  return {
    'X-Quota-Limit': String(status.limit),
    'X-Quota-Used': String(status.used),
    'X-Quota-Remaining': String(status.remaining),
    'X-Quota-Reset': status.resetAt,
    'X-Quota-Period': status.period,
  };
}
