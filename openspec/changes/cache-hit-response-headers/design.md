# Design: one header helper for every Node response

## Data flow

1. `applyCorsAndSecurityHeaders` calls `applySecurityHeaders`, then `applyCorsHeaders`.
2. `finalizeResponse`, `jsonResponse`, and `corsPreflight` call that helper. A cache miss still leaves `handleRequest` with the headers already set.
3. `createNodeRequestListener` writes every public response with `sendNodeResponse`. That function calls the same helper, then copies rate-limit headers that are not already present.
4. A Redis hit never calls `handleRequest`. It still calls `sendNodeResponse`, so the origin of the current request decides `Access-Control-Allow-Origin`.

## Early returns

| Path | Before | After |
| --- | --- | --- |
| Redis cache hit | `Content-Type` and `X-Cache-Status` only | Shared helper |
| Rate limit 429 | No CORS or security headers | Shared helper |
| Listener catch 500 | No CORS or security headers | Shared helper |
| OPTIONS preflight | Already wrapped by `finalizeResponse` | Same helper, unchanged values |
| 304 | No 304 response exists | No new branch |
| Public `/metrics` 404 | Plain text, no CORS | Shared helper |
| Private metrics listener | Plain text | Left unchanged |

The in-memory route cache and the Express-style rate-limit middleware call the same helper, so a later caller cannot drop the headers.

## Security

CORS stays allow-list based. An unknown origin still receives `Access-Control-Allow-Origin: null`. HSTS is still set only when the environment is `production`.

## Rollout

Ship with the API image. No migration. Rollback is a revert of this change. Cached bodies stay valid because the cache stores the body, not the headers.
