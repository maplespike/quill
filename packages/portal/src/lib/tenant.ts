/**
 * MapleSpike Portal — Tenant Resolution & Theming
 *
 * Resolves the current tenant from URL context and provides
 * tenant-specific branding configuration for the portal.
 */

export interface TenantBranding {
  displayName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  faviconUrl: string;
  footerText: string;
  customCssUrl: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  branding: TenantBranding;
}

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  id: 'default',
  name: 'MapleSpike',
  branding: {
    displayName: 'MapleSpike',
    logoUrl: '/assets/maplespike_logo.svg',
    primaryColor: '#dc2626',
    secondaryColor: '#f97316',
    faviconUrl: '/assets/maplespike_logo.svg',
    footerText: 'Contains information licensed under the Open Government Licence – Canada.',
    customCssUrl: '',
  },
};

const KNOWN_TENANTS: Record<string, TenantConfig> = {
  'acme-corp': {
    id: 'acme-corp',
    name: 'Acme Corp',
    branding: {
      displayName: 'Acme Intelligence',
      logoUrl: 'https://acme.example.com/logo.svg',
      primaryColor: '#7c3aed',
      secondaryColor: '#06b6d4',
      faviconUrl: 'https://acme.example.com/favicon.ico',
      footerText: 'Powered by Acme Intelligence Platform.',
      customCssUrl: '',
    },
  },
};

/**
 * Resolve tenant config from Astro request context.
 * Checks subdomain first, then query parameter, then defaults.
 */
export function resolveTenantConfig(url: URL, host: string): TenantConfig {
  const subdomain = extractSubdomain(host);
  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    const tenant = KNOWN_TENANTS[subdomain];
    if (tenant) return tenant;
  }

  const queryTenant = url.searchParams.get('tenant');
  if (queryTenant) {
    const tenant = KNOWN_TENANTS[queryTenant];
    if (tenant) return tenant;
  }

  return DEFAULT_TENANT_CONFIG;
}

/**
 * Extract subdomain from host string.
 */
function extractSubdomain(host: string): string | null {
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
}

/**
 * Generate CSS custom properties for tenant branding.
 */
export function brandingToCssVariables(branding: TenantBranding): string {
  return `:root { --tenant-primary: ${branding.primaryColor}; --tenant-secondary: ${branding.secondaryColor}; }`;
}

/**
 * Generate an array of HTML strings for tenant-specific meta tags.
 */
export function brandingToMetaTags(branding: TenantBranding): string[] {
  const tags: string[] = [];
  if (branding.faviconUrl) {
    tags.push(`<link rel="icon" type="image/svg+xml" href="${branding.faviconUrl}" />`);
  }
  if (branding.customCssUrl) {
    tags.push(`<link rel="stylesheet" href="${branding.customCssUrl}" />`);
  }
  return tags;
}
