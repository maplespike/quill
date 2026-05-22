#!/usr/bin/env bash
set -euo pipefail

# Build packages in explicit topological order.
# Turbo's dependsOn: ["^build"] should handle this but races on CI
# (mcp-server starts before pipeline-core finishes writing .d.ts files).

# Layer 0: no workspace deps
pnpm --filter @maplespike/database build
pnpm --filter @maplespike/legal-core build
pnpm --filter @maplespike/legislation build
pnpm --filter @maplespike/sdk build

# Layer 1: depends on layer 0
pnpm --filter @maplespike/pipeline-core build
pnpm --filter @maplespike/engine build

# Layer 2: depends on layer 1
pnpm --filter @maplespike/mcp-server build
pnpm --filter @maplespike/api-server build

# Layer 3: standalone builds
pnpm --filter @maplespike/docs build
pnpm --filter @maplespike/portal build
pnpm --filter @maplespike/dashboard build
