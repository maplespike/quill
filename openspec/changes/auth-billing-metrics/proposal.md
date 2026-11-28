## Why

The shipped `api-server.json` and `quill-mcp.json` Grafana dashboards query `quill_api_active_tenants`, `quill_mcp_active_identities`, `quill_mcp_quota_hits_total` and `quill_mcp_payment_hits_total`, but none of those series has an emitter. Those panels therefore show no data for tenant activity, hosted identity activity, quota denials, or x402 payment attempts.

## What Changes

- Add a bounded rolling-window gauge for distinct authenticated API tenants, with a normalized billing-tier breakdown.
- Add a bounded rolling-window gauge for distinct hosted MCP identities; local stdio identities are excluded.
- Add counters for MCP quota denials and x402 payment attempts.
- Keep all four series aggregate-only: raw tenant IDs, hashed identity strings, tokens, and query text never appear in labels or exposition.
- Add unit tests that pin window expiry, bounded cardinality, zero-value exposition, and privacy.

No API, MCP protocol, storage schema, or cluster manifest contract changes. No new runtime dependency, public endpoint, or deployment step.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `service-metrics`: Add auth/billing activity gauges and counters to the existing private, bounded metrics surface.

## Impact

- `packages/api-server`: `src/metrics.ts`, `src/index.ts`, `src/metrics.test.ts`.
- `packages/quill-mcp`: `src/metrics.ts`, `src/server.ts`, `src/metrics.test.ts`.
- Existing Grafana dashboards need no edit: the new emitters satisfy their current queries.
- Images must be rebuilt and re-pinned after merge through the documented Quill re-pin sequence; otherwise running pods keep the old metrics code.
