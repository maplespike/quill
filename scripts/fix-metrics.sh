#!/usr/bin/env bash
set -euo pipefail
# fix-metrics.sh — Auto-update README and doc metric refs from docs/metrics.json
# Run after: node scripts/generate-metrics.mjs
# Usage:   ./scripts/fix-metrics.sh
# Dry-run: ./scripts/fix-metrics.sh --dry-run

DRY_RUN="${1:-}"
METRICS="docs/metrics.json"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ensure_jq() {
  if ! command -v jq &>/dev/null; then
    echo "Error: jq required. Install: nix-shell -p jq" >&2
    exit 1
  fi
}

read_metric() {
  jq -r "$1" "$ROOT/$METRICS"
}

do_sed() {
  local file="$ROOT/$1" pattern="$2" replacement="$3"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if grep -q "$pattern" "$file" 2>/dev/null; then
      echo "Would update: $1 — $pattern → $replacement"
    fi
  else
    sed -i "s/$pattern/$replacement/g" "$file" 2>/dev/null || true
  fi
}

main() {
  ensure_jq

  if [ ! -f "$ROOT/$METRICS" ]; then
    echo "Error: $METRICS not found. Run 'node scripts/generate-metrics.mjs' first." >&2
    exit 1
  fi

  MODULES=$(read_metric '.modules.registryCount')
  TOOLS=$(read_metric '.mcpTools.count')
  LINES=$(read_metric '.typescript.totalLines')
  PACKAGES=$(read_metric '.typescript.packages')

  echo "=== Metrics from $METRICS ==="
  echo "  Modules: $MODULES"
  echo "  Tools:   $TOOLS"
  echo "  Lines:   $LINES"
  echo "  Pkgs:    $PACKAGES"
  echo ""

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "=== Dry-run mode — no files changed ==="
  fi

  # Update metric patterns in README and docs
  # Pattern: "<number> modules" → "<MODULES> modules"
  do_sed "README.md"   "[0-9]\+ modules"    "$MODULES modules"
  do_sed "README.md"   "[0-9]\+ MCP tools"  "$TOOLS MCP tools"
  do_sed "README.md"   "[0-9]\+ packages"   "$PACKAGES packages"
  do_sed "README.md"   "[0-9]\+ lines TS"   "$LINES lines TS"

  AGENTS_FILES=$(find "$ROOT" -maxdepth 2 -name "AGENTS.md" 2>/dev/null || true)
  for f in $AGENTS_FILES; do
    local rel="${f#$ROOT/}"
    do_sed "$rel" "[0-9]\+ modules"   "$MODULES modules"
    do_sed "$rel" "[0-9]\+ MCP tools" "$TOOLS MCP tools"
    do_sed "$rel" "[0-9]\+ packages"  "$PACKAGES packages"
  done

  echo ""
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "Dry-run complete. Run without --dry-run to apply."
  else
    node "$ROOT/scripts/generate-metrics.mjs"
    echo "✓ Metrics and docs synchronized."
  fi
}

main
