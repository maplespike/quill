// ─────────────────────────────────────────────────────────────────
// MapleSpike Portal Configuration — Production Override
// Mounted as a ConfigMap at /usr/share/nginx/html/config.js
// Overrides the dev defaults in packages/portal/config.js
// ─────────────────────────────────────────────────────────────────
window.MAPLESPIKE = window.MAPLESPIKE || {};

// ── API (production: via api.maplespike.ca with user-provided key) ──
MAPLESPIKE.apiBase   = 'https://api.maplespike.ca';
MAPLESPIKE.apiKey    = '';  // User enters their own key via workspace

// ── Timeouts (milliseconds) ─────────────────────────────────────
MAPLESPIKE.timeout = {
  health:  3_000,
  quick:   5_000,
  default: 8_000,
};
