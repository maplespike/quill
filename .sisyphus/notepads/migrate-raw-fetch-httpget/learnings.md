# Learnings — Migrate raw fetch() → httpGet()

## Key patterns

- `resp.json()` returns `Promise<unknown>` (not `Promise<any>` like native fetch). Must cast: `const data: any = await resp.json()` or use generic: `await resp.json<any>()`
- `resp.body` replaces `await r.text()` — body is already a string
- `resp.statusCode >= 400` replaces `!r.ok` check
- All `AbortSignal.timeout(N)`, `AbortController` + `setTimeout`/`clearTimeout` removed — httpGet handles timeout via `timeoutMs` option
- httpGet already sets default User-Agent; custom UAs preserved for backward compat
- httpGet does 3 retries with exponential backoff + jitter automatically
- Import path: `../../utils/http.js` from 2-deep subdirs; `../utils/http.js` from `ingestion/*.ts` top-level; `../../../utils/http.js` from `ingestion/geospatial/lode/`

## Files migrated (23 total)

gov-api.ts (4 fetch calls), rss.ts (1), a2aj/fetcher.ts (1), federal/fetcher.ts (1), universities/fetcher.ts (2), culture/index.ts (2 helper functions), defence/fetcher.ts (2), science-research/mitacs.ts (1), science-research/onc.ts (2), science-research/csa.ts (1), cross-reference/fetcher.ts (1), media-broadcasting/fetcher.ts (1), unions/fetcher.ts (1), legislation/fetcher.ts (2 helpers), real-time-feeds/fetcher.ts (1), provincial/fetcher.ts (1), regional-authorities/fetcher.ts (1), municipal-long-tail/fetcher.ts (1), corporate-filings/fetcher.ts (1), veterans/fetcher.ts (3 helpers), geospatial/lode/fetcher.ts (2 helpers), geospatial/fetcher.ts (1), federal-tribunals/index.ts (1)
