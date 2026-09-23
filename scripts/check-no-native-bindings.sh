#!/usr/bin/env bash
# Guard: the bigint-buffer native addon must never exist in the dependency tree.
#
# CVE-2025-3194 (GHSA-3gc7-fjrx-p6mg, high, no upstream patch) lives in
# bigint-buffer's native toBigIntLE implementation. Only that addon is
# vulnerable: the shipped pure-JS path performs no raw memory operations.
# pnpm's onlyBuiltDependencies allowlist (pnpm-workspace.yaml) excludes the
# package, so its node-gyp build never runs and no binding is ever produced.
#
# That protection was policy by omission — nothing failed if someone ran
# `pnpm approve-builds`, copied an allowlist line, or a prebuilt binary arrived
# through a different resolution. This script makes it a checked invariant.
#
# Usage: scripts/check-no-native-bindings.sh [root]
#   root defaults to the directory above this script.
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fail=0

# 1. No compiled binding for the vulnerable package anywhere in the tree.
if [ -d "$ROOT/node_modules" ]; then
  hits=$(find "$ROOT/node_modules" -name 'bigint_buffer.node' -print 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "✖ vulnerable native binding present (bigint_buffer.node):" >&2
    printf '  %s\n' "$hits" >&2
    echo "  CVE-2025-3194 lives in this addon. Delete the binding and keep bigint-buffer" >&2
    echo "  out of onlyBuiltDependencies in pnpm-workspace.yaml." >&2
    fail=1
  fi
fi

# 2. The package must not be allowed to build.
if [ -f "$ROOT/pnpm-workspace.yaml" ]; then
  allowlisted=$(awk '/^onlyBuiltDependencies:/{f=1;next} /^[A-Za-z]/{f=0} f' "$ROOT/pnpm-workspace.yaml" \
    | grep -cE '^[[:space:]]*-?[[:space:]]*"?bigint-buffer"?[[:space:]]*$' || true)
  if [ "${allowlisted:-0}" -gt 0 ]; then
    echo "✖ bigint-buffer is listed in onlyBuiltDependencies — its native addon would be built." >&2
    echo "  Remove it from $ROOT/pnpm-workspace.yaml." >&2
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "✅ no bigint_buffer native binding, and the package cannot be built"
