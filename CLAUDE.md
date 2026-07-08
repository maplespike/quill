---
last-reviewed: 2026-07-07
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
cd packages/dashboard && pnpm dev               # Dashboard on :4322
```

## Key files
- `packages/pipeline-core/src/ingestion/registry.ts` — All 198 modules registered here
- `packages/quill-mcp/src/tools/index.ts` — All Quill (MCP) tools (see docs/products/quill.md for product brief)
- `packages/api-server/src/index.ts` — API routes
- `docs/metrics.json` — Auto-generated module/tool counts

## Patterns
- Modules: `constants.ts` → `types.ts` → `fetcher.ts` → `parser.ts` → `index.ts` → `__tests__/`
- Always `pnpm build` before committing
- Keep tests passing: `pnpm --filter @maplespike/pipeline-core test`
