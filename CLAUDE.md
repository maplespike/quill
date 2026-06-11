# MapleSpike — Claude Code Quickstart

## First time
```bash
pnpm install
pnpm run build
```

## Dev workflow
```bash
pnpm --filter @maplespike/pipeline-core run build
cd packages/mcp-server && pnpm start           # MCP stdio mode
cd packages/api-server && pnpm run dev          # API on :8082
cd packages/dashboard && pnpm dev               # Dashboard on :4322
```

## Key files
- `packages/pipeline-core/src/ingestion/registry.ts` — All 126+ modules registered here
- `packages/mcp-server/src/tools/index.ts` — All 135 MCP tools
- `packages/api-server/src/index.ts` — API routes
- `docs/metrics.json` — Auto-generated module/tool counts

## Patterns
- Modules: `constants.ts` → `types.ts` → `fetcher.ts` → `parser.ts` → `index.ts` → `__tests__/`
- Always `pnpm build` before committing
- Keep tests passing: `pnpm --filter @maplespike/pipeline-core test`
