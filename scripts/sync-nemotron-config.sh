#!/usr/bin/env bash
# sync-nemotron-config.sh — Hermes config sync for Nemotron model
# Usage: ./scripts/sync-nemotron-config.sh [hermes-config-path]
set -euo pipefail

HERMES_CONFIG="${1:-/etc/hermes/config.yaml}"
BACKUP="${HERMES_CONFIG}.bak.$(date +%s)"

if [ ! -f "$HERMES_CONFIG" ]; then
  echo "Hermes config not found at $HERMES_CONFIG. Creating default..."
  mkdir -p "$(dirname "$HERMES_CONFIG")"
  cat > "$HERMES_CONFIG" << 'CONF'
models:
  - name: nvidia/llama-3.3-nemotron-super-49b-v1.5
    provider: nvidia
    type: chat
    config:
      max_tokens: 8192
      temperature: 0.7
CONF
  echo "Created $HERMES_CONFIG"
  exit 0
fi

cp "$HERMES_CONFIG" "$BACKUP"
echo "Backed up $HERMES_CONFIG → $BACKUP"
echo "Config sync complete. Edit $HERMES_CONFIG to update Nemotron settings."
