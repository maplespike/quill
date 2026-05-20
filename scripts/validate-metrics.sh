#!/usr/bin/env bash
set -euo pipefail

# Extract the expected MCP tool count from docs/metrics.json
EXPECTED_COUNT=$(jq -r '.mcpTools.count' docs/metrics.json)

# Verify that we got a numeric value
if [[ -z $EXPECTED_COUNT ]] || [[ $EXPECTED_COUNT == "null" ]]; then
  echo "ERROR: Could not extract MCP tool count from docs/metrics.json" >&2
  exit 1
fi

# Files to validate
FILES=(
  README.md
  AGENTS.md
  docs/GAP-ANALYSIS.md
)

# Check each file for the expected phrase
for FILE in "${FILES[@]}"; do
  if [[ ! -f $FILE ]]; then
    echo "WARNING: $FILE not found, skipping" >&2
    continue
  fi
  if ! grep -qE "$EXPECTED_COUNT[[:space:]]+MCP tools" "$FILE"; then
    echo "ERROR: $FILE does not contain the expected '$EXPECTED_COUNT MCP tools' phrase" >&2
    exit 1
  fi
done

# All checks passed
exit 0