// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ModuleHealthRecord,
  HealthAlert,
  HealthMonitorConfig,
} from './types.js';
import { DEFAULT_CONFIG } from './monitor.js';

export function evaluateAlerts(
  health: ModuleHealthRecord,
  config: Partial<HealthMonitorConfig> = {},
): HealthAlert[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const alerts: HealthAlert[] = [];
  const now = new Date().toISOString();

  if (health.consecutiveFailures >= cfg.consecutiveFailureThreshold) {
    alerts.push({
      moduleName: health.moduleName,
      alertType: 'consecutive_failures',
      severity: 'critical',
      message: `${health.moduleName}: ${health.consecutiveFailures} consecutive failures (threshold: ${cfg.consecutiveFailureThreshold})`,
      triggeredAt: now,
      data: {
        consecutiveFailures: health.consecutiveFailures,
        threshold: cfg.consecutiveFailureThreshold,
        lastError: health.lastError,
      },
    });
  }

  if (health.totalRuns >= 5 && health.successRate < cfg.successRateCriticalThreshold) {
    alerts.push({
      moduleName: health.moduleName,
      alertType: 'success_rate_drop',
      severity: 'critical',
      message: `${health.moduleName}: success rate ${(health.successRate * 100).toFixed(1)}% below critical threshold ${(cfg.successRateCriticalThreshold * 100).toFixed(0)}%`,
      triggeredAt: now,
      data: {
        successRate: health.successRate,
        threshold: cfg.successRateCriticalThreshold,
        totalRuns: health.totalRuns,
      },
    });
  } else if (health.totalRuns >= 5 && health.successRate < cfg.successRateWarningThreshold) {
    alerts.push({
      moduleName: health.moduleName,
      alertType: 'success_rate_drop',
      severity: 'warning',
      message: `${health.moduleName}: success rate ${(health.successRate * 100).toFixed(1)}% below warning threshold ${(cfg.successRateWarningThreshold * 100).toFixed(0)}%`,
      triggeredAt: now,
      data: {
        successRate: health.successRate,
        threshold: cfg.successRateWarningThreshold,
        totalRuns: health.totalRuns,
      },
    });
  }

  if (!health.upstreamReachable) {
    alerts.push({
      moduleName: health.moduleName,
      alertType: 'upstream_unreachable',
      severity: 'critical',
      message: `${health.moduleName}: upstream data source unreachable`,
      triggeredAt: now,
      data: { lastCheckedAt: health.lastCheckedAt },
    });
  }

  if (health.lastSuccessAt) {
    const hoursSinceSuccess = (Date.now() - new Date(health.lastSuccessAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSuccess > cfg.staleDataHours) {
      alerts.push({
        moduleName: health.moduleName,
        alertType: 'stale_data',
        severity: 'warning',
        message: `${health.moduleName}: no successful ingestion for ${hoursSinceSuccess.toFixed(1)}h (threshold: ${cfg.staleDataHours}h)`,
        triggeredAt: now,
        data: {
          hoursSinceSuccess,
          threshold: cfg.staleDataHours,
          lastSuccessAt: health.lastSuccessAt,
        },
      });
    }
  } else if (health.totalRuns > 0) {
    alerts.push({
      moduleName: health.moduleName,
      alertType: 'stale_data',
      severity: 'warning',
      message: `${health.moduleName}: has ${health.totalRuns} runs but zero successes`,
      triggeredAt: now,
      data: { totalRuns: health.totalRuns, successCount: health.successCount },
    });
  }

  return alerts;
}

export function evaluateSystemAlerts(
  modules: ModuleHealthRecord[],
  config: Partial<HealthMonitorConfig> = {},
): HealthAlert[] {
  return modules.flatMap(m => evaluateAlerts(m, config));
}
