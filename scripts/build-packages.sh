#!/usr/bin/env bash
set -euo pipefail

# Build packages in explicit topological order.
# tsc -b uses project references to resolve types through tsconfig.json
# (not through node_modules), which avoids pnpm store staleness issues.

# Layer 0: packages with no workspace deps (tsup-based)
pnpm --filter @maplespike/legal-core build
pnpm --filter @maplespike/legislation build
pnpm --filter @maplespike/sdk build

# Layer 1: tsc -b packages — built via root tsconfig project references.
# tsc -b handles the dependency graph automatically (database → pipeline-core → quill-mcp/api-server).
# NOTE: use `pnpm exec` — bare `tsc` is NOT on PATH on the self-hosted runner
# (exit 127 broke the Live Data Check lane nightly, 2026-09-18 → 09-21).
pnpm exec tsc -b

# Layer 2: standalone builds
pnpm --filter @maplespike/docs build
pnpm --filter @maplespike/portal build

# Layer 3: repair injected workspace copies.
# inject-workspace-packages=true: pnpm materializes *injected copies* of
# workspace deps inside each .pnpm store package's node_modules/@maplespike/
# at `pnpm install` time — BEFORE tsc builds dist/. They are never recopied
# (pnpm #4407), so runtime ESM resolution through the store fails with
# ERR_MODULE_NOT_FOUND — the api server could never start in the Live Data
# Check lane (2026-09-22). The image builds are unaffected because
# Dockerfile.api/.mcp repair the same copies post-build; this mirrors that.
# The leaf set is derived from packages/* instead of a hardcoded list: the
# hand-maintained list drifted (this script had 7 packages, Dockerfile.api 3,
# Dockerfile.mcp 2) and each omission is an ERR_MODULE_NOT_FOUND waiting for
# the first node step that resolves it — quill-mcp's leaf was the last one
# left stale (2026-09-22). scripts/gates/check-injected-copies.mjs enforces
# the invariant in CI.
for d in node_modules/.pnpm/@maplespike+*@*/node_modules/@maplespike; do
  [ -d "$d" ] || continue
  for pkgdir in packages/*/; do
    p="${pkgdir%/}"; p="${p#packages/}"
    [ -d "packages/$p/dist" ] || continue
    [ -e "$d/$p" ] || continue
    rm -rf "$d/$p"
    ln -s "$PWD/packages/$p" "$d/$p"
  done
done
