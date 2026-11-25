# Proposal: CORS and security headers on cache hits

## Problem

The Node API listener writes a Redis cache hit with only `Content-Type` and `X-Cache-Status`. A cache miss goes through `handleRequest`, which adds CORS and OWASP security headers. A browser fetch of `/v1/health` from the portal fails when the response is a hit.

The same gap exists on the listener's rate-limit `429` and on its `500` error path.

## Proposed fix

Add one helper, `applyCorsAndSecurityHeaders`. The handler path and the Node listener both call it. The listener writes every response through one function, including cache hits, rate-limit rejections, server errors, and the public `/metrics` 404.

## Affected packages

- `@maplespike/api-server`

## Contracts

No route, status code, or response body changes. Header values on a cache hit match the miss for the same request origin. No new dependency.

## Out of scope

- The private Prometheus listener on `QUILL_API_METRICS_PORT`. It is not a browser API.
- Search backups, suspended ingest jobs, and the other items in the 2026-11-09 health audit.
