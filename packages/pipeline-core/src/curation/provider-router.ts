// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Self-Healing Provider Router with Graceful Degradation
 *
 * Maintains a list of AI providers (local, nvidia, zai, etc.), tracks their
 * health with exponential backoff, auto-rotates on failure, and auto-recovers
 * after the backoff period expires.
 *
 * Uses the AI Gateway's /v1/models endpoint at http://127.0.0.1:8080/v1/models
 * to auto-discover available models and providers.
 *
 * Degradation order: local (llama instances) → nvidia cloud → zai cloud → others
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProviderHealth = 'healthy' | 'degraded' | 'down';

export interface ModelInfo {
  id: string;
  owned_by: string;
  backend?: string;
}

export interface ProviderDefinition {
  /** Unique provider name (e.g. 'local', 'nvidia', 'zai') */
  name: string;
  /** Base URL for API calls (e.g. http://127.0.0.1:8080/v1) */
  baseUrl: string;
  /** Optional API key for this provider */
  apiKey?: string;
  /** Function to determine if a discovered model belongs to this provider */
  modelFilter: (model: ModelInfo) => boolean;
  /** Optional: explicit model name to use (if not set, picks best from discovered models) */
  model?: string;
  /** Priority: lower number = tried first (local=0, nvidia=1, zai=2, others=3) */
  priority: number;
  /** Optional: preferred model prefix pattern for model selection */
  preferredModelPattern?: string;
}

export interface ProviderState extends ProviderDefinition {
  /** List of model IDs discovered for this provider */
  models: string[];
  /** Current health status */
  health: ProviderHealth;
  /** Timestamp (epoch ms) of last failure */
  lastFailure: number;
  /** Current backoff duration in ms */
  currentBackoff: number;
  /** Timestamp (epoch ms) when a down provider may be retried */
  nextRetryAt: number;
  /** Consecutive failure count */
  failureCount: number;
  /** Timestamp (epoch ms) of last successful request */
  lastSuccess: number;
}

export interface ProviderRouterConfig {
  /** Gateway endpoint for model discovery (default: http://127.0.0.1:8080/v1) */
  discoveryEndpoint?: string;
  /** Initial backoff in ms (default: 30_000) */
  initialBackoff?: number;
  /** Maximum backoff in ms (default: 600_000 = 10 min) */
  maxBackoff?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** How often to re-discover models in ms (default: 300_000 = 5 min) */
  discoveryIntervalMs?: number;
  /** Whether to auto-discover models on construction */
  autoDiscover?: boolean;
  /** Override the default providers */
  providers?: ProviderDefinition[];
  /** API key to pass through to providers */
  apiKey?: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface RouterStatus {
  providers: {
    name: string;
    health: ProviderHealth;
    models: string[];
    failureCount: number;
    lastFailure: number;
    lastSuccess: number;
    nextRetryAt: number;
    currentBackoff: number;
    priority: number;
  }[];
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  totalProviders: number;
}

/* ------------------------------------------------------------------ */
/*  Default Provider Definitions                                       */
/* ------------------------------------------------------------------ */

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';
const DEFAULT_GATEWAY = 'http://127.0.0.1:8080/v1';

const DEFAULT_PROVIDERS: ProviderDefinition[] = [
  {
    name: 'local',
    baseUrl: DEFAULT_GATEWAY,
    modelFilter: (m) =>
      m.backend === 'llama-sentry' ||
      m.backend === 'llama-3090-moe' ||
      m.backend === 'llama' ||
      m.owned_by === 'llama-sentry' ||
      m.owned_by === 'llama-3090-moe' ||
      (m.backend != null && m.backend.startsWith('llama-')),
    priority: 0,
    preferredModelPattern: 'Qwen3.5-4B',
  },
  {
    name: 'nvidia',
    baseUrl: DEFAULT_GATEWAY,
    modelFilter: (m) =>
      m.owned_by === 'nvidia' &&
      m.backend === 'nvidia',
    priority: 1,
    preferredModelPattern: 'qwen3.5-27b',
  },
  {
    name: 'zai',
    baseUrl: DEFAULT_GATEWAY,
    modelFilter: (m) =>
      m.owned_by === 'zai' ||
      m.backend === 'zai' ||
      m.id.startsWith('glm-') ||
      m.id.startsWith('z-ai/'),
    priority: 2,
    preferredModelPattern: 'glm-4.7',
  },
];

/* ------------------------------------------------------------------ */
/*  Provider Router                                                    */
/* ------------------------------------------------------------------ */

export class ProviderRouter {
  private providers: Map<string, ProviderState> = new Map();
  private config: Required<ProviderRouterConfig>;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;
  private discoverPromise: Promise<void> | null = null;

  constructor(config: ProviderRouterConfig = {}) {
    this.config = {
      discoveryEndpoint: config.discoveryEndpoint || DEFAULT_GATEWAY,
      initialBackoff: config.initialBackoff ?? 30_000,
      maxBackoff: config.maxBackoff ?? 600_000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      discoveryIntervalMs: config.discoveryIntervalMs ?? 300_000,
      autoDiscover: config.autoDiscover ?? true,
      providers: config.providers || DEFAULT_PROVIDERS,
      apiKey: config.apiKey || '',
    };

    // Initialize provider states
    for (const def of this.config.providers) {
      this.providers.set(def.name, {
        ...def,
        models: [],
        health: 'healthy',
        lastFailure: 0,
        currentBackoff: this.config.initialBackoff,
        nextRetryAt: 0,
        failureCount: 0,
        lastSuccess: 0,
      });
    }

    // Start auto-discovery
    if (this.config.autoDiscover) {
      this.discoverPromise = this.discoverModels();
      this.startBackgroundTimers();
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Model Discovery                                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Fetch /v1/models and classify discovered models into providers.
   */
  async discoverModels(): Promise<void> {
    const endpoint = this.config.discoveryEndpoint.replace(/\/$/, '');
    try {
      const response = await fetch(`${endpoint}/models`, {
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!response.ok) {
        console.warn(`[ProviderRouter] Model discovery failed (HTTP ${response.status})`);
        return;
      }

      const data: { data?: ModelInfo[] } = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        console.warn('[ProviderRouter] Invalid /v1/models response');
        return;
      }

      const models = data.data;

      // Assign models to providers
      for (const [name, state] of this.providers) {
        const matched = models.filter((m) => state.modelFilter(m));
        const modelIds = [...new Set(matched.map((m) => m.id))];
        state.models = modelIds.length > 0 ? modelIds : state.models; // keep old if none matched
      }

      // Log discovery
      const summaries: string[] = [];
      for (const [name, state] of this.providers) {
        summaries.push(`${name}:${state.models.length} models`);
      }
      console.log(`[ProviderRouter] Discovery complete — ${summaries.join(', ')}`);
    } catch (err) {
      console.warn('[ProviderRouter] Model discovery error:', (err as Error).message);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Provider Selection                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Get all providers sorted by priority (lowest first = tried first).
   */
  private getSortedProviders(): ProviderState[] {
    return [...this.providers.values()].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get the best available provider for a request.
   * Returns providers that are healthy or have exceeded their backoff.
   * Falls back through priority order.
   */
  private getAvailableProvider(): ProviderState | null {
    const now = Date.now();
    const sorted = this.getSortedProviders();

    for (const provider of sorted) {
      if (provider.health === 'healthy') {
        return provider;
      }
      if (provider.health === 'down' && now >= provider.nextRetryAt) {
        // Mark for retry (transition to degraded)
        provider.health = 'degraded';
        console.log(`[ProviderRouter] ${provider.name} moved to degraded — retry eligible`);
        return provider;
      }
      if (provider.health === 'degraded') {
        return provider;
      }
    }

    // Last resort: try the one with the earliest retry
    let best: ProviderState | null = null;
    for (const provider of sorted) {
      if (provider.models.length > 0) {
        if (!best || provider.nextRetryAt < best.nextRetryAt) {
          best = provider;
        }
      }
    }
    if (best && now >= best.nextRetryAt) {
      best.health = 'degraded';
      console.log(`[ProviderRouter] ${best.name} moved to degraded (last resort retry)`);
      return best;
    }

    return best;
  }

  /**
   * Get the best model name for a provider.
   */
  private getModelForProvider(provider: ProviderState): string | undefined {
    // If an explicit model is configured, use it
    if (provider.model) return provider.model;

    const models = provider.models;
    if (models.length === 0) return undefined;

    // Try to match the preferred pattern
    if (provider.preferredModelPattern) {
      const preferred = models.find((m) =>
        m.toLowerCase().includes(provider.preferredModelPattern!.toLowerCase()),
      );
      if (preferred) return preferred;
    }

    // Return first available
    return models[0];
  }

  /* ---------------------------------------------------------------- */
  /*  Health Tracking                                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Record a successful completion for a provider.
   */
  private recordSuccess(provider: ProviderState): void {
    provider.health = 'healthy';
    provider.lastFailure = 0;
    provider.lastSuccess = Date.now();
    provider.failureCount = 0;
    provider.currentBackoff = this.config.initialBackoff;
    provider.nextRetryAt = 0;
  }

  /**
   * Record a failure for a provider with exponential backoff.
   */
  private recordFailure(provider: ProviderState): void {
    provider.failureCount++;
    provider.lastFailure = Date.now();

    // Exponential backoff capped at maxBackoff
    const backoff = this.config.initialBackoff * Math.pow(this.config.backoffMultiplier, provider.failureCount - 1);
    provider.currentBackoff = Math.min(backoff, this.config.maxBackoff);
    provider.nextRetryAt = Date.now() + provider.currentBackoff;

    // Degrade after first failure, down after 3 consecutive
    if (provider.failureCount >= 3) {
      provider.health = 'down';
      console.warn(
        `[ProviderRouter] ${provider.name} marked DOWN (${provider.failureCount} failures). ` +
        `Retry in ${Math.round(provider.currentBackoff / 1000)}s`,
      );
    } else {
      provider.health = 'degraded';
      console.warn(
        `[ProviderRouter] ${provider.name} degraded (failure #${provider.failureCount}). ` +
        `Backoff: ${Math.round(provider.currentBackoff / 1000)}s`,
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Chat Completion (Router)                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Send a chat completion request, routing through available providers.
   * Auto-rotates on failure, degrades gracefully.
   */
  async chatComplete(
    prompt: string,
    options: ChatCompletionOptions = {},
  ): Promise<string> {
    const { temperature = 0.3, maxTokens = 1024, jsonMode = true } = options;
    const body: Record<string, unknown> = {
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // Collect errors for logging
    const errors: string[] = [];

    for (let round = 0; round < 3; round++) {
      // Refresh discovery if stale (every call, but only if > 30s since last)
      // This ensures we eventually pick up new models
      const provider = this.getAvailableProvider();

      if (!provider) {
        // All providers down — force a discovery refresh and try again
        if (round === 0) {
          await this.discoverModels();
          continue;
        }
        throw new Error(
          `ProviderRouter: all providers down. Errors: ${errors.join('; ') || 'no providers available'}`,
        );
      }

      const model = this.getModelForProvider(provider);
      if (!model) {
        errors.push(`${provider.name}: no models available`);
        provider.health = 'down';
        provider.lastFailure = Date.now();
        continue;
      }

      body.model = model;

      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };
      if (provider.apiKey || this.config.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey || this.config.apiKey}`;
      }

      const endpoint = provider.baseUrl.replace(/\/$/, '');

      try {
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `${provider.name} error (HTTP ${response.status}): ${errorText.slice(0, 500)}`;
          errors.push(errorMsg);
          this.recordFailure(provider);
          continue; // try next provider
        }

        const data: any = await response.json();
        this.recordSuccess(provider);
        return data.choices[0].message.content;
      } catch (err) {
        const errorMsg = `${provider.name} error: ${(err as Error).message}`;
        errors.push(errorMsg);
        this.recordFailure(provider);
        // continue to next provider
      }
    }

    throw new Error(
      `ProviderRouter: all providers exhausted after rotation. Errors: ${errors.join('; ')}`,
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Status & Health Reporting                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Get current status of all providers.
   */
  getStatus(): RouterStatus {
    const providers = [...this.providers.values()].map((p) => ({
      name: p.name,
      health: p.health,
      models: p.models,
      failureCount: p.failureCount,
      lastFailure: p.lastFailure,
      lastSuccess: p.lastSuccess,
      nextRetryAt: p.nextRetryAt,
      currentBackoff: p.currentBackoff,
      priority: p.priority,
    }));

    let healthyCount = 0;
    let degradedCount = 0;
    let downCount = 0;

    for (const p of providers) {
      if (p.health === 'healthy') healthyCount++;
      else if (p.health === 'degraded') degradedCount++;
      else downCount++;
    }

    return { providers, healthyCount, degradedCount, downCount, totalProviders: providers.length };
  }

  /**
   * Manually set a provider's health (useful for external monitoring).
   */
  setProviderHealth(name: string, health: ProviderHealth): boolean {
    const provider = this.providers.get(name);
    if (!provider) return false;
    provider.health = health;
    if (health === 'healthy') {
      provider.failureCount = 0;
      provider.currentBackoff = this.config.initialBackoff;
      provider.nextRetryAt = 0;
    }
    return true;
  }

  /**
   * Add or update a provider definition at runtime.
   */
  upsertProvider(def: ProviderDefinition): void {
    const existing = this.providers.get(def.name);
    if (existing) {
      Object.assign(existing, def);
    } else {
      this.providers.set(def.name, {
        ...def,
        models: [],
        health: 'healthy',
        lastFailure: 0,
        currentBackoff: this.config.initialBackoff,
        nextRetryAt: 0,
        failureCount: 0,
        lastSuccess: 0,
      });
    }
  }

  /**
   * Force a model discovery refresh.
   */
  async refreshDiscovery(): Promise<void> {
    await this.discoverModels();
  }

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  private startBackgroundTimers(): void {
    // Periodic model rediscovery
    this.discoveryTimer = setInterval(() => {
      this.discoverModels().catch((err) =>
        console.warn('[ProviderRouter] Background discovery error:', err.message),
      );
    }, this.config.discoveryIntervalMs);

    // Recovery check: every 15s, try to revive down providers past their backoff
    this.recoveryTimer = setInterval(() => {
      const now = Date.now();
      for (const provider of this.providers.values()) {
        if (
          provider.health === 'down' &&
          now >= provider.nextRetryAt &&
          provider.lastFailure > 0
        ) {
          provider.health = 'degraded';
          console.log(`[ProviderRouter] Auto-recovery: ${provider.name} moved to degraded`);
        }
      }
    }, 15_000);
  }

  /**
   * Stop background timers. Call on shutdown.
   */
  destroy(): void {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  /**
   * Wait for initial discovery to complete (useful at startup).
   */
  async waitForDiscovery(timeoutMs = 30_000): Promise<void> {
    if (this.discoverPromise) {
      await Promise.race([
        this.discoverPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Discovery timeout')), timeoutMs),
        ),
      ]);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: create default router instance                              */
/* ------------------------------------------------------------------ */

let defaultRouter: ProviderRouter | null = null;

export function getDefaultRouter(): ProviderRouter {
  if (!defaultRouter) {
    defaultRouter = new ProviderRouter({
      autoDiscover: true,
    });
  }
  return defaultRouter;
}

/* ------------------------------------------------------------------ */
/*  ProviderHealthChecker                                              */
/* ------------------------------------------------------------------ */

interface HealthCheckResult {
  alive: boolean;
  latencyMs: number;
  lastError: string | null;
}

interface CacheEntry {
  result: HealthCheckResult;
  cachedAt: number;
}

/**
 * Lightweight health checker that pings a provider's base URL via HEAD
 * and caches the result for 30 seconds to avoid hammering down providers.
 */
export class ProviderHealthChecker {
  private cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 30_000;
  private readonly timeoutMs = 5_000;

  /**
   * Perform a health check against the given provider base URL.
   * Results are cached per providerId for 30 seconds.
   */
  async check(
    providerId: string,
    baseUrl: string,
  ): Promise<HealthCheckResult> {
    const cached = this.cache.get(providerId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached.result;
    }

    const start = Date.now();
    try {
      const url = baseUrl.replace(/\/$/, '');
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { 'User-Agent': USER_AGENT },
      });
      const latencyMs = Date.now() - start;
      const result: HealthCheckResult = {
        alive: response.ok,
        latencyMs,
        lastError: response.ok ? null : `HTTP ${response.status}`,
      };
      this.cache.set(providerId, { result, cachedAt: Date.now() });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - start;
      const result: HealthCheckResult = {
        alive: false,
        latencyMs,
        lastError: (err as Error).message,
      };
      this.cache.set(providerId, { result, cachedAt: Date.now() });
      return result;
    }
  }

  /** Clear the health check cache for a specific provider (or all if omitted). */
  clearCache(providerId?: string): void {
    if (providerId) {
      this.cache.delete(providerId);
    } else {
      this.cache.clear();
    }
  }
}

/* ------------------------------------------------------------------ */
/*  CircuitBreaker                                                    */
/* ------------------------------------------------------------------ */

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitEntry {
  failures: number;
  lastFailure: number;
  state: CircuitState;
}

/**
 * Circuit breaker that trips after 3 failures within a 60-second window
 * and stays open for a 5-minute cool-down before allowing trial requests.
 */
export class CircuitBreaker {
  private circuits = new Map<string, CircuitEntry>();
  private readonly failureThreshold = 3;
  private readonly failureWindowMs = 60_000;
  private readonly cooldownMs = 300_000;

  /**
   * Record a failure for the given provider.
   * Opens the circuit after 3 failures within a 60s sliding window.
   * A single failure while in half-open immediately re-opens the circuit.
   */
  recordFailure(providerId: string): void {
    const now = Date.now();
    let circuit = this.circuits.get(providerId);

    if (!circuit) {
      this.circuits.set(providerId, {
        failures: 1,
        lastFailure: now,
        state: 'closed',
      });
      return;
    }

    // In half-open, a single failure re-opens the circuit
    if (circuit.state === 'half-open') {
      circuit.lastFailure = now;
      circuit.state = 'open';
      return;
    }

    // Reset failure count if outside the 60s window
    if (now - circuit.lastFailure > this.failureWindowMs) {
      circuit.failures = 0;
    }

    circuit.failures++;
    circuit.lastFailure = now;

    if (circuit.failures >= this.failureThreshold) {
      circuit.state = 'open';
    }
  }

  /**
   * Record a success for the given provider.
   * Resets the failure counter and closes the circuit.
   */
  recordSuccess(providerId: string): void {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return;
    circuit.failures = 0;
    circuit.state = 'closed';
  }

  /**
   * Returns true if the circuit is currently open (requests should not be sent).
   * Automatically transitions from open → half-open after the 5-minute cool-down
   * so that a single trial request is allowed.
   */
  isOpen(providerId: string): boolean {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return false;

    if (circuit.state === 'open') {
      // Check if cool-down has expired — transition to half-open
      if (Date.now() - circuit.lastFailure >= this.cooldownMs) {
        circuit.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Get the current circuit state for a provider.
   * Returns 'closed' if no state has been recorded yet.
   */
  getState(providerId: string): string {
    const circuit = this.circuits.get(providerId);
    return circuit ? circuit.state : 'closed';
  }
}

/* ------------------------------------------------------------------ */
/*  Logging Helper                                                    */
/* ------------------------------------------------------------------ */

/**
 * Write a structured log entry with timestamp and provider context.
 */
export function logProviderEvent(
  level: 'info' | 'warn' | 'error',
  providerId: string,
  message: string,
  data?: unknown,
): void {
  const timestamp = new Date().toISOString();
  const dataSuffix = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  const formatted = `[${timestamp}] [Provider:${providerId}] ${message}${dataSuffix}`;

  switch (level) {
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback Chain                                                    */
/* ------------------------------------------------------------------ */

interface FallbackAttempt {
  provider: string;
  status: string;
  error?: string;
}

interface FallbackResult {
  result: unknown;
  providerUsed: string;
  attempts: FallbackAttempt[];
}

// Module-level circuit breaker instance shared by routeWithFallback
const fallbackCircuitBreaker = new CircuitBreaker();

/**
 * Try providers sequentially with exponential backoff.
 * Skips providers whose circuit breaker is open.
 *
 * @param providers - Ordered list of provider IDs to attempt.
 * @param requestFn - Async function that performs the actual request for a provider.
 * @param circuitBreaker - Optional CircuitBreaker instance (defaults to a shared singleton).
 * @returns The first successful result along with the provider that served it.
 * @throws AggregateError if all providers fail.
 */
export async function routeWithFallback(
  providers: string[],
  requestFn: (providerId: string) => Promise<unknown>,
  circuitBreaker?: CircuitBreaker,
): Promise<FallbackResult> {
  const cb = circuitBreaker || fallbackCircuitBreaker;
  const attempts: FallbackAttempt[] = [];
  const errors: Error[] = [];

  for (let i = 0; i < providers.length; i++) {
    const providerId = providers[i];

    // Check circuit breaker — skip open circuits
    if (cb.isOpen(providerId)) {
      attempts.push({ provider: providerId, status: 'circuit-open' });
      logProviderEvent('warn', providerId, 'Circuit open — skipping');
      errors.push(new Error(`Circuit breaker open for ${providerId}`));
      continue;
    }

    try {
      const result = await requestFn(providerId);
      cb.recordSuccess(providerId);
      attempts.push({ provider: providerId, status: 'success' });
      logProviderEvent('info', providerId, 'Request succeeded');
      return { result, providerUsed: providerId, attempts };
    } catch (err) {
      const error = err as Error;
      cb.recordFailure(providerId);
      attempts.push({
        provider: providerId,
        status: 'failed',
        error: error.message,
      });
      logProviderEvent('error', providerId, `Request failed: ${error.message}`);

      errors.push(error);

      // Exponential backoff before next provider (1s * 2^attempt)
      if (i < providers.length - 1) {
        const backoffMs = 1000 * Math.pow(2, i);
        logProviderEvent(
          'warn',
          providerId,
          `Backing off ${backoffMs}ms before next provider`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new AggregateError(
    errors,
    `All ${providers.length} providers failed`,
  );
}
