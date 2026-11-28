/**
 * Tenant counters — Durable Objects instead of KV.
 *
 * Why this exists
 * ---------------
 * The rate limiter and the neuron budget were both KV counters, written once
 * per AI request. Workers KV allows **1,000 writes per day** on the free plan,
 * and this worker made two writes per call (window increment + neuron
 * increment), so the account's write budget died after roughly 500 requests.
 * Every subsequent write fails, which surfaces to callers as a 500 that looks
 * like an application bug rather than an exhausted quota.
 *
 * A Durable Object is the right primitive for a counter: single-threaded,
 * strongly consistent, no per-write quota. Durable Objects get 100,000
 * requests/day on the free plan and each AI call makes exactly two counter
 * calls (one rate limit, one neuron), so the counter path now supports ~50k
 * AI calls/day instead of ~500.
 *
 * Two instances, because the two counters have different scopes:
 *   - `rate:<tenantId>`  — one per tenant, a 60-second window
 *   - `neurons:global`   — a single instance, the account-wide daily budget
 *
 * The decision maths is pure and exported so it can be tested without a
 * Workers runtime.
 */

export interface RateWindow {
  count: number;
  /** Epoch ms at which this window stops counting. */
  resetAt: number;
}

export interface NeuronBudget {
  used: number;
  /** UTC date, YYYY-MM-DD. A different day resets the counter. */
  day: string;
}

export const RATE_WINDOW_MS = 60_000;

/**
 * Decide one request against a 60-second window and return the stored state.
 * `now` is injected so tests do not depend on the clock.
 */
export function decideRate(
  current: RateWindow | undefined,
  limit: number,
  now: number,
): { allowed: boolean; remaining: number; resetAt: number; next: RateWindow } {
  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const expired = !current || current.resetAt <= now;
  const count = expired ? 0 : current.count;
  const allowed = count < limit;
  const next: RateWindow = {
    count: allowed ? count + 1 : count,
    resetAt: expired ? windowStart + RATE_WINDOW_MS : current.resetAt,
  };
  return {
    allowed,
    remaining: Math.max(0, limit - next.count),
    resetAt: next.resetAt,
    next,
  };
}

/** Read the day's spend without spending any of it. */
export function decideNeuron(
  current: NeuronBudget | undefined,
  day: string,
  limit: number,
): { withinBudget: boolean; used: number; limit: number; next: NeuronBudget } {
  const used = current && current.day === day ? current.used : 0;
  return { withinBudget: used < limit, used, limit, next: { used, day } };
}

/** Spend one unit of the day's budget. */
export function consumeNeuron(
  current: NeuronBudget | undefined,
  day: string,
): NeuronBudget {
  const used = current && current.day === day ? current.used + 1 : 1;
  return { used, day };
}

/**
 * Check-and-spend in one operation, enforcing both the configured daily limit
 * and a hard call cap. One call instead of two keeps Durable Object requests
 * at 2 per AI request (rate limit + this), which is what keeps the counter
 * path inside the 100,000/day Durable Object free allowance.
 *
 * When either bound is reached the counter is NOT incremented: past the cap the
 * worker degrades to the homelab instead of spending more Workers AI Neurons,
 * and a burst cannot inflate the counter past its cap.
 */
export function consumeNeuronChecked(
  current: NeuronBudget | undefined,
  day: string,
  limit: number,
  cap: number = Number.POSITIVE_INFINITY,
): { allowed: boolean; used: number; limit: number; capped: boolean; next: NeuronBudget } {
  const used = current && current.day === day ? current.used : 0;
  const underLimit = used < limit;
  const underCap = used < cap;
  const allowed = underLimit && underCap;
  const next: NeuronBudget = { used: allowed ? used + 1 : used, day };
  return { allowed, used: next.used, limit, capped: !underCap, next };
}

interface DurableStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface DurableState {
  storage: DurableStorage;
}

const RATE_KEY = 'rate';
const NEURON_KEY = 'neurons';

/**
 * One Durable Object class serves both counters; the instance name decides
 * which one. Routes:
 *   POST /rate-limit      { limit }              -> { allowed, remaining, resetAt }
 *   GET  /neurons?day=…   &limit=…               -> { withinBudget, used, limit }
 *   POST /neurons         { day }                -> { used }
 */
export class TenantCounters {
  private readonly state: DurableState;

  constructor(state: DurableState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? ((await request.json()) as Record<string, unknown>) : {};

    if (url.pathname === '/rate-limit') {
      const limit = Number(body.limit);
      if (!Number.isFinite(limit) || limit <= 0) {
        return Response.json({ error: 'limit must be a positive number' }, { status: 400 });
      }
      const current = await this.state.storage.get<RateWindow>(RATE_KEY);
      const decision = decideRate(current, limit, Date.now());
      await this.state.storage.put(RATE_KEY, decision.next);
      return Response.json({
        allowed: decision.allowed,
        remaining: decision.remaining,
        resetAt: decision.resetAt,
      });
    }

    if (url.pathname === '/neurons' && request.method === 'GET') {
      const day = url.searchParams.get('day') ?? '';
      const limit = Number(url.searchParams.get('limit') ?? '0');
      const current = await this.state.storage.get<NeuronBudget>(NEURON_KEY);
      const { withinBudget, used, next } = decideNeuron(current, day, limit);
      if (!current || current.day !== day) {
        await this.state.storage.put(NEURON_KEY, next);
      }
      return Response.json({ withinBudget, used, limit });
    }

    if (url.pathname === '/neurons' && request.method === 'POST') {
      const day = String(body.day ?? '');
      if (!day) return Response.json({ error: 'day is required' }, { status: 400 });
      const limit = Number(body.limit ?? '0');
      const cap = body.cap === undefined ? Number.POSITIVE_INFINITY : Number(body.cap);
      const current = await this.state.storage.get<NeuronBudget>(NEURON_KEY);
      const result = consumeNeuronChecked(current, day, limit, cap);
      await this.state.storage.put(NEURON_KEY, result.next);
      return Response.json({
        allowed: result.allowed,
        used: result.used,
        limit: result.limit,
        capped: result.capped,
      });
    }

    return new Response('not found', { status: 404 });
  }
}

/** Durable Object instance name for a tenant's rate-limit window. */
export function rateObjectName(tenantId: string): string {
  return `rate:${tenantId}`;
}

/** Durable Object instance name for the account-wide daily neuron budget. */
export const NEURON_OBJECT_NAME = 'neurons:global';
