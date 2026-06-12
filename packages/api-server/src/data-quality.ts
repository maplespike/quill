/**
 * MapleSpike — Data Quality Checker
 *
 * Probes healthCheckUrl for all modules, checks freshness vs updateFrequency,
 * and aggregates error rates from pipeline ingestion events.
 *
 * Results are cached for 5 minutes (300 seconds) to avoid hammering upstream APIs.
 *
 * This feeds the /v1/data/quality endpoint and the Grafana dashboard.
 *
 * Architecture:
 *   getAllModules()   → for each module:
 *                         1. health-check the upstream (HEAD / healthCheckUrl)
 *                         2. compute freshness from lastSuccess vs updateFrequency
 *                         3. aggregate errors from HealthMonitor ingestion events
 *                        → returns structured ModuleQualityReport[]
 */

import type { ModuleInfo } from '@maplespike/pipeline-core';
import { getAllModules } from '@maplespike/pipeline-core';
import { globalCache } from './cache.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FreshnessStatus = 'fresh' | 'stale' | 'unknown';

export type HealthCheckStatus = 'up' | 'down' | 'untested';

export interface ModuleQualityReport {
  moduleName: string;
  category: string;
  description: string;
  /** Whether the module has a healthCheckUrl configured */
  hasHealthCheck: boolean;
  /** Active health probe result (HEAD request to healthCheckUrl) */
  healthCheckStatus: HealthCheckStatus;
  /** ISO timestamp of last successful ingestion */
  lastSuccess: string | null;
  /** ISO timestamp of last failed ingestion */
  lastError: string | null;
  /** Last error message, if any */
  lastErrorMessage: string | null;
  /** Number of records found (from ingestion events - total success count) */
  recordsFound: number;
  /** Freshness status relative to updateFrequency */
  freshnessStatus: FreshnessStatus;
  /** Expected update cadence as declared in the module registry */
  updateFrequency: string;
  /** Freshness score 0.0–1.0 (1.0 = just ingested) */
  freshnessScore: number;
  /** Age of data in seconds since last successful ingestion */
  ageSeconds: number;
  /** Staleness threshold in seconds derived from updateFrequency */
  staleThresholdSeconds: number;
  /** Total ingestion runs tracked */
  totalRuns: number;
  /** Success rate (0.0–1.0) */
  successRate: number;
  /** Consecutive failures */
  consecutiveFailures: number;
}

export interface DataQualitySummary {
  /** Aggregated status for the entire pipeline */
  status: 'healthy' | 'degraded' | 'unhealthy';
  totalModules: number;
  modulesProbed: number;
  modulesWithHealthUrl: number;
  healthCheckResults: {
    up: number;
    down: number;
    untested: number;
  };
  freshnessResults: {
    fresh: number;
    stale: number;
    unknown: number;
  };
  errorAggregation: {
    totalErrors: number;
    modulesWithErrors: number;
    topErrors: Array<{ moduleName: string; error: string; count: number }>;
  };
  modules: ModuleQualityReport[];
  computedAt: string;
  cacheTTLSeconds: number;
}

/* ------------------------------------------------------------------ */
/*  Update Frequency Parsing                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a freeform updateFrequency string into a staleness threshold in seconds.
 * Handles common patterns like "30 min", "daily", "weekly", "monthly", etc.
 */
export function parseUpdateFrequencyToSeconds(freq: string): number {
  const normalized = freq.toLowerCase().trim();

  // Named cadences
  const cadenceMap: Record<string, number> = {
    continuous: 300,          // 5 min — treat as near-realtime
    realtime: 300,
    '30 min': 1800,
    hourly: 3600,
    daily: 86400,
    weekly: 604800,
    monthly: 2592000,
    quarterly: 7776000,
    annual: 31536000,
    yearly: 31536000,
    'on-ingest': Infinity,    // never stale by time
    'on-demand': Infinity,
    unknown: 86400,           // default to daily
  };

  if (cadenceMap[normalized] !== undefined) return cadenceMap[normalized];

  // Try to extract numeric patterns like "30 min", "2 hours", "7 days"
  const numMatch = normalized.match(/^(\d+)\s*(min|hour|day|week|month|year)s?$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const unit = numMatch[2];
    switch (unit) {
      case 'min':   return num * 60;
      case 'hour':  return num * 3600;
      case 'day':   return num * 86400;
      case 'week':  return num * 604800;
      case 'month': return num * 2592000;
      case 'year':  return num * 31536000;
    }
  }

  // Multi-cadence descriptors like "annual (budget), quarterly (fiscal monitor)"
  // — take the fastest one
  const parts = normalized.split(/[,\s]+/);
  let fastest = Infinity;
  for (const part of parts) {
    const trimmed = part.replace(/\(.*?\)/g, '').trim();
    if (!trimmed) continue;
    const seconds = parseUpdateFrequencyToSeconds(trimmed);
    if (seconds < fastest) fastest = seconds;
  }
  if (fastest < Infinity) return fastest;

  return 86400; // default: 24 hours
}

/* ------------------------------------------------------------------ */
/*  Health Probing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Probe a module's healthCheckUrl with a HEAD request.
 * Returns 'up' if reachable (2xx-4xx), 'down' if unreachable,
 * 'untested' if no healthCheckUrl configured.
 */
async function probeModuleHealth(mod: ModuleInfo): Promise<HealthCheckStatus> {
  if (!mod.healthCheckUrl) return 'untested';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(mod.healthCheckUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Treat 2xx-4xx as alive (4xx means endpoint exists, just no data)
    if (resp.status >= 200 && resp.status < 500) return 'up';
    return 'down';
  } catch {
    return 'down';
  }
}

/* ------------------------------------------------------------------ */
/*  Freshness Computation                                             */
/* ------------------------------------------------------------------ */

/**
 * Compute freshness status by comparing the time since last success
 * against the staleness threshold derived from updateFrequency.
 */
function computeFreshness(
  lastSuccessAt: string | null,
  updateFrequency: string,
): { freshnessStatus: FreshnessStatus; ageSeconds: number; staleThresholdSeconds: number; freshnessScore: number } {
  const staleThreshold = parseUpdateFrequencyToSeconds(updateFrequency);

  if (!lastSuccessAt) {
    return {
      freshnessStatus: 'unknown',
      ageSeconds: Infinity,
      staleThresholdSeconds: staleThreshold,
      freshnessScore: 0,
    };
  }

  const ageSeconds = Math.floor((Date.now() - new Date(lastSuccessAt).getTime()) / 1000);

  let freshnessStatus: FreshnessStatus;
  let freshnessScore: number;

  if (staleThreshold === Infinity) {
    // Event-driven / on-ingest modules — never stale by time
    freshnessStatus = 'fresh';
    freshnessScore = 1.0;
  } else if (ageSeconds <= staleThreshold) {
    freshnessStatus = 'fresh';
    // Score decays linearly: 1.0 → 0.5 at threshold
    freshnessScore = Math.max(0.5, 1.0 - (ageSeconds / staleThreshold) * 0.5);
  } else {
    freshnessStatus = 'stale';
    // Score continues decaying: 0.5 → 0.0 at 2x threshold
    freshnessScore = Math.max(0, 0.5 - ((ageSeconds - staleThreshold) / staleThreshold) * 0.5);
  }

  freshnessScore = Math.round(freshnessScore * 1000) / 1000;

  return { freshnessStatus, ageSeconds, staleThresholdSeconds: staleThreshold, freshnessScore };
}

/* ------------------------------------------------------------------ */
/*  Error Aggregation (from pipeline HealthMonitor)                     */
/* ------------------------------------------------------------------ */

let healthMonitor: { getModuleHealth(name: string): { lastSuccessAt: string | null; lastFailureAt: string | null; lastError: string | null; successCount: number; totalRuns: number; successRate: number; consecutiveFailures: number } } | null = null;

/**
 * Lazily resolve the pipeline-core HealthMonitor singleton.
 * Returns null if the module isn't available (graceful degradation).
 */
function getMonitor(): typeof healthMonitor {
  if (healthMonitor !== undefined) return healthMonitor;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplespike/pipeline-core') as typeof import('@maplespike/pipeline-core');
    if (typeof mod.getHealthMonitor === 'function') {
      healthMonitor = mod.getHealthMonitor();
    } else {
      healthMonitor = null;
    }
  } catch {
    healthMonitor = null;
  }
  return healthMonitor;
}

/**
 * Extract ingestion event data from the pipeline-core HealthMonitor singleton.
 * Gracefully handles the monitor not being available.
 */
function getModuleIngestionData(moduleName: string): {
  lastSuccess: string | null;
  lastError: string | null;
  lastErrorMessage: string | null;
  recordsFound: number;
  totalRuns: number;
  successRate: number;
  consecutiveFailures: number;
} {
  const monitor = getMonitor();
  if (!monitor) {
    return {
      lastSuccess: null,
      lastError: null,
      lastErrorMessage: null,
      recordsFound: 0,
      totalRuns: 0,
      successRate: 0,
      consecutiveFailures: 0,
    };
  }

  try {
    const health = monitor.getModuleHealth(moduleName);
    return {
      lastSuccess: health.lastSuccessAt,
      lastError: health.lastFailureAt,
      lastErrorMessage: health.lastError,
      recordsFound: health.successCount,
      totalRuns: health.totalRuns,
      successRate: health.successRate,
      consecutiveFailures: health.consecutiveFailures,
    };
  } catch {
    return {
      lastSuccess: null,
      lastError: null,
      lastErrorMessage: null,
      recordsFound: 0,
      totalRuns: 0,
      successRate: 0,
      consecutiveFailures: 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Main Report Generator                                              */
/* ------------------------------------------------------------------ */

const CACHE_KEY = 'data-quality:report';
const CACHE_TTL = 300; // 5 minutes

/**
 * Generate the data quality report for all modules.
 * Results are cached for 5 minutes.
 */
export async function getDataQualityReport(): Promise<DataQualitySummary> {
  // Check cache first
  const cached = globalCache.get<DataQualitySummary>(CACHE_KEY);
  if (cached) return cached;

  const modules = getAllModules();

  const reports: ModuleQualityReport[] = [];
  let modulesWithHealthUrl = 0;
  let up = 0;
  let down = 0;
  let untested = 0;
  let fresh = 0;
  let stale = 0;
  let unknown = 0;
  let totalErrors = 0;
  let modulesWithErrors = 0;
  const errorMap = new Map<string, { count: number; moduleName: string; error: string }>();

  for (const mod of modules) {
    // Skip placeholder modules (they have no real data)
    if (mod.status === 'placeholder') continue;

    // Health probe
    const healthStatus = await probeModuleHealth(mod);
    if (mod.healthCheckUrl) modulesWithHealthUrl++;
    switch (healthStatus) {
      case 'up': up++; break;
      case 'down': down++; break;
      case 'untested': untested++; break;
    }

    // Ingestion event data from pipeline monitor
    const ingestion = getModuleIngestionData(mod.name);

    // Freshness
    const freshness = computeFreshness(ingestion.lastSuccess, mod.updateFrequency);
    switch (freshness.freshnessStatus) {
      case 'fresh': fresh++; break;
      case 'stale': stale++; break;
      case 'unknown': unknown++; break;
    }

    // Error aggregation
    if (ingestion.lastErrorMessage) {
      totalErrors++;
      modulesWithErrors++;
      const errKey = `${ingestion.lastErrorMessage}`;
      const existing = errorMap.get(errKey);
      if (existing) {
        existing.count++;
      } else {
        errorMap.set(errKey, { count: 1, moduleName: mod.name, error: ingestion.lastErrorMessage });
      }
    }

    reports.push({
      moduleName: mod.name,
      category: mod.category,
      description: mod.description,
      hasHealthCheck: !!mod.healthCheckUrl,
      healthCheckStatus: healthStatus,
      lastSuccess: ingestion.lastSuccess,
      lastError: ingestion.lastError,
      lastErrorMessage: ingestion.lastErrorMessage,
      recordsFound: ingestion.recordsFound,
      freshnessStatus: freshness.freshnessStatus,
      updateFrequency: mod.updateFrequency,
      freshnessScore: freshness.freshnessScore,
      ageSeconds: freshness.ageSeconds,
      staleThresholdSeconds: freshness.staleThresholdSeconds,
      totalRuns: ingestion.totalRuns,
      successRate: ingestion.successRate,
      consecutiveFailures: ingestion.consecutiveFailures,
    });
  }

  // Compute top errors (sorted by count descending)
  const topErrors = Array.from(errorMap.entries())
    .map(([, v]) => v)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Determine overall status
  const totalProbed = reports.length;
  let status: DataQualitySummary['status'] = 'healthy';
  const errorRatio = totalProbed > 0 ? totalErrors / totalProbed : 0;
  const downRatio = totalProbed > 0 ? down / totalProbed : 0;

  if (downRatio > 0.3 || errorRatio > 0.5) {
    status = 'unhealthy';
  } else if (downRatio > 0.1 || errorRatio > 0.2 || stale > fresh) {
    status = 'degraded';
  }

  const summary: DataQualitySummary = {
    status,
    totalModules: modules.length,
    modulesProbed: totalProbed,
    modulesWithHealthUrl,
    healthCheckResults: { up, down, untested },
    freshnessResults: { fresh, stale, unknown },
    errorAggregation: {
      totalErrors,
      modulesWithErrors,
      topErrors,
    },
    modules: reports,
    computedAt: new Date().toISOString(),
    cacheTTLSeconds: CACHE_TTL,
  };

  // Cache for 5 minutes
  globalCache.set(CACHE_KEY, summary, CACHE_TTL);

  return summary;
}

/**
 * Invalidate the cached data quality report (e.g., after manual trigger).
 */
export function invalidateQualityCache(): void {
  globalCache.delete(CACHE_KEY);
}

/**
 * Get a fresh data quality report for a single module by name.
 */
export async function getModuleQualityReport(moduleName: string): Promise<ModuleQualityReport | null> {
  const full = await getDataQualityReport();
  return full.modules.find(m => m.moduleName === moduleName) ?? null;
}
