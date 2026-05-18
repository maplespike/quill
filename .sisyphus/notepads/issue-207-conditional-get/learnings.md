## 2026-05-18: Implemented Conditional GET for RSS feeds

- Modified `packages/pipeline-core/src/ingestion/rss.ts` to add ETag/If-Modified-Since caching
- Added `FeedCacheEntry` interface, `feedCache` Map, `CACHE_TTL_MS` (1 hour) before `FetchOptions`
- `fetchFeed` now: checks cache for etag/lastModified -> sets conditional headers -> handles 304 (returns cached parsed body) -> updates cache on 200 -> prunes stale entries when >100
- `httpGet` returns `HttpResponse` with `headers: Record<string, string>` - ETag is in `resp.headers['etag']`, Last-Modified in `resp.headers['last-modified']`
- Cache uses `parseRSS(cached.body)` on cache hit - cached XML string stored, re-parsed each time
- Pruning: when cache exceeds 100 entries, sweep removes entries older than 1 hour
- Build passes: `pnpm -r build` - all 12 packages OK
- No function signatures changed, no deps added, no file persistence
