// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Health Monitor — Quill
 *
 * Tracks ingestion success/failure rates per module,
 * computes health status, and provides system-wide health summary.
 */

import type {
  ModuleHealthRecord,
  ModuleHealthStatus,
  SystemHealthSummary,
  HealthMonitorConfig,
} from './types.js';
import { getAllModules, healthCheckModule } from '../ingestion/registry.js';
import type { ModuleInfo } from '../ingestion/registry.js';

export const DEFAULT_CONFIG: HealthMonitorConfig = {
  consecutiveFailureThreshold: 3,
  successRateWarningThreshold: 0.7,
  successRateCriticalThreshold: 0.3,
  staleDataHours: 48,
};

interface IngestionEvent {
  moduleName: string;
  success: boolean;
  durationMs: number;
  error?: string;
  timestamp: string;
}

class HealthMonitor {
  private config: HealthMonitorConfig;
  private events: Map<string, IngestionEvent[]> = new Map();
  private upstreamCache: Map<string, { healthy: boolean; checkedAt: string }> = new Map();
  private static readonly MAX_EVENTS_PER_MODULE = 100;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  recordIngestion(
    moduleName: string,
    success: boolean,
    durationMs: number,
    error?: string,
  ): void {
    const event: IngestionEvent = {
      moduleName,
      success,
      durationMs,
      error,
      timestamp: new Date().toISOString(),
    };

    const events = this.events.get(moduleName) || [];
    events.push(event);
    if (events.length > HealthMonitor.MAX_EVENTS_PER_MODULE) {
      events.shift();
    }
    this.events.set(moduleName, events);
  }

  getModuleHealth(moduleName: string): ModuleHealthRecord {
    const events = this.events.get(moduleName) || [];
    const mod = getAllModules().find(m => m.name === moduleName);

    const successes = events.filter(e => e.success);
    const failures = events.filter(e => !e.success);
    const totalRuns = events.length;
    const successCount = successes.length;
    const failureCount = failures.length;
    const successRate = totalRuns > 0 ? successCount / totalRuns : 0;
    const avgDurationMs = successes.length > 0
      ? successes.reduce((s, e) => s + e.durationMs, 0) / successes.length
      : 0;

    let consecutiveFailures = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (!events[i].success) consecutiveFailures++;
      else break;
    }

    const lastSuccess = successes.length > 0 ? successes[successes.length - 1].timestamp : null;
    const lastFailure = failures.length > 0 ? failures[failures.length - 1].timestamp : null;
    const lastError = failures.length > 0 ? failures[failures.length - 1].error ?? null : null;
    const lastIngestion = events.length > 0 ? events[events.length - 1].timestamp : null;

    const upstream = this.upstreamCache.get(moduleName);
    const upstreamReachable = upstream?.healthy ?? true;

    const status = this.computeStatus(
      consecutiveFailures,
      successRate,
      upstreamReachable,
      lastSuccess,
      totalRuns,
    );

    return {
      moduleName,
      status,
      upstreamReachable,
      lastIngestionAt: lastIngestion,
      lastSuccessAt: lastSuccess,
      lastFailureAt: lastFailure,
      consecutiveFailures,
      successCount,
      failureCount,
      totalRuns,
      successRate,
      avgDurationMs,
      lastError,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async getModuleHealthWithUpstream(moduleName: string): Promise<ModuleHealthRecord> {
    const mod = getAllModules().find(m => m.name === moduleName);
    if (mod) {
      const healthy = await healthCheckModule(mod);
      this.upstreamCache.set(moduleName, {
        healthy,
        checkedAt: new Date().toISOString(),
      });
    }
    return this.getModuleHealth(moduleName);
  }

  async getSystemHealth(): Promise<SystemHealthSummary> {
    const modules = getAllModules();
    const records: ModuleHealthRecord[] = [];

    for (const mod of modules) {
      let healthy = true;
      if (mod.healthCheckUrl) {
        try {
          healthy = await healthCheckModule(mod);
        } catch {
          healthy = false;
        }
      }
      this.upstreamCache.set(mod.name, {
        healthy,
        checkedAt: new Date().toISOString(),
      });
      records.push(this.getModuleHealth(mod.name));
    }

    const healthy = records.filter(r => r.status === 'healthy').length;
    const degraded = records.filter(r => r.status === 'degraded').length;
    const unhealthy = records.filter(r => r.status === 'unhealthy').length;
    const unknown = records.filter(r => r.status === 'unknown').length;

    let systemStatus: ModuleHealthStatus = 'healthy';
    if (unhealthy > 0) {
      systemStatus = unhealthy > modules.length / 2 ? 'unhealthy' : 'degraded';
    } else if (degraded > 0) {
      systemStatus = 'degraded';
    }

    return {
      status: systemStatus,
      totalModules: modules.length,
      healthy,
      degraded,
      unhealthy,
      unknown,
      modules: records,
      checkedAt: new Date().toISOString(),
    };
  }

  getSystemHealthSync(): SystemHealthSummary {
    const modules = getAllModules();
    const records = modules.map(mod => this.getModuleHealth(mod.name));

    const healthy = records.filter(r => r.status === 'healthy').length;
    const degraded = records.filter(r => r.status === 'degraded').length;
    const unhealthy = records.filter(r => r.status === 'unhealthy').length;
    const unknown = records.filter(r => r.status === 'unknown').length;

    let systemStatus: ModuleHealthStatus = 'healthy';
    if (unhealthy > 0) {
      systemStatus = unhealthy > modules.length / 2 ? 'unhealthy' : 'degraded';
    } else if (degraded > 0) {
      systemStatus = 'degraded';
    }

    return {
      status: systemStatus,
      totalModules: modules.length,
      healthy,
      degraded,
      unhealthy,
      unknown,
      modules: records,
      checkedAt: new Date().toISOString(),
    };
  }

  private computeStatus(
    consecutiveFailures: number,
    successRate: number,
    upstreamReachable: boolean,
    lastSuccess: string | null,
    totalRuns: number,
  ): ModuleHealthStatus {
    if (totalRuns === 0) return 'unknown';

    if (!upstreamReachable) return 'unhealthy';

    if (consecutiveFailures >= this.config.consecutiveFailureThreshold) return 'unhealthy';

    if (successRate < this.config.successRateCriticalThreshold) return 'unhealthy';

    if (successRate < this.config.successRateWarningThreshold) return 'degraded';

    if (consecutiveFailures > 0) return 'degraded';

    if (lastSuccess) {
      const hoursSinceSuccess = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
      if (hoursSinceSuccess > this.config.staleDataHours) return 'degraded';
    }

    return 'healthy';
  }

  reset(moduleName?: string): void {
    if (moduleName) {
      this.events.delete(moduleName);
      this.upstreamCache.delete(moduleName);
    } else {
      this.events.clear();
      this.upstreamCache.clear();
    }
  }
}

// Singleton for pipeline-wide health tracking
let globalMonitor: HealthMonitor | null = null;

export function getHealthMonitor(config?: Partial<HealthMonitorConfig>): HealthMonitor {
  if (!globalMonitor) {
    globalMonitor = new HealthMonitor(config);
  }
  return globalMonitor;
}

export function resetHealthMonitor(): void {
  if (globalMonitor) {
    globalMonitor.reset();
  }
  globalMonitor = null;
}

export { HealthMonitor };
