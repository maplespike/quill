#!/usr/bin/env bash
# =============================================================================
# verify-split-routing.sh — Smoke-test both sides of the split-hostname model
# =============================================================================
# Tests after a fresh `kubectl apply`:
#
#   A. *.lan  DNS resolves via Unbound
#   B. *.lan  HTTPS works via k3s Traefik Ingress
#   C. *.ca   HTTPS works via Cloudflare Tunnel → cloudflared → k3s Service
#
# Exit codes:
#   0 — all checks green
#   1 — at least one check failed (failure details printed)
#
# Usage:
#   ./verify-split-routing.sh                           # default checks
#   ./verify-split-routing.sh --skip-external           # LAn-only run
# =============================================================================

set -uo pipefail   # NB: NOT set -e — we want to keep going past failures

ok()  { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
no()  { printf '\033[1;31m✗\033[0m %s\n' "$*"; }
hr()  { printf '\n\033[1;36m── %s ──\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m?\033[0m %s\n' "$*"; }

FAIL=0
SKIP_EXTERNAL=0
for arg in "$@"; do
  case "$arg" in
    --skip-external) SKIP_EXTERNAL=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
  esac
done

# --- helpers ---
check_http() {
  local label="$1"
  local url="$2"
  shift 2
  local expected=("$@")
  local code
  code=$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 8 "$url" 2>/dev/null || echo "000")
  local match=0
  for e in "${expected[@]}"; do
    if [[ "$code" == "$e" ]]; then
      match=1
      break
    fi
  done
  if (( match )); then
    ok "$label → $code"
  else
    expected_csv=$(IFS=,; echo "${expected[*]}")
    no "$label → $code  (expected: $expected_csv)"
    FAIL=1
  fi
}

check_dns() {
  local host="$1"
  local ip
  ip=$(dig +short "$host" 2>/dev/null | head -1)
  if [[ -n "$ip" ]]; then
    ok "DNS  $host → $ip"
  else
    no "DNS  $host failed (no A record returned by resolver)"
    FAIL=1
  fi
}

# --- 1. LAN DNS ---
hr "1. LAN DNS (Unbound local-zone for *.maplespike.lan)"
for h in maplespike.lan api.maplespike.lan mcp.maplespike.lan portal.maplespike.lan; do
  check_dns "$h"
done

# --- 2. LAN HTTPS via Traefik Ingress ---
hr "2. LAN HTTPS via Traefik Ingress (cert-manager + step-ca cert)"
check_http "LAN  api health"  "https://api.maplespike.lan/v1/health"  200
check_http "LAN  mcp health"  "https://mcp.maplespike.lan/health"     200
check_http "LAN  portal"      "https://maplespike.lan/"              200 301 302
check_http "LAN  portal-alt"  "https://portal.maplespike.lan/"       200 301 302

# --- 3. External via Cloudflare Tunnel ---
if (( SKIP_EXTERNAL )); then
  warn "skipping external checks (--skip-external was passed)"
else
  hr "3. External HTTPS via Cloudflare Tunnel → cloudflared → k3s"
  check_http "EXT  api health" "https://api.maplespike.ca/v1/health"  200
  check_http "EXT  mcp health" "https://mcp.maplespike.ca/health"     200
fi

# --- summary ---
hr "summary"
if (( FAIL == 0 )); then
  ok "all split-routing checks green"
  exit 0
fi
no "one or more checks failed; run individual curl/dig commands above for context"
exit 1
