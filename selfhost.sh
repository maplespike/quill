#!/usr/bin/env bash
# =============================================================================
# Quill — One-touch self-hosting
# =============================================================================
# Brings up the entire Quill stack (API + MCP + Portal) on any Linux box with
# podman + Nix, using the Nix-generated Podman Quadlet units.
#
#   ./selfhost.sh up      # build images (nix) + install quadlets + start
#   ./selfhost.sh down    # stop + disable the services
#   ./selfhost.sh logs    # tail all three services
#   ./selfhost.sh status  # quick health check
#
# Prereqs: podman, Nix (with flakes), systemd (user or system).
# No Docker. No docker-compose. No manual YAML.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ACTION="${1:-up}"
ROOTLESS=1
if [ "$(id -u)" -eq 0 ]; then ROOTLESS=0; fi

UNIT_DIR="$HOME/.config/containers/systemd/user"
if [ "$ROOTLESS" -eq 0 ]; then UNIT_DIR="/etc/containers/systemd"; fi

case "$ACTION" in
  up)
    echo "==> Building Quill images via Nix (this can take a few minutes)"
    nix build .#quill-api-image .#quill-mcp-image .#quill-portal-image -L

    echo "==> Loading images into podman"
    for svc in api mcp portal; do
      podman load < "result" 2>/dev/null || true
    done

    echo "==> Installing quadlet units -> $UNIT_DIR"
    mkdir -p "$UNIT_DIR"
    for f in "$UNIT_DIR"/*.container "$UNIT_DIR"/*.volume "$UNIT_DIR"/*.network; do
      [ -e "$f" ] || continue
      rm -f "$f"
    done
    # Copy generated unit files from the selfhost generator
    GEN=$(nix build .#selfhost-units --print-out-paths --no-link -L)
    cp -f "$GEN"/* "$UNIT_DIR"/

    if [ "$ROOTLESS" -eq 1 ]; then
      systemctl --user daemon-reload
      systemctl --user enable --now quill-api quill-mcp quill-portal
    else
      systemctl daemon-reload
      systemctl enable --now quill-api quill-mcp quill-portal
    fi
    sleep 2
    echo "✓ Quill self-hosted."
    echo "    Portal:  http://localhost:8080"
    echo "    API:     http://localhost:8082/v1/health"
    echo "    MCP:     http://localhost:3001/sse"
    ;;
  down)
    if [ "$ROOTLESS" -eq 1 ]; then
      systemctl --user disable --now quill-api quill-mcp quill-portal 2>/dev/null || true
    else
      systemctl disable --now quill-api quill-mcp quill-portal 2>/dev/null || true
    fi
    echo "✓ Stopped and disabled."
    ;;
  logs)
    if [ "$ROOTLESS" -eq 1 ]; then
      journalctl --user -u quill-api -u quill-mcp -u quill-portal -f
    else
      journalctl -u quill-api -u quill-mcp -u quill-portal -f
    fi
    ;;
  status)
    echo "API:    $(curl -s -m 3 -o /dev/null -w '%{http_code}' http://localhost:8082/v1/health || echo down)"
    echo "MCP:    $(curl -s -m 3 -o /dev/null -w '%{http_code}' http://localhost:3001/sse || echo down)"
    echo "Portal: $(curl -s -m 3 -o /dev/null -w '%{http_code}' http://localhost:8080/ || echo down)"
    ;;
  *)
    echo "Usage: ./selfhost.sh [up|down|logs|status]"
    exit 1
    ;;
esac
