# 2026-05-18: Issue #211 — Upstream health probes per data source

## Changes Made
- `packages/pipeline-core/src/utils/http.ts`: Added `method` field to `HttpGetOptions` (supports HEAD for health checks)
- `packages/pipeline-core/src/ingestion/registry.ts`:
  - Added `healthCheckUrl?: string` to `ModuleInfo` interface
  - Added `healthCheckModule()` exported function — HEAD request with 5s timeout, returns `Promise<boolean>`
  - Added health check call in `runModule()` — skips module if upstream unreachable, returns `{ skipped: true, reason }`
  - Added 22 `healthCheckUrl` entries for major modules

## Key Decisions
- 2xx-4xx treated as "healthy" (4xx=endpoint alive, just no data for that request)
- No health check = assumed healthy (backward compatible)
- Used existing `httpGet()` utility with method: 'HEAD' + 5s timeout
- Centralized in registry.ts so all ingestion paths benefit

## Gotchas
- Edit tool can match across non-contiguous regions when oldString appears with gaps — use broader unique context or script-based approach for large files
- Use `node -e` script for batch replacements instead of multiple edit tool calls on large files
