# Design: App-side Cloudflare free-tier quota guard

## Data flow

1. Infra writes `quota:<service>` = `ok` or `over` in Workers KV.
2. A writer calls `CfQuotaGuard.flag(service)`.
3. The guard returns the cached flag when it is younger than `CF_QUOTA_FLAG_TTL_MS` (default 60s, clamped to 1s–300s).
4. The reader is the `QUOTA_FLAGS` binding when that binding exists. Else, if `CF_QUOTA_KV_ACCOUNT_ID`, `CF_QUOTA_KV_NAMESPACE_ID`, and `CF_QUOTA_KV_API_TOKEN` are all set, one free-plan KV REST GET. Else the read throws.
5. Only the value `ok` (after trim) opens Cloudflare. `over`, empty, unknown, and thrown errors select the in-cluster store.
6. The payload must be at or under the service cap. A larger payload throws `CfSizeCapError`. Neither store is written.

## Writers

| Path | Service | In-cluster fallback |
| --- | --- | --- |
| `openStorage` when `env.DB` is set | d1, kv | `MemoryStorage` / `MemoryCache`. Postgres and SQLite are chosen first and never call D1. |
| `D1Storage` via `guardD1Binding` | d1 | `MemoryD1` if the flag flips after D1 was selected |
| `KVCache` via `guardKvBinding` | kv | `MemoryKv` |
| Edge AI neuron counter, rate limit, audit log, retention | kv, d1 | In-process `MemoryKv` / `MemoryD1` |
| Edge proxy IP rate limit | kv | In-process `MemoryKv` |
| `putR2` | r2 | Caller-supplied store. No production caller yet. |

`API_KEYS` is read for auth and is not written. The Cache API `caches.default.put` is not D1, KV, or R2.

Pipeline modules that take a `D1Database` argument use the local SQLite adapter. They do not call Cloudflare.

## Caps

- D1 row: 32 KiB. Free plan stores 5 GB and rejects a row above 2 MiB.
- KV value: 32 KiB. Free plan stores 1 GB and allows 25 MiB per value.
- R2 object: 1 MiB. Free plan includes 10 GB-month.
- KV TTL: 60 seconds minimum (the free API rejects less), 48 hours maximum. A missing TTL becomes 1 hour.
- D1 audit retention: 7 days. The scheduled job deletes older rows. Config cannot raise the cap.

## Security

The REST token and account id are read from the environment at call time. They are not logged, not given defaults, and not committed. A failed REST read throws `quota flag read failed` with no URL.

## Rollback

Revert the patch. Writers go back to the raw bindings. Do that only if Infra has the flag at `ok`, or the free plan can absorb the writes.

## Out of scope

Infra's writer for the flag. Workers Paid features. A new R2 bucket. Moving API key hashes out of KV.
