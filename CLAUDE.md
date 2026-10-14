---
last-reviewed: 2026-10-14
status: active
---

# MapleSpike — Claude Code Quickstart

## First time
```bash
pnpm install
pnpm run build
```

## Dev workflow
```bash
pnpm --filter @maplespike/pipeline-core run build
cd packages/quill-mcp && pnpm start           # Quill (MCP server) stdio mode — see docs/products/quill.md
cd packages/api-server && pnpm run dev          # API on :8082
cd packages/portal && pnpm dev                  # Public site on :4321
```

## Key files
- `packages/pipeline-core/src/ingestion/registry.ts` — ingestion modules. The count is `modules.registryCount` in `docs/metrics.json`.
- `packages/quill-mcp/src/tools/index.ts` — Quill MCP tools (see docs/products/quill.md). The count is `mcpTools.count` in `docs/metrics.json`.
- `packages/api-server/src/index.ts` — API routes
- `packages/portal` — the public site. There is no `packages/dashboard` package; the dashboard is a route in the portal.
- `docs/metrics.json` — generated module, tool, and line counts. Refresh with `node scripts/generate-metrics.mjs`.

## Patterns
- Modules: `constants.ts` → `types.ts` → `fetcher.ts` → `parser.ts` → `index.ts` → `__tests__/`
- Always `pnpm build` before committing
- Keep tests passing: `pnpm --filter @maplespike/pipeline-core test`
