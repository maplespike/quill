// SPDX-License-Identifier: AGPL-3.0-only

export type ModuleHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ModuleHealthRecord {
  moduleName: string;
  status: ModuleHealthStatus;
  upstreamReachable: boolean;
  lastIngestionAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  successCount: number;
  failureCount: number;
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  lastError: string | null;
  lastCheckedAt: string;
}

export interface SystemHealthSummary {
  status: ModuleHealthStatus;
  totalModules: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  modules: ModuleHealthRecord[];
  checkedAt: string;
}

export interface HealthAlert {
  moduleName: string;
  alertType: 'consecutive_failures' | 'success_rate_drop' | 'upstream_unreachable' | 'schema_drift' | 'stale_data';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  triggeredAt: string;
  data: Record<string, unknown>;
}

export interface HealthMonitorConfig {
  consecutiveFailureThreshold: number;
  successRateWarningThreshold: number;
  successRateCriticalThreshold: number;
  staleDataHours: number;
}
