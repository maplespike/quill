#!/usr/bin/env bash
# =============================================================================
# scripts/e2e-smoke.sh — End-to-end smoke test for the MapleSpike stack
# =============================================================================
# Verifies the three runtime services are responsive and returning expected
# shapes. Does NOT exercise data ingestion or AI generation.
#
# Usage:
#   ./scripts/e2e-smoke.sh                            # auto-detect mode
#   ./scripts/e2e-smoke.sh --mode=compose --up        # docker compose up + test + leave running
#   ./scripts/e2e-smoke.sh --mode=compose --up --down # docker compose up + test + tear down
#   ./scripts/e2e-smoke.sh --mode=local               # assume services already running
#
# Modes:
#   compose — wraps `docker compose up` (or down after)
#   local   — assumes API/MCP/Portal are already running on default ports
#
# Exit codes:
#   0 — all checks pass
#   1 — at least one check failed
#   2 — dependency missing or bad args
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

API_URL="http://localhost:8082"
MCP_URL="http://localhost:3001"
PORTAL_URL="http://localhost:8080"
WAIT_TIMEOUT=60
WAIT_STEP=2

MODE="local"
DO_UP=0
DO_DOWN=0
QUIET=0

usage() {
  sed -n '3,32p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode=*) MODE="${1#*=}"; shift ;;
    --up) DO_UP=1; shift ;;
    --down) DO_DOWN=1; shift ;;
    --api=*) API_URL="${1#*=}"; shift ;;
    --mcp=*) MCP_URL="${1#*=}"; shift ;;
    --portal=*) PORTAL_URL="${1#*=}"; shift ;;
    --timeout=*) WAIT_TIMEOUT="${1#*=}"; shift ;;
    --quiet|-q) QUIET=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

log() { [[ $QUIET -eq 1 ]] && return 0; echo "$@"; }
fail() { echo "  ✗ $*" >&2; }
pass() { log "  ✓ $*"; }

# ── Detect docker compose ───────────────────────────────────────
COMPOSE=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
fi

# ── Optional stack (up/down) ─────────────────────────────────────
if [[ $DO_UP -eq 1 ]]; then
  if [[ ${#COMPOSE[@]} -eq 0 ]]; then
    echo "ERROR: --up requires docker compose" >&2
    exit 2
  fi
  log "→ docker compose up -d --build"
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" up -d --build
fi

cleanup() {
  if [[ $DO_DOWN -eq 1 && ${#COMPOSE[@]} -gt 0 ]]; then
    log ""
    log "→ docker compose down (cleanup)"
    "${COMPOSE[@]}" -f "$COMPOSE_FILE" down --remove-orphans
  fi
}
trap cleanup EXIT

# ── Wait helpers ─────────────────────────────────────────────────
wait_http() {
  local url="$1" code timeout_now=$WAIT_TIMEOUT steps=0
  while (( timeout_now > 0 )); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null || echo "000")
    [[ "$code" =~ ^(2|3)[0-9][0-9]$ ]] && return 0
    sleep $WAIT_STEP
    timeout_now=$((timeout_now - WAIT_STEP))
    steps=$((steps + 1))
  done
  return 1
}

total=0
passed=0
failed_names=()

check() {
  # check <name> <command...>
  # Runs command, exits 0 = pass, non-zero = fail.
  local name="$1"; shift
  total=$((total + 1))
  log ""
  log "→ $name"
  if "$@"; then
    passed=$((passed + 1))
    pass "$name"
  else
    failed_names+=("$name")
    fail "$name"
  fi
}

# ── Checks ───────────────────────────────────────────────────────

check_api_health() {
  local body code
  body=$(mktemp)
  code=$(curl -s -o "$body" -w "%{http_code}" --max-time 10 "$API_URL/v1/health")
  if [[ "$code" != "200" ]]; then
    rm -f "$body"
    return 1
  fi
  # Response should look like {"status":"ok",...}
  if grep -q '"status"' "$body"; then
    rm -f "$body"
    return 0
  fi
  rm -f "$body"
  return 1
}

check_api_openapi() {
  # openApiHandler returns buildSuccess(spec): { success, data: { openapi, paths } }.
  # A top-level "openapi" key is the old shape and is not what the API serves.
  local body code
  body=$(mktemp)
  code=$(curl -s -o "$body" -w "%{http_code}" --max-time 20 "$API_URL/v1/openapi.json" 2>/dev/null || echo "000")
  if [[ "$code" != "200" ]]; then
    rm -f "$body"
    return 1
  fi
  if node -e '
    const fs = require("fs");
    const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const spec = j && j.data;
    if (!spec || typeof spec.openapi !== "string" || !/^3\./.test(spec.openapi)) process.exit(1);
    if (!spec.paths || typeof spec.paths !== "object") process.exit(1);
  ' "$body"; then
    rm -f "$body"
    return 0
  fi
  rm -f "$body"
  return 1
}

check_portal_index() {
  local body
  body=$(curl -sf --max-time 5 "$PORTAL_URL/" 2>/dev/null) || return 1
  # Portal serves HTML; look for <html or Maplespike
  if echo "$body" | grep -qiE '<html|maplespike'; then
    return 0
  fi
  return 1
}

check_mcp_health() {
  # quill-mcp index.ts answers GET /health with {"status","tools"}.
  local body code
  body=$(mktemp)
  code=$(curl -s -o "$body" -w "%{http_code}" --max-time 5 "$MCP_URL/health" 2>/dev/null || echo "000")
  if [[ ! "$code" =~ ^2 ]]; then
    rm -f "$body"
    return 1
  fi
  if grep -q '"status"' "$body"; then
    rm -f "$body"
    return 0
  fi
  rm -f "$body"
  return 1
}

# ── Run ──────────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════"
log "MapleSpike E2E Smoke Test"
log "  API    = $API_URL"
log "  MCP    = $MCP_URL"
log "  Portal = $PORTAL_URL"
log "═══════════════════════════════════════════════════"

log ""
log "▶ Waiting for endpoints (timeout ${WAIT_TIMEOUT}s)…"

wait_http "$API_URL/v1/health"    && pass "API health responding"    || fail "API health never responded"
wait_http "$PORTAL_URL/"          && pass "Portal index responding"  || fail "Portal index never responded"
wait_http "$MCP_URL/health"       && pass "MCP health responding"    || fail "MCP health never responded"

check "API /v1/health returns 200 with status field"     check_api_health
check "API /v1/openapi.json wraps the spec in data"      check_api_openapi
check "Portal / serves HTML"                            check_portal_index
check "MCP /health responds"                            check_mcp_health

# ── Summary ──────────────────────────────────────────────────────
log ""
log "═══════════════════════════════════════════════════"
if [[ ${#failed_names[@]} -eq 0 ]]; then
  log "✓ All ${passed} checks passed"
  log "═══════════════════════════════════════════════════"
  exit 0
fi
log "✗ ${#failed_names[@]} of ${total} checks failed:"
for name in "${failed_names[@]}"; do
  log "    - $name"
done
log "═══════════════════════════════════════════════════"
echo ""
echo "Tip: ./scripts/dev-up.sh --logs  # follow container logs"
exit 1
