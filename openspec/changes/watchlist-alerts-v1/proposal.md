# watchlist-alerts-v1

## Why

Users can query Quill but cannot be told when something changes. Every audited competitor that sells monitoring — Gnowit vAnalyst ($500–4,000/mo), RegMap ($5,000/mo change feeds) — delivers this with human labour and, in Gnowit's case, no API at all (competitive audit, 2026-09-16). Quill already holds the machinery internally:

- `packages/pipeline-core` — watcher store + change log (`recordChange`, change records with before/after)
- `packages/api-server/src/routes/watcher.ts` — `/v1/watcher/status` and `/v1/watcher/events` (read-only)
- `packages/notification-service` — subscription store, poller, SMTP mailer, templates, HMAC subject hashing (Decision 0002 PII policy)

None of it is exposed as a product: there is no way for a user to register a watch, choose delivery, or receive an alert. Alerts convert the data corpus into a subscription product without waiting for the API-buyer market to mature — the fastest revenue-shaped increment in the transformation plan.

## What Changes

- **Watch CRUD API**: `POST /v1/watches` (subject, kind, filters, delivery preference), `GET /v1/watches`, `DELETE /v1/watches/:id` — tenant-scoped, API-key authenticated.
- **Delivery wiring**: watch hits dispatch through `notification-service` — email first (existing SMTP mailer), then webhooks (v1) with HMAC signature headers.
- **Provenance on every event**: source URL, retrieval timestamp, change record id, and claim-bundle hash where the underlying data is hashed. An alert without a traceable diff is not shippable.
- **Digest vs realtime**: per-watch delivery mode (daily digest batches; realtime for paid tiers).
- **Plan limits + metering**: watch counts and event volumes meter against the existing plans (Free 1 watch / daily digest; Pro 10 watches / realtime email + 1 webhook; Business 100 watches + webhooks). Limits surface from `plans.json`, not hardcoded copy.
- **Dry-run mode**: alert preview without SMTP (`?dry_run=1`) for tests and for users.

## Impact

- Affected specs: `watchlist-alerts` (new capability)
- Affected code: `packages/api-server/src/routes/watcher.ts` (extend), `packages/notification-service/src/*` (tenant-scoped wiring), `packages/pipeline-core` watcher store (read path), `packages/portal/src/pages/watcher` (management UI), `packages/portal/scripts/generate-plans.mjs` (limits block)
- Not in scope: SMS, CRM integrations, arbitrary boolean query language, Slack/Teams connectors
