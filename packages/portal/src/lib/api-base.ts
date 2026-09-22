/**
 * Portal — API base derivation.
 *
 * Extracted from SignupForm so the rule can be tested directly: getting this
 * wrong sends every request to the wrong host, and the failure looks like an
 * outage rather than a routing bug. Falls back to the public API when there is
 * no window (SSR / build).
 */

const SERVICE_SUBDOMAINS = ["api", "portal", "www", "mcp", "dev", "data", "quill"];

export function deriveApiBase(opts: {
  apiBase?: string | undefined;
  protocol?: string | undefined;
  hostname?: string | undefined;
}): string {
  if (opts.apiBase) return opts.apiBase.replace(/\/$/, "");
  const host = opts.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  if (!host) return "https://api.maplespike.ca";
  const protocol = opts.protocol ?? (typeof window !== "undefined" ? window.location.protocol : "https:");
  const parts = host.split(".");
  const baseDomain =
    parts.length > 2 && SERVICE_SUBDOMAINS.includes(parts[0]!)
      ? parts.slice(1).join(".")
      : host;
  return `${protocol}//api.${baseDomain}`;
}

export function getApiBase(): string {
  return deriveApiBase({
    apiBase: typeof window !== "undefined" ? window.MAPLESPIKE?.apiBase : undefined,
  });
}
