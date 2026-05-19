/**
 * MapleSpike — Tenant Registry
 *
 * Manages white-label tenant configurations and resolves tenants
 * from subdomain, header, or query parameter.
 */

import type { Tenant, TenantBranding } from './types.js';

/* ------------------------------------------------------------------ */
/*  Default Branding                                                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_BRANDING: Required<TenantBranding> = {
  displayName: 'MapleSpike',
  logoUrl: '/assets/maplespike_logo.svg',
  primaryColor: '#dc2626',
  secondaryColor: '#f97316',
  faviconUrl: '/assets/maplespike_logo.svg',
  footerText: 'Contains information licensed under the Open Government Licence – Canada.',
  customCssUrl: '',
};

/* ------------------------------------------------------------------ */
/*  Tenant Registry (In-Memory)                                        */
/* ------------------------------------------------------------------ */

const tenantRegistry = new Map<string, Tenant>();

/**
 * Register a tenant with optional white-label branding.
 * Returns true if the tenant was added, false if it already existed.
 */
export function registerTenant(tenant: Tenant): boolean {
  if (tenantRegistry.has(tenant.id)) return false;
  tenantRegistry.set(tenant.id, tenant);
  return true;
}

/**
 * Update an existing tenant's configuration.
 * Returns true if the tenant was found and updated.
 */
export function updateTenant(id: string, updates: Partial<Tenant>): boolean {
  const existing = tenantRegistry.get(id);
  if (!existing) return false;
  tenantRegistry.set(id, { ...existing, ...updates });
  return true;
}

/**
 * Get a tenant by ID.
 */
export function getTenant(id: string): Tenant | undefined {
  return tenantRegistry.get(id);
}

/**
 * List all registered tenants.
 */
export function listTenants(): Tenant[] {
  return Array.from(tenantRegistry.values());
}

/**
 * Remove a tenant from the registry.
 */
export function removeTenant(id: string): boolean {
  return tenantRegistry.delete(id);
}

/* ------------------------------------------------------------------ */
/*  Tenant Resolution                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolve tenant from request context.
 * Priority: X-MapleSpike-Tenant header > subdomain > query param > default.
 */
export function resolveTenant(request: Request): string | null {
  // 1. Explicit header
  const headerTenant = request.headers.get('X-MapleSpike-Tenant');
  if (headerTenant) return headerTenant;

  // 2. Subdomain extraction
  try {
    const host = request.headers.get('Host') || '';
    const subdomain = extractSubdomain(host);
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
  } catch {
    // Ignore URL parsing errors
  }

  // 3. Query parameter
  try {
    const url = new URL(request.url);
    const queryTenant = url.searchParams.get('tenant');
    if (queryTenant) return queryTenant;
  } catch {
    // Ignore URL parsing errors
  }

  return null;
}

/**
 * Extract subdomain from host string.
 * e.g., "acme.maplespike.ca" -> "acme"
 */
function extractSubdomain(host: string): string | null {
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Branding Resolution                                                */
/* ------------------------------------------------------------------ */

/**
 * Get the effective branding for a tenant.
 * Falls back to DEFAULT_BRANDING for missing fields.
 */
export function getTenantBranding(tenantId: string): Required<TenantBranding> {
  const tenant = tenantRegistry.get(tenantId);
  if (!tenant?.branding) return DEFAULT_BRANDING;

  return {
    displayName: tenant.branding.displayName || DEFAULT_BRANDING.displayName,
    logoUrl: tenant.branding.logoUrl || DEFAULT_BRANDING.logoUrl,
    primaryColor: tenant.branding.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: tenant.branding.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    faviconUrl: tenant.branding.faviconUrl || DEFAULT_BRANDING.faviconUrl,
    footerText: tenant.branding.footerText || DEFAULT_BRANDING.footerText,
    customCssUrl: tenant.branding.customCssUrl || DEFAULT_BRANDING.customCssUrl,
  };
}

/**
 * Merge tenant branding into a Tenant object for API responses.
 */
export function withBranding(tenant: Tenant): Tenant & { branding: Required<TenantBranding> } {
  return {
    ...tenant,
    branding: getTenantBranding(tenant.id),
  };
}

/* ------------------------------------------------------------------ */
/*  Seed Default Tenants                                               */
/* ------------------------------------------------------------------ */

// Seed demo tenants for development
registerTenant({
  id: 'demo-tenant',
  name: 'Demo User',
  emailVerified: true,
  tier: 'pro',
  isActive: true,
  journalismMode: false,
  branding: {
    displayName: 'MapleSpike Demo',
    primaryColor: '#2563eb',
  },
});

registerTenant({
  id: 'internal-tenant',
  name: 'Internal Service',
  emailVerified: true,
  tier: 'internal',
  isActive: true,
  journalismMode: true,
});

if (process.env.NODE_ENV !== 'production') {
  registerTenant({
    id: 'dev-tenant',
    name: 'Dev User',
    emailVerified: true,
    tier: 'pro',
    isActive: true,
    journalismMode: false,
  });
}

// Example white-label tenant
registerTenant({
  id: 'acme-corp',
  name: 'Acme Corp',
  email: 'admin@acme.example.com',
  emailVerified: true,
  tier: 'enterprise',
  isActive: true,
  journalismMode: false,
  branding: {
    displayName: 'Acme Intelligence',
    logoUrl: 'https://acme.example.com/logo.svg',
    primaryColor: '#7c3aed',
    secondaryColor: '#06b6d4',
    faviconUrl: 'https://acme.example.com/favicon.ico',
    footerText: 'Powered by Acme Intelligence Platform.',
  },
  allowedOrigins: ['https://acme.example.com'],
});
