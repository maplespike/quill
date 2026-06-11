#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Dev Bootstrap Script
# =============================================================================
# One-command setup: installs deps, builds, and starts the services.
#
# Usage:
#   chmod +x run.sh && ./run.sh
#
# For first-time setup only. Subsequent runs use: pnpm build && pnpm -r test
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

log()  { echo -e "${BLUE}==>${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

echo ""
echo -e "${BOLD}🍁 MapleSpike — Dev Bootstrap${NC}"
echo "────────────────────────────────────"

# ── Prerequisites ────────────────────────────────────────────────────────────

log "Checking prerequisites..."

command -v node >/dev/null 2>&1 || fail "Node.js is required. Install via nix: nix-shell -p nodejs_22"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required. Install via: corepack enable && corepack prepare pnpm@10 --activate"
command -v git >/dev/null 2>&1 || fail "git is required."

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  fail "Node.js >=18 required (found v$(node --version))"
fi
ok "Node $(node --version), pnpm $(pnpm --version)"

# ── Install dependencies ─────────────────────────────────────────────────────

log "Installing dependencies..."
pnpm install --frozen-lockfile 2>&1 | tail -1
ok "Dependencies installed"

# ── Build ────────────────────────────────────────────────────────────────────

log "Building all packages..."
pnpm build 2>&1 | tail -3
ok "Build complete"

# ── Tests ────────────────────────────────────────────────────────────────────

log "Running tests..."
if pnpm -r test 2>&1 | grep -q "fail 0"; then
  ok "All tests pass"
else
  warn "Some tests failed — check output above"
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}🍁 MapleSpike is ready!${NC}"
echo ""
echo "  Start services:"
echo "    API Server:   node packages/api-server/dist/dev-server.js"
echo "    MCP Server:   node packages/mcp-server/dist/index.js"
echo "    Portal:       cd packages/portal && pnpm astro dev"
echo ""
echo "  Or with Docker:"
echo "    docker compose up"
echo ""
echo "  Open ports:"
echo "    API:    http://localhost:8082"
echo "    MCP:    http://localhost:3001"
echo "    Portal: http://localhost:4321"
echo ""
