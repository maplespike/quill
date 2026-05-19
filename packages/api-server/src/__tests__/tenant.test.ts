import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerTenant,
  getTenant,
  listTenants,
  removeTenant,
  updateTenant,
  resolveTenant,
  getTenantBranding,
  withBranding,
  DEFAULT_BRANDING,
} from '../tenant.js';
import {
  enforceTenantIsolation,
  buildTenantFilter,
  hasTenantScope,
  withTenantIsolation,
} from '../tenant-isolation.js';
import type { Tenant } from '../types.js';

describe('Tenant Registry', () => {
  beforeEach(() => {
    // Clean up test tenants (registry is in-memory and persists across tests)
    removeTenant('test-tenant-1');
    removeTenant('test-tenant-2');
    removeTenant('test-tenant-updated');
  });

  it('registers a new tenant', () => {
    const tenant: Tenant = {
      id: 'test-tenant-1',
      name: 'Test Tenant',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    const result = registerTenant(tenant);
    assert.equal(result, true);
    const retrieved = getTenant('test-tenant-1');
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'test-tenant-1');
  });

  it('returns false for duplicate tenant registration', () => {
    const tenant: Tenant = {
      id: 'test-tenant-2',
      name: 'Test Tenant 2',
      emailVerified: true,
      tier: 'pro',
      isActive: true,
      journalismMode: false,
    };
    registerTenant(tenant);
    const result = registerTenant(tenant);
    assert.equal(result, false);
  });

  it('updates an existing tenant', () => {
    const tenant: Tenant = {
      id: 'test-tenant-updated',
      name: 'Original Name',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    registerTenant(tenant);
    const result = updateTenant('test-tenant-updated', { name: 'Updated Name', tier: 'pro' });
    assert.equal(result, true);
    const updated = getTenant('test-tenant-updated');
    assert.ok(updated);
    assert.equal(updated.name, 'Updated Name');
    assert.equal(updated.tier, 'pro');
  });

  it('returns false for updating non-existent tenant', () => {
    const result = updateTenant('non-existent', { name: 'Nope' });
    assert.equal(result, false);
  });

  it('lists all registered tenants', () => {
    const tenants = listTenants();
    assert.ok(tenants.length > 0);
    assert.ok(tenants.some((t) => t.id === 'demo-tenant'));
  });

  it('removes a tenant', () => {
    const tenant: Tenant = {
      id: 'test-tenant-1',
      name: 'To Remove',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    registerTenant(tenant);
    const result = removeTenant('test-tenant-1');
    assert.equal(result, true);
    assert.equal(getTenant('test-tenant-1'), undefined);
  });
});

describe('Tenant Branding', () => {
  it('returns default branding for unknown tenant', () => {
    const branding = getTenantBranding('unknown-tenant');
    assert.equal(branding.displayName, DEFAULT_BRANDING.displayName);
    assert.equal(branding.primaryColor, DEFAULT_BRANDING.primaryColor);
  });

  it('returns custom branding for registered tenant with branding', () => {
    const branding = getTenantBranding('acme-corp');
    assert.equal(branding.displayName, 'Acme Intelligence');
    assert.equal(branding.primaryColor, '#7c3aed');
    assert.equal(branding.secondaryColor, '#06b6d4');
  });

  it('merges partial branding with defaults', () => {
    const branding = getTenantBranding('demo-tenant');
    assert.equal(branding.displayName, 'MapleSpike Demo');
    assert.equal(branding.primaryColor, '#2563eb');
    assert.ok(branding.logoUrl);
    assert.ok(branding.footerText);
  });

  it('withBranding adds full branding to tenant object', () => {
    const tenant = getTenant('acme-corp');
    assert.ok(tenant);
    const withBr = withBranding(tenant);
    assert.equal(withBr.branding.displayName, 'Acme Intelligence');
    assert.equal(withBr.branding.logoUrl, 'https://acme.example.com/logo.svg');
  });
});

describe('Tenant Resolution', () => {
  it('resolves tenant from X-MapleSpike-Tenant header', () => {
    const req = new Request('http://localhost/v1/health', {
      headers: { 'X-MapleSpike-Tenant': 'acme-corp' },
    });
    const resolved = resolveTenant(req);
    assert.equal(resolved, 'acme-corp');
  });

  it('resolves tenant from subdomain', () => {
    const req = new Request('http://localhost/v1/health', {
      headers: { Host: 'acme-corp.maplespike.ca' },
    });
    const resolved = resolveTenant(req);
    assert.equal(resolved, 'acme-corp');
  });

  it('resolves tenant from query parameter', () => {
    const req = new Request('http://localhost/v1/health?tenant=acme-corp');
    const resolved = resolveTenant(req);
    assert.equal(resolved, 'acme-corp');
  });

  it('returns null when no tenant context is present', () => {
    const req = new Request('http://localhost/v1/health');
    const resolved = resolveTenant(req);
    assert.equal(resolved, null);
  });

  it('ignores www subdomain', () => {
    const req = new Request('http://localhost/v1/health', {
      headers: { Host: 'www.maplespike.ca' },
    });
    const resolved = resolveTenant(req);
    assert.equal(resolved, null);
  });

  it('ignores api subdomain', () => {
    const req = new Request('http://localhost/v1/health', {
      headers: { Host: 'api.maplespike.ca' },
    });
    const resolved = resolveTenant(req);
    assert.equal(resolved, null);
  });

  it('header takes priority over subdomain', () => {
    const req = new Request('http://localhost/v1/health', {
      headers: {
        'X-MapleSpike-Tenant': 'demo-tenant',
        Host: 'acme-corp.maplespike.ca',
      },
    });
    const resolved = resolveTenant(req);
    assert.equal(resolved, 'demo-tenant');
  });
});

describe('Tenant Isolation', () => {
  it('returns authenticated tenant when no tenant header', () => {
    const tenant: Tenant = {
      id: 'user-1',
      name: 'User One',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    const req = new Request('http://localhost/v1/data');
    const result = enforceTenantIsolation(req, tenant);
    assert.ok(result);
    assert.equal(result.id, 'user-1');
  });

  it('returns null for inactive requested tenant', () => {
    const tenant: Tenant = {
      id: 'user-1',
      name: 'User One',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    const req = new Request('http://localhost/v1/data', {
      headers: { 'X-MapleSpike-Tenant': 'inactive-tenant' },
    });
    const result = enforceTenantIsolation(req, tenant);
    assert.equal(result, null);
  });

  it('builds tenant filter for database queries', () => {
    const filter = buildTenantFilter('tenant-123');
    assert.deepEqual(filter, { tenant_id: 'tenant-123' });
  });

  it('internal tier has access to all tenant data', () => {
    const internalTenant: Tenant = {
      id: 'internal',
      name: 'Internal',
      emailVerified: true,
      tier: 'internal',
      isActive: true,
      journalismMode: true,
    };
    assert.equal(hasTenantScope(internalTenant, 'other-tenant'), true);
  });

  it('non-internal tenant only has access to own data', () => {
    const freeTenant: Tenant = {
      id: 'free-user',
      name: 'Free User',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    assert.equal(hasTenantScope(freeTenant, 'free-user'), true);
    assert.equal(hasTenantScope(freeTenant, 'other-tenant'), false);
  });

  it('withTenantIsolation returns null on isolation failure', () => {
    const tenant: Tenant = {
      id: 'user-1',
      name: 'User One',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };
    const ctx = {
      tenant,
      apiKeyId: 'key-1',
      requestId: 'req-1',
      startTime: Date.now(),
      env: {},
    } as any;
    const req = new Request('http://localhost/v1/data', {
      headers: { 'X-MapleSpike-Tenant': 'non-existent-tenant' },
    });
    const result = withTenantIsolation(req, ctx);
    assert.equal(result, null);
  });

  it('withTenantIsolation returns updated context on success', () => {
    const tenant: Tenant = {
      id: 'demo-tenant',
      name: 'Demo User',
      emailVerified: true,
      tier: 'pro',
      isActive: true,
      journalismMode: false,
    };
    const ctx = {
      tenant,
      apiKeyId: 'key-1',
      requestId: 'req-1',
      startTime: Date.now(),
      env: {},
    } as any;
    const req = new Request('http://localhost/v1/data', {
      headers: { 'X-MapleSpike-Tenant': 'acme-corp' },
    });
    const result = withTenantIsolation(req, ctx);
    assert.ok(result);
    assert.equal(result.tenant.id, 'acme-corp');
  });
});
