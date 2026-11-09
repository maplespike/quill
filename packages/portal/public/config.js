// ─────────────────────────────────────────────────────────────────
// MapleSpike Portal Configuration
//
// The API origin is one stable public URL. The layout bakes it from
// PUBLIC_API_BASE at build time (default https://api.maplespike.ca).
// This file keeps a value that is already set. It does not derive a
// host from window.location: a Pages preview hostname is not an API host.
// ─────────────────────────────────────────────────────────────────
window.MAPLESPIKE = window.MAPLESPIKE || {};

(function () {
  var defaultApiBase = 'https://api.maplespike.ca';

  MAPLESPIKE.apiBase = MAPLESPIKE.apiBase || defaultApiBase;
  MAPLESPIKE.apiKey = MAPLESPIKE.apiKey || '';

  MAPLESPIKE.timeout = MAPLESPIKE.timeout || {
    health: 3000,
    quick: 5000,
    default: 8000,
  };
})();
