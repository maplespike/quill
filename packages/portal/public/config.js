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

  // If we're on a subdomain like api.X, portal.X, or www.X,
  // strip it to get the base domain
  var parts = host.split('.');
  var baseDomain;
  if (parts.length > 2 && ['api', 'portal', 'www', 'mcp', 'quill', 'data', 'datafabric'].includes(parts[0])) {
    baseDomain = parts.slice(1).join('.');
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
