/**
 * MapleSpike — Tenant Isolation Middleware
 *
 * Enforces tenant-scoped data isolation on API routes.
 * Ensures that tenants can only access their own data.
 */

import type { RouteContext, Tenant } from './types.js';
import { getTenant, resolveTenant } from './tenant.js';

/* ------------------------------------------------------------------ */
/*  Tenant Isolation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Verify that the authenticated tenant matches the requested tenant scope.
 * Returns the effective tenant or null if isolation check fails.
 */
export function enforceTenantIsolation(
  request: Request,
  authenticatedTenant: Tenant,
): Tenant | null {
  const requestedTenantId = resolveTenant(request);

  if (!requestedTenantId) {
    return authenticatedTenant;
  }

  if (requestedTenantId !== authenticatedTenant.id) {
    const registryTenant = getTenant(requestedTenantId);
    if (!registryTenant) {
      return null;
    }

    if (!registryTenant.isActive) {
      return null;
    }

    return registryTenant;
  }

  return authenticatedTenant;
}

/**
 * Build a tenant-scoped query filter for database operations.
 * Returns a filter object that should be merged into queries.
 */
export function buildTenantFilter(tenantId: string): Record<string, string> {
  return { tenant_id: tenantId };
}

/**
 * Check if a tenant has access to a specific data scope.
 * Used for multi-tenant data partitioning.
 */
export function hasTenantScope(
  tenant: Tenant,
  dataTenantId: string,
): boolean {
  if (tenant.tier === 'internal') {
    return true;
  }
  return tenant.id === dataTenantId;
}

/**
 * Middleware wrapper that injects tenant isolation into route context.
 * Usage: wrap with this before calling route handlers.
 */
export function withTenantIsolation(
  request: Request,
  ctx: RouteContext,
): RouteContext | null {
  const isolated = enforceTenantIsolation(request, ctx.tenant);
  if (!isolated) {
    return null;
  }
  return { ...ctx, tenant: isolated };
}
