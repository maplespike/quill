## 1. Guard

- [x] 1.1 Add the flag reader, 60s cache, size caps, and TTL clamps
- [x] 1.2 Fail closed for `over`, missing, unknown, and error
- [x] 1.3 Add `putR2` with no production caller

## 2. Writers

- [x] 2.1 Select SQLite or Postgres before D1, and skip D1/KV when the flag is not `ok`
- [x] 2.2 Wrap API `D1Storage` and `KVCache`
- [x] 2.3 Wrap edge AI KV and D1 writes and the edge proxy rate-limit KV
- [x] 2.4 Keep Workers AI off when the KV flag is not `ok`

## 3. Config and tests

- [x] 3.1 Document env vars. Do not commit an account id or a token
- [x] 3.2 Set `CF_QUOTA_FLAG_TTL_MS` in the chart
- [x] 3.3 Unit tests for flag states, fallback, size cap, and TTL expiry
