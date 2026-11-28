## Context

`service-metrics` already provides private Prometheus listeners on 9464 (API) and 9465 (MCP), ClusterIP Services, and monitoring-only NetworkPolicies. The shipped Grafana dashboards query four auth/billing series that have no emitter. The API resolves an authenticated tenant in `handleRequest`; the MCP server dispatches every JSON-RPC message through `handleMessage`, and quota/payment decisions happen in `handleToolCall`.

## Goals / Non-Goals

**Goals:**
- Emit the four dashboard series from the existing private metrics surfaces.
- Count distinct callers once per five-minute window with bounded memory.
- Keep raw and hashed caller identifiers out of exposition.
- Make the counters readable as zero before the first event.

**Non-Goals:**
- Change API or MCP protocol contracts, billing logic, or dashboard JSON.
- Add a dependency, a new listener, a persistent store, or a cluster mutation.
- Count anonymous API callers or local stdio MCP sessions as hosted tenants/identities.

## Decisions

1. **Observe API tenants in `handleRequest`, not in the HTTP listener.** The listener sees cached and rate-limited responses but has no tenant object; re-authenticating there would duplicate work. The trade-off is that a request short-circuited before `handleRequest` does not refresh the tenant's activity timestamp, which is acceptable for an "active tenant" gauge.
2. **Observe MCP identities in `server.handleMessage`.** This is the single per-message choke point shared by SSE, hosted streamable HTTP, and stdio. The hosted HTTP transport batches messages, so observing in `index.ts` would undercount by batch; observing per message is correct.
3. **Hash caller IDs into an in-memory set; never render them.** API tenant IDs and already-hashed MCP identity labels are hashed again with SHA-256 before insertion. The rendered series are aggregate gauges only, plus one allowlisted `tier` breakdown.
4. **Use a five-minute window with a 4096-entry cap.** Expired entries are pruned on write and render; when the cap is reached the oldest insertion is evicted. This bounds memory even under hostile traffic. A zero gauge is always emitted.
5. **Count payment attempts, not successful charges.** The dashboard legend is "Payment calls"; the counter increments when a parsed proof is present with x402 enabled, before validation. Quota hits increment only at the actual preflight denial site.

## Risks / Trade-offs

- [Tenant activity misses listener short-circuits] → Documented in decision 1; no auth duplication, and the gauge still reflects authenticated handler traffic.
- [Memory growth under many identities] → 4096-entry cap with oldest-first eviction and TTL pruning; tested.
- [Customer identifier leakage] → Double hashing, aggregate exposition, allowlisted tier labels, and privacy assertions in both metric test files.
- [Counter drift at batch boundaries] → MCP identity and payment observations are per message; quota denial is per tool call.
- [New series invisible until image re-pin] → Rebuild and re-pin API/MCP images after merge; dashboards already query the names, so no dashboard change is needed.

## Data Flow

API: `authenticateRequest` → `ctx.tenant` in `handleRequest` → `apiMetrics.recordTenant` → private 9464 `/metrics` → VMServiceScrape → Grafana.

MCP: `handleMessage(identity)` / `handleToolCall(proof, quota gate)` → `mcpMetrics.recordIdentity` / `recordPaymentAttempt` / `recordQuotaDenied` → private 9465 `/metrics` → VMServiceScrape → Grafana.

## Rollout and Rollback

Rollout is the normal Quill merge, image rebuild, digest re-pin, and ArgoCD sync. Rollback is a new PR reverting the emitter code plus a fresh image rebuild/re-pin; the metrics are in-memory only, so no stored state needs migration.

## Open Questions

- None. Dashboard retention and alerting thresholds are unchanged by this additive metric work.
