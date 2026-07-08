# Issue #205: User-Agent Headers - Completion Notes

## Files Modified
- `packages/pipeline-core/src/ingestion/gov-api.ts` — +USER_AGENT const, added to 4 fetch() calls (StatCan, CKAN, Socrata, ArcGIS)
- `packages/pipeline-core/src/curation/ai-gateway.ts` — +USER_AGENT const, added to 1 fetch() in chatComplete
- `packages/pipeline-core/src/curation/provider-router.ts` — +USER_AGENT const, added to 3 fetch() calls (discoverModels, chatComplete, healthCheck)
- `packages/pipeline-core/src/verification/fifth-gen-warfare.ts` — +USER_AGENT const, added to 1 fetch() in chatComplete (NOT curation/ dir as originally specified — lives in verification/)
- `packages/mcp-server/src/tools/api-client.ts` — +USER_AGENT const, added to 1 fetch() in callApi
- `packages/sdk/src/query.ts` — +USER_AGENT const, added to buildHeaders() (actual fetch in index.ts uses buildHeaders)

## Verified Already Correct (no action)
- `packages/pipeline-core/src/ingestion/rss.ts` — default UA: `MapleSpike-Canada/1.0 (+https://github.com/reverb256/quill)`

## UA String Used Consistently
`MapleSpike/0.2 (+https://maplespike.lan)` — defined as `const USER_AGENT` at top of each file

## Build Verification
- pipeline-core: `tsc -b` ✓
- mcp-server: `tsc -b` ✓
- sdk: `tsup` (CJS+ESM+DTS) ✓
- All lsp_diagnostics clean (no new errors)
