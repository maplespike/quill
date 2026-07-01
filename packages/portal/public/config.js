// ─────────────────────────────────────────────────────────────────
// MapleSpike Portal Configuration
// Derives all URLs from the current domain — no hardcoded hosts.
//
// Override by setting window.MAPLESPIKE before this script loads,
// or by mounting a ConfigMap at /config.js in k8s.
// ─────────────────────────────────────────────────────────────────
window.MAPLESPIKE = window.MAPLESPIKE || {};

(function () {
  // Derive API base from current hostname
  var host = window.location.hostname;
  var proto = window.location.protocol;
  var port = window.location.port ? ':' + window.location.port : '';

  // Strip any known service subdomain, or the first subdomain on any 3+ part hostname.
  // Examples: portal.maplespike.ca → api.maplespike.ca, data.maplespike.ca → api.maplespike.ca
  var parts = host.split('.');
  var knownSubdomains = ['api', 'portal', 'www', 'mcp', 'dev', 'data'];
  var baseDomain;
  if (parts.length > 2 && knownSubdomains.includes(parts[0])) {
    baseDomain = parts.slice(1).join('.');
  } else if (parts.length > 2) {
    // Unrecognized subdomain — strip it anyway to avoid api.X.Y.Z chains
    baseDomain = parts.slice(-2).join('.');
  } else {
    baseDomain = host;
  }

  // Default: api subdomain of the base domain
  var defaultApiBase = proto + '//api.' + baseDomain + port;

  // ── API ─────────────────────────────────────────────────────────
  MAPLESPIKE.apiBase = MAPLESPIKE.apiBase || defaultApiBase;
  MAPLESPIKE.apiKey = MAPLESPIKE.apiKey || '';

  // ── Timeouts ────────────────────────────────────────────────────
  MAPLESPIKE.timeout = MAPLESPIKE.timeout || {
    health: 3000,
    quick: 5000,
    default: 8000,
  };
})();
