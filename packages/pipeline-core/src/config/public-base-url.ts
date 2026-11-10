/**
 * Public URL surface for the API and MCP servers.
 *
 * QUILL_PUBLIC_BASE_URL wins. Then MAPLESPIKE_PUBLIC_URL, then a portal
 * origin built from MAPLESPIKE_DOMAIN, then APP_URL. Brand hosts stay as
 * the last default so an unset environment keeps the production hostnames.
 *
 * Sibling hosts (api, mcp, status) follow the quill.<domain> layout when
 * the portal origin uses that shape. A loopback base is used as-is.
 */

const BRAND_DOMAIN = 'maplespike.ca';
const BRAND_PORTAL = 'https://quill.maplespike.ca';
const BRAND_API = 'https://api.maplespike.ca';
const BRAND_MCP = 'https://mcp.maplespike.ca';
const BRAND_APEX = 'https://maplespike.ca';
const BRAND_STATUS = 'https://status.maplespike.ca';

/** Production browser origins. Kept as defaults so CORS stays the same when unset. */
const BRAND_CORS_ORIGINS = [
  'https://maplespike.ca',
  'https://www.maplespike.ca',
  'https://data.maplespike.ca',
  'https://api.maplespike.ca',
  'https://api.data.maplespike.ca',
  'https://mcp.maplespike.ca',
  'https://quill.maplespike.ca',
  'https://www.quill.maplespike.ca',
  'https://portal.maplespike.ca',
  'https://dev.maplespike.ca',
  'https://dev-api.maplespike.ca',
  'https://dev-mcp.maplespike.ca',
];

function trimUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Portal origin. This is the public base URL.
 */
export function publicBaseUrl(): string {
  const explicit = trimUrl(process.env.QUILL_PUBLIC_BASE_URL)
    || trimUrl(process.env.MAPLESPIKE_PUBLIC_URL);
  if (explicit) return explicit;

  const domain = process.env.MAPLESPIKE_DOMAIN?.trim();
  if (domain && !isLoopbackHost(domain)) {
    return `https://quill.${domain}`;
  }

  const app = trimUrl(process.env.APP_URL);
  if (app && /^https?:\/\//i.test(app)) return app;

  return BRAND_PORTAL;
}

export function portalOrigin(): string {
  return publicBaseUrl();
}

export function portalHost(): string {
  try {
    return new URL(publicBaseUrl()).host;
  } catch {
    return 'quill.maplespike.ca';
  }
}

/**
 * Registrable domain for email and display. Loopback stays on the brand
 * domain so a local APP_URL does not produce billing@localhost.
 */
export function publicDomain(): string {
  const configured = process.env.MAPLESPIKE_DOMAIN?.trim();
  if (configured && !isLoopbackHost(configured)) return configured;
  try {
    const host = new URL(publicBaseUrl()).hostname;
    if (isLoopbackHost(host)) return BRAND_DOMAIN;
    if (host.startsWith('quill.')) return host.slice('quill.'.length);
    if (host.startsWith('api.')) return host.slice('api.'.length);
    if (host.startsWith('mcp.')) return host.slice('mcp.'.length);
    return host;
  } catch {
    return BRAND_DOMAIN;
  }
}

/**
 * WebAuthn RP ID and SIWE domain. MAPLESPIKE_DOMAIN is used as written,
 * including localhost. The brand domain is the only fallback.
 */
export function relyingPartyDomain(): string {
  return process.env.MAPLESPIKE_DOMAIN?.trim() || BRAND_DOMAIN;
}

function siblingOrigin(label: string, brand: string): string {
  let base: URL;
  try {
    base = new URL(publicBaseUrl());
  } catch {
    return brand;
  }
  if (isLoopbackHost(base.hostname)) return base.origin;

  let registrable = base.hostname;
  if (registrable.startsWith('quill.')) registrable = registrable.slice('quill.'.length);
  else if (registrable.startsWith('api.')) registrable = registrable.slice('api.'.length);
  else if (registrable.startsWith('mcp.')) registrable = registrable.slice('mcp.'.length);

  if (!label) return `${base.protocol}//${registrable}`;
  return `${base.protocol}//${label}.${registrable}`;
}

export function apiOrigin(): string {
  return siblingOrigin('api', BRAND_API);
}

export function mcpOrigin(): string {
  return siblingOrigin('mcp', BRAND_MCP);
}

export function apexOrigin(): string {
  return siblingOrigin('', BRAND_APEX);
}

export function statusOrigin(): string {
  return siblingOrigin('status', BRAND_STATUS);
}

export function billingEmail(): string {
  return process.env.MAPLESPIKE_BILLING_EMAIL?.trim() || `billing@${publicDomain()}`;
}

export function noreplyEmail(): string {
  return `noreply@${publicDomain()}`;
}

/**
 * Browser origins allowed to call the API.
 * Brand hosts are always included. MAPLESPIKE_DOMAIN and a custom base add more.
 */
export function configuredCorsOrigins(): string[] {
  const origins = [...BRAND_CORS_ORIGINS];
  const domain = process.env.MAPLESPIKE_DOMAIN?.trim();
  if (domain && !isLoopbackHost(domain)) {
    for (const host of [
      domain,
      `www.${domain}`,
      `api.${domain}`,
      `mcp.${domain}`,
      `portal.${domain}`,
      `quill.${domain}`,
      `www.quill.${domain}`,
      `data.${domain}`,
      `api.data.${domain}`,
      `dev.${domain}`,
      `dev-api.${domain}`,
      `dev-mcp.${domain}`,
      `status.${domain}`,
    ]) {
      origins.push(`https://${host}`);
    }
  }
  try {
    const base = new URL(publicBaseUrl());
    if (!isLoopbackHost(base.hostname)) {
      origins.push(base.origin);
      origins.push(apiOrigin());
      origins.push(mcpOrigin());
      origins.push(apexOrigin());
      origins.push(statusOrigin());
    }
  } catch {
    // A bad base URL does not drop the brand list.
  }
  return [...new Set(origins)];
}
