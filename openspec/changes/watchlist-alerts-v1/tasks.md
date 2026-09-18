# tasks — watchlist-alerts-v1

## 1. API

- [x] 1.1 `POST /v1/watches` — create watch (sources, events, keyword, delivery, label); validates plan limit
- [x] 1.2 `GET /v1/watches` — list tenant watches (+plan usage); `DELETE /v1/watches/:id` — remove (tenant-scoped 404)
- [x] 1.3 Metering: per-plan active-watch count (free 1 / pro 10 / business 100 / enterprise 1000); 429 `RATE_LIMITED` with upgrade hint on limit
- [x] 1.4 `?dry_run=1` preview — matches against the recent change log, returns sample + wouldFire count, persists nothing
- [x] 1.5 `GET /v1/watches/:id/events` — durable event log per watch with provenance evidence

## 2. Delivery

- [x] 2.1 Matching engine (`watches-engine.ts`) consumes pipeline-core's change log in-process; records a durable `watch_event` per match
- [x] 2.2 Evidence block on every event: `sourceUrl` (from watched-source registry), `detectedAt`, `previousHash`, `currentHash`, `recordCount` — an event without provenance cannot be recorded
- [ ] 2.3 Webhook dispatch — v1 reuses the existing webhook store's dispatcher for `delivery:'webhook'` watches (status recorded: delivered/failed + error). HMAC-signed payloads remain with the webhooks v1 surface; per-watch retry policy deferred
- [ ] 2.4 Digest batching (daily window) vs realtime switch per watch — deferred to v1.1
- [ ] 2.5 Email delivery — deferred: tenants carry only `email_hash` (Decision 0002 PII policy), so there is no plaintext address to send to. Email depends on the client-side pickup flow; see engine header note

## 3. Provenance

- [x] 3.1 Event payload carries `evidence` object (see 2.2)
- [ ] 3.2 HMAC subject-hash reuse — N/A in the API-scoped v1: watches store source ids/keywords, not personal subjects. Returns when email subjects (entities) land
- [ ] 3.3 Cross-reference to `/v1/claims/verify/{hash}` when a change record has a claim bundle — no change events carry claim bundles yet; revisit with the claims pipeline

## 4. Portal + plans

- [ ] 4.1 `/watcher` page: create/list/delete + delivery preference; reads plan limits from `plans.json`
- [ ] 4.2 Plan limits block added to `generate-plans.mjs` output (single source for copy + enforcement) — v1 limits live in `watches-engine.ts` (`WATCH_LIMITS`), to be single-sourced by the pricing-transparency change

## 5. Verification

- [x] 5.1 Create watch → engine run over a simulated change → event carries the evidence block (see `watches.test.ts` runWatchCycle suite)
- [x] 5.2 Free account's second watch rejected with 429 + upgrade hint (see routes suite)
- [ ] 5.3 Webhook signature verifies against the documented HMAC scheme (negative control: tampered body fails) — belongs to the webhooks v1 surface, not added here
- [x] 5.4 OpenSpec change validated; archive after the portal page lands (4.1)
