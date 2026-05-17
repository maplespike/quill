// ─────────────────────────────────────────────────────────────────
// MapleSpike Portal Configuration
// Single source of truth for all API endpoints, keys, and timeouts.
// Override per-environment by mounting this file as a ConfigMap
// in the K8s deployment (mount at /usr/share/nginx/html/config.js).
//
// Dev defaults point at a local API server on port 8085.
// Production overrides:
//   apiBase: "https://maplespike-api.lan"
//   apiKey: ""  ← user enters their own key via workspace
// ─────────────────────────────────────────────────────────────────
window.MAPLESPIKE = window.MAPLESPIKE || {};

// ── API ─────────────────────────────────────────────────────────
MAPLESPIKE.apiBase   = 'http://127.0.0.1:8082';   // Dev default — overridden in prod
MAPLESPIKE.apiKey    = 'maplespike-dev-key';       // Dev default — overridden in prod

// ── Timeouts (milliseconds) ─────────────────────────────────────
MAPLESPIKE.timeout = {
  health:  3_000,   // Health checks (fast)
  quick:   5_000,   // Simple queries, release listings
  default: 8_000,   // Standard API calls, search queries
};
