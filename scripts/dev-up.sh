#!/usr/bin/env bash
# =============================================================================
# scripts/dev-up.sh — Boot the MapleSpike local dev stack
# =============================================================================
# Wrapper around `docker compose up` that:
#   - Creates .env from .env.example if missing
#   - Builds images (--build) on first run, or when --rebuild is passed
#   - Streams logs in the foreground by default; --detached runs in background
#   - Waits for API /v1/health to respond before exiting (foreground mode)
#
# Usage:
#   ./scripts/dev-up.sh               # build if needed + boot in foreground
#   ./scripts/dev-up.sh --up          # explicit: boot stack (same as default)
#   ./scripts/dev-up.sh --detach      # boot in background, return immediately
#   ./scripts/dev-up.sh --rebuild     # force rebuild of all images
#   ./scripts/dev-up.sh --down        # tear down the stack
#   ./scripts/dev-up.sh --logs        # follow logs of running stack
#
# Action flags (--up/--down/--logs) are mutually exclusive; last one wins.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Pick the right Compose command (v2 is `docker compose`, v1 is `docker-compose`).
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: docker compose not found. Install Docker Desktop or docker-compose-plugin." >&2
  exit 1
fi

ACTION="up"
REBUILD=""
DETACH=""
WAIT_HEALTH=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach|-d) DETACH="--detach"; shift ;;
    --rebuild) REBUILD="--build --force-recreate --no-deps"; shift ;;
    --up) ACTION="up"; shift ;;
    --down) ACTION="down"; shift ;;
    --logs) ACTION="logs"; shift ;;
    --no-wait) WAIT_HEALTH=0; shift ;;
    -h|--help)
      sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

cd "$PROJECT_ROOT"

# ── Ensure .env exists ──────────────────────────────────────────
if [[ ! -f "$PROJECT_ROOT/.env" && -f "$PROJECT_ROOT/.env.example" ]]; then
  echo "→ No .env found — creating one from .env.example"
  cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
fi

# ── Compose dispatch ─────────────────────────────────────────────
case "$ACTION" in
  down)
    echo "→ Tearing down stack"
    "${COMPOSE[@]}" -f "$COMPOSE_FILE" down --remove-orphans
    exit 0
    ;;
  logs)
    exec "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs -f --tail=200
    ;;
  up)
    BUILD_FLAGS=""
    [[ -n "$REBUILD" ]] && BUILD_FLAGS="$REBUILD"

    echo "→ Building & starting stack ${DETACH:+(detached)}"
    "${COMPOSE[@]}" -f "$COMPOSE_FILE" up $BUILD_FLAGS $DETACH

    # Skip the wait + log tail block below when running detached
    if [[ -n "$DETACH" || "$WAIT_HEALTH" -eq 0 ]]; then
      exit 0
    fi
    ;;
esac

# ── Wait for API health when running attached/interactive ────────
# (skipped in --detach or --no-wait)
if [[ "$ACTION" == "up" && -z "$DETACH" && "$WAIT_HEALTH" -eq 1 ]]; then
  echo ""
  echo "→ Waiting for API /v1/health (max 60s)"
  for i in $(seq 1 60); do
    if curl -fs http://localhost:8082/v1/health >/dev/null 2>&1; then
      echo "✓ API is healthy"
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo "✗ API did not become healthy in time. Try: docker compose logs api" >&2
      exit 1
    fi
    sleep 1
  done

  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║  MapleSpike local stack is up                ║"
  echo "╚══════════════════════════════════════════════╝"
  echo "  Portal:  http://localhost:8080"
  echo "  API:     http://localhost:8082"
  echo "  MCP:     http://localhost:3001"
  echo "  Swagger: http://localhost:8082/v1/openapi.json"
  echo ""
  echo "  Stop with: $0 --down"
  echo "  Tail logs: $0 --logs"
  echo ""
  exec "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs -f --tail=200
fi
