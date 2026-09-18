# tasks — watchlist-alerts-v1

## 1. API

- [ ] 1.1 `POST /v1/watches` — create watch (subject, kind, delivery, filters); validates plan limit
- [ ] 1.2 `GET /v1/watches` — list tenant watches; `DELETE /v1/watches/:id` — remove
- [ ] 1.3 Metering: per-plan watch count + event volume; 429 with upgrade hint on limit
- [ ] 1.4 `?dry_run=1` preview — returns the rendered alert without sending

## 2. Delivery

- [ ] 2.1 Subscribe `notification-service` to watcher change events (poll path already exists)
- [ ] 2.2 Email template with provenance block (source URL, fetchedAt, change id, claim hash when present)
- [ ] 2.3 Webhook dispatcher — HMAC-signed payload, 3 retries with backoff, disable after sustained failure
- [ ] 2.4 Digest batching (daily window) vs realtime switch per watch

## 3. Provenance

- [ ] 3.1 Event payload carries `evidence` object; absent evidence = event not delivered
- [ ] 3.2 Reuse the existing HMAC subject-hash scheme for stored watch subjects (Decision 0002)
- [ ] 3.3 Cross-reference events cite `/v1/claims/verify/{hash}` when the change record has a claim bundle

## 4. Portal + plans

- [ ] 4.1 `/watcher` page: create/list/delete + delivery preference; reads plan limits from `plans.json`
- [ ] 4.2 Plan limits block added to `generate-plans.mjs` output (single source for copy + enforcement)

## 5. Verification

- [ ] 5.1 Create watch → simulate registry change → dry-run email contains the evidence block
- [ ] 5.2 Free account's second watch rejected with 429 + upgrade hint
- [ ] 5.3 Webhook signature verifies against the documented HMAC scheme (negative control: tampered body fails)
- [ ] 5.4 OpenSpec change validated and archived after implementation
