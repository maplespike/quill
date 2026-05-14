// ─────────────────────────────────────────────────────────────────
// MapleSpike Portal Configuration — Dev Environment Override
// Mounted as a ConfigMap at /usr/share/nginx/html/config.js
// Target: dev.maplespike.lan → dev-maplespike-api.lan
// ─────────────────────────────────────────────────────────────────
window.MAPLESPIKE = window.MAPLESPIKE || {};

// ── API (dev: via dev-maplespike-api.lan with dev key) ──────────
MAPLESPIKE.apiBase   = 'https://dev-maplespike-api.lan';
MAPLESPIKE.apiKey    = '';  // User enters their own key via workspace

// ── Timeouts (milliseconds) ─────────────────────────────────────
MAPLESPIKE.timeout = {
  health:  3_000,
  quick:   5_000,
  default: 8_000,
};
