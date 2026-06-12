#!/usr/bin/env bash
# =============================================================================
# MapleSpike -- One-Command Startup Script
# =============================================================================
# Installs dependencies, builds all packages, then starts services.
#
# Usage:
#   ./run.sh                       # start all services (API + MCP + Portal)
#   ./run.sh api                   # API server only
#   ./run.sh mcp                   # MCP server only
#   ./run.sh portal                # Portal (frontend) only
#   ./run.sh api,mcp               # API + MCP only
#   ./run.sh --quick               # skip install/build (start existing build)
#   ./run.sh --help                # show full usage
#
# First run copies .env.example -> .env and auto-generates JWT_SECRET.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}==>${NC} $1"; }
ok()   { echo -e "${GREEN}  v${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
fail() { echo -e "${RED}  x${NC} $1"; exit 1; }
info() { echo -e "${CYAN}  i${NC} $1"; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# ---- Parse arguments --------------------------------------------------------
SERVICES=""
SKIP_BUILD=false
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      echo ""
      echo "  MapleSpike -- One-Command Startup"
      echo ""
      echo "  Usage:  ./run.sh [services...] [options]"
      echo ""
      echo "  Services (comma-separated, defaults to all):"
      echo "    api       API server              -> http://localhost:8082"
      echo "    mcp       MCP server (SSE)        -> http://localhost:3001"
      echo "    portal    Astro frontend           -> http://localhost:4321"
      echo ""
      echo "  Options:"
      echo "    --quick   skip install & build (use existing dist/)"
      echo "    --clean   clean build artifacts first"
      echo "    --help    this message"
      echo ""
      exit 0
      ;;
    --quick)    SKIP_BUILD=true ;;
    --clean)    CLEAN=true ;;
    *)          SERVICES="$arg" ;;
  esac
done

# Default: all services
if [ -z "$SERVICES" ]; then
  SERVICES="api,mcp,portal"
fi

IFS=',' read -ra SERVICE_LIST <<< "$SERVICES"

echo ""
echo -e "${BOLD}   MapleSpike${NC}"
echo -e "${BOLD}   ------------${NC}"
echo ""

# ---- Prerequisites ----------------------------------------------------------
log "Checking prerequisites..."

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required. Enable via: corepack enable && corepack prepare pnpm@10 --activate"

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  fail "Node.js >=18 required (found v$(node --version))"
fi

ok "Node $(node --version), pnpm $(pnpm --version)"

# ---- Environment file -------------------------------------------------------
log "Setting up environment..."

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env created from .env.example -- review and edit as needed"
  else
    fail "No .env.example found"
  fi
fi

# Source .env without requiring export
set -a
source .env
set +a

# Auto-generate JWT_SECRET if not set or still default
if [ -z "${JWT_SECRET:-}" ] || \
   [ "${JWT_SECRET}" = "change-in-production" ] || \
   [ "${JWT_SECRET}" = "maplespike-jwt-secret-change-in-production" ]; then

  NEW_SECRET=$(openssl rand -hex 64 2>/dev/null \
    || node -e "const c=require('crypto');process.stdout.write(c.randomBytes(64).toString('hex'))" 2>/dev/null \
    || echo "dev-$(date +%s)-$(hostname)")

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_SECRET}/" .env
  else
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_SECRET}/" .env
  fi
  ok "JWT_SECRET auto-generated and saved to .env"
fi

# Re-source after potential JWT_SECRET update
set -a
source .env
set +a
ok "Environment loaded from .env"

# ---- Clean (optional) -------------------------------------------------------
if [ "$CLEAN" = true ]; then
  log "Cleaning build artifacts..."
  pnpm clean 2>/dev/null || true
  ok "Clean complete"
fi

# ---- Install & Build --------------------------------------------------------
if [ "$SKIP_BUILD" = false ]; then
  log "Installing dependencies..."
  pnpm install --frozen-lockfile 2>&1 | tail -1
  ok "Dependencies installed"

  log "Building packages..."
  case "${SERVICES}" in
    api)
      pnpm build --filter=@maplespike/api-server 2>&1 | tail -1
      ;;
    mcp)
      pnpm build --filter=@maplespike/database --filter=@maplespike/mcp-server 2>&1 | tail -1
      ;;
    portal)
      pnpm build --filter=@maplespike/portal 2>&1 | tail -1
      ;;
    api,mcp|mcp,api)
      pnpm build --filter=@maplespike/database --filter=@maplespike/api-server --filter=@maplespike/mcp-server 2>&1 | tail -1
      ;;
    *)
      pnpm build 2>&1 | tail -3
      ;;
  esac
  ok "Build complete"
else
  log "Skipping install & build (--quick)"
fi

# ---- Start services ---------------------------------------------------------

declare -A LABELS
LABELS[api]="API"
LABELS[mcp]="MCP"
LABELS[portal]="WEB"

declare -A PORTS
PORTS[api]="8082"
PORTS[mcp]="3001"
PORTS[portal]="4321"

PIDS=()

cleanup() {
  echo ""
  log "Shutting down MapleSpike..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  ok "All services stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

start_service() {
  local name="$1"
  local label="${LABELS[$name]}"
  local port="${PORTS[$name]}"
  local cmd

  case "$name" in
    api)
      cmd="node packages/api-server/dist/dev-server.js"
      ;;
    mcp)
      cmd="MAPLESPIKE_LOCALE=${MAPLESPIKE_LOCALE:-en-CA} PORT=${MCP_PORT:-3001} node packages/mcp-server/dist/cli.js"
      ;;
    portal)
      cmd="cd packages/portal && npx astro dev --port ${PORTAL_PORT:-4321}"
      ;;
    *)
      return
      ;;
  esac

  info "Starting ${label} on port ${port}..."

  # Run in background; prefix log lines with the service label
  # shellcheck disable=SC2094
  eval "$cmd" 2>&1 | while IFS= read -r line; do
    echo -e "${BOLD}[${label}]${NC} $line"
  done &
  PIDS+=($!)
}

echo ""
log "Starting services: ${SERVICES}..."

for svc in "${SERVICE_LIST[@]}"; do
  case "$svc" in
    api)     start_service "api" ;;
    mcp)     start_service "mcp" ;;
    portal)  start_service "portal" ;;
    *)       warn "Unknown service: $svc (valid: api, mcp, portal)" ;;
  esac
done

echo ""
echo -e "${BOLD}   MapleSpike running${NC}"
echo ""
echo -e "  ${CYAN}API    ->${NC} http://localhost:${PORTS[api]}/v1/health"
echo -e "  ${CYAN}MCP    ->${NC} http://localhost:${PORTS[mcp]}/sse"
echo -e "  ${CYAN}Portal ->${NC} http://localhost:${PORTS[portal]}"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
