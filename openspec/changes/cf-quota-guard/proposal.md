# Proposal: App-side Cloudflare free-tier quota guard

## Why

Infra keeps a Workers KV flag `quota:<service>` (`ok` or `over`) so Quill does not write D1, KV, or R2 past the free plan. The app must read that flag before every Cloudflare data write and stay on the in-cluster store when the flag is not `ok`. A missed check can bill. The free plan is the ceiling. This change stays at $0.

## What Changes

- Add one storage guard. It reads `quota:d1`, `quota:kv`, and `quota:r2`, caches each flag for 60 seconds, and rejects oversized payloads.
- Route the existing D1 and KV writers through that guard: API `D1Storage` and `KVCache`, the edge AI audit log, the neuron counter, and both rate-limit KV writes.
- Fail closed. `over`, a missing key, an unknown value, and a failed read use SQLite, Redis, or the in-process store. They do not use Cloudflare.
- Keep size caps and TTLs as named constants, under the free-plan ceilings.
- No new paid API, no new binding id, no account id, no token in the repo.

## Capabilities

### New Capabilities

- `cf-quota-guard`: Cloudflare data writes obey Infra's `quota:<service>` flag and the free-plan size and TTL caps.

### Modified Capabilities

- None.

## Impact

- Packages: `@maplespike/api-server`, `packages/edge-worker`.
- API contract: no new route. Storage selection changes only when a D1 binding is present and the flag is not `ok`.
- Cluster chart: one plain env var, `CF_QUOTA_FLAG_TTL_MS`. No secret.
- Dependencies: none.
