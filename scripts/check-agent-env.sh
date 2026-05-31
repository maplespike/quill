#!/usr/bin/env bash
# check-agent-env.sh — Pod environment validator for agent containers
# Verifies required env vars are set before agent execution
set -euo pipefail

required_vars=(
  "MAPLESPIKE_GATEWAY_URL"
  "OPENCODE_API_KEY"
  "KELOS_MODEL"
)

missing=0
for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "MISSING: $var"
    missing=$((missing + 1))
  else
    echo "OK: $var=${!var:0:20}..."
  fi
done

if [ "$missing" -gt 0 ]; then
  echo "ERROR: $missing required env vars missing"
  exit 1
fi

echo "All agent env vars OK"
