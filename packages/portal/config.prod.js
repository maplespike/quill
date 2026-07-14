// ─────────────────────────────────────────────────────────────────
// MapleSpike Portal Configuration — Production Override
// Mounted as a ConfigMap at /usr/share/nginx/html/config.js
// Overrides the dev defaults in packages/portal/config.js
// ─────────────────────────────────────────────────────────────────
window.MAPLESPIKE = window.MAPLESPIKE || {};

// ── API (production: same-origin /api proxy to avoid cross-subdomain CORS) ──
MAPLESPIKE.apiBase   = '/api';
MAPLESPIKE.apiKey    = '';  // User enters their own key via workspace

// ── Timeouts (milliseconds) ─────────────────────────────────────
MAPLESPIKE.timeout = {
  health:  3_000,
  quick:   5_000,
  default: 8_000,
};
