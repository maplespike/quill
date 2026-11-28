## 1. API Active Tenants

- [x] 1.1 Add a bounded, expiring distinct-tenant tracker to `ApiMetrics`
- [x] 1.2 Record authenticated tenants once in `handleRequest`, excluding the synthetic `anon` tenant
- [x] 1.3 Render `quill_api_active_tenants` and allowlisted `quill_api_active_tenants_by_tier`
- [x] 1.4 Test distinctness, cap eviction, window expiry, tier normalization, and identifier privacy

## 2. MCP Activity and Billing Counters

- [x] 2.1 Add a bounded, expiring distinct-identity tracker to `McpMetrics`
- [x] 2.2 Record hosted identities once per JSON-RPC message in `handleMessage`
- [x] 2.3 Record quota denials at the quota preflight denial site
- [x] 2.4 Record x402 payment attempts where the parsed proof is used
- [x] 2.5 Render the identity gauge and both counters, including zero values
- [x] 2.6 Test hosted/self-hosted filtering, expiry, cap eviction, counters, and identifier privacy

## 3. Verification and Rollout

- [x] 3.1 OpenSpec proposal, specs, design, review, and tasks written before implementation
- [x] 3.2 Focused API metrics tests pass
- [x] 3.3 Focused MCP metrics tests pass
- [x] 3.4 API and MCP typechecks pass
- [ ] 3.5 Full CI passes on the exact PR head
- [ ] 3.6 Rebuild and re-pin the Quill API/MCP images after merge, then verify the series in VictoriaMetrics

## Verification Notes

`pnpm --filter @maplespike/api-server exec node --import tsx --test src/metrics.test.ts`: 7/7 pass. `pnpm --filter @maplespike/quill-mcp exec node --import tsx --test src/metrics.test.ts`: 4/4 pass. Both package typechecks pass. Full CI and the image re-pin are still pending and are tracked by unchecked tasks 3.5 and 3.6.
