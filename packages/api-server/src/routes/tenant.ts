/**
 * MapleSpike — Tenant Branding Route
 *
 * GET /v1/tenant/branding — Returns the branding config for the current tenant.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import type { BuildContext } from '../response.js';
import { getTenantBranding, DEFAULT_BRANDING } from '../tenant.js';

export const tenantBrandingHandler: RouteHandler = async (
  request: Request,
  ctx,
): Promise<Response> => {
  const branding = getTenantBranding(ctx.tenant.id);

  const buildCtx: BuildContext = {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
    queryOptions: {},
    metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - ctx.startTime },
  };

  return jsonResponse(buildSuccess({
    tenantId: ctx.tenant.id,
    tenantName: ctx.tenant.name,
    branding,
  }, buildCtx));
};

export const tenantListHandler: RouteHandler = async (
  request: Request,
  ctx,
): Promise<Response> => {
  if (ctx.tenant.tier !== 'internal' && ctx.tenant.tier !== 'enterprise') {
    const buildCtx: BuildContext = {
      tenant: ctx.tenant,
      requestId: ctx.requestId,
      startTime: ctx.startTime,
      queryOptions: {},
      metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - ctx.startTime },
    };
    return jsonResponse(buildError('FORBIDDEN', 'Insufficient permissions to list tenants', buildCtx), 403);
  }

  const { listTenants } = await import('../tenant.js');
  const tenants = listTenants().map((t) => ({
    id: t.id,
    name: t.name,
    tier: t.tier,
    isActive: t.isActive,
    branding: t.branding ? {
      displayName: t.branding.displayName,
      primaryColor: t.branding.primaryColor,
      logoUrl: t.branding.logoUrl,
    } : null,
  }));

  const buildCtx: BuildContext = {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
    queryOptions: {},
    metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - ctx.startTime },
  };

  return jsonResponse(buildSuccess({ tenants }, buildCtx));
};
