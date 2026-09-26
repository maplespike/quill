#!/usr/bin/env bash
set -euo pipefail

# Injected-copy resolution guard (#859 class) — thin wrapper.
#
# Verifies, after a build, that every consumer's @maplespike/* workspace
# dependency resolves to an existing file and that no consumer resolves
# through a stale pnpm injected copy (a copy materialised at `pnpm install`
# time, before dist/ existed, and never refreshed — pnpm #4407). That copy
# staleness is what made `ERR_MODULE_NOT_FOUND` break CI four times:
# #859, the api server in Live Data Check (2026-09-22), qa-module-validation /
# test-framework, and attestation-chain (fixed by 879f0cf).
#
# All logic lives in the sibling .mjs so the regression test can import it.
# Run from the repo root, after `bash scripts/build-packages.sh`.

cd "$(dirname "$0")/.."
exec node scripts/check-workspace-resolution.mjs
