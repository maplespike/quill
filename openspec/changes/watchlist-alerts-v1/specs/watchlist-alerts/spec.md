## ADDED Requirements

### Requirement: Watch creation and management

The API SHALL let an authenticated tenant create, list, and delete watches on a subject (entity, keyword, or registry filter) with a per-watch delivery preference, subject to per-plan limits from `plans.json`.

#### Scenario: Create a watch

- **WHEN** an authenticated tenant POSTs a valid watch to `/v1/watches`
- **THEN** the watch SHALL be stored tenant-scoped, SHALL appear in `GET /v1/watches`, and SHALL be removable via `DELETE /v1/watches/:id`

#### Scenario: Plan limit enforced

- **WHEN** a Free-plan tenant attempts to create a watch beyond the Free limit
- **THEN** the API SHALL reject with HTTP 429 and an upgrade hint, and the rejection SHALL NOT store a partial watch

### Requirement: Alerts carry provenance

Every delivered alert event SHALL include an evidence object with the source URL, retrieval timestamp, and change record id; where the change record carries a claim bundle, the event SHALL cite its verification hash.

#### Scenario: Evidence block present

- **WHEN** a watched subject changes and an alert is generated (including `?dry_run=1` previews)
- **THEN** the rendered event SHALL contain `evidence.sourceUrl`, `evidence.fetchedAt`, and `evidence.changeId`

#### Scenario: Missing evidence blocks delivery

- **WHEN** a change record cannot produce an evidence object
- **THEN** the event SHALL NOT be delivered, and the failure SHALL be logged with the change record id

### Requirement: Delivery channels

Alerts SHALL be delivered by email (through `notification-service`) and, for plans that include webhooks, by HMAC-signed HTTP POST with retry and failure disablement.

#### Scenario: Email delivery

- **WHEN** a watch with email delivery triggers
- **THEN** `notification-service` SHALL send the alert to the tenant contact through the configured SMTP path, and dry-run mode SHALL render without sending

#### Scenario: Webhook signature verifies

- **WHEN** a webhook delivery is made
- **THEN** the request SHALL carry an HMAC signature header over the body, and a tampered body SHALL fail verification (negative control)

### Requirement: Watch subjects follow the PII policy

Stored watch subjects SHALL reuse the existing HMAC subject-hash scheme (Decision 0002) and SHALL NOT be persisted in plaintext where the policy applies.

#### Scenario: Subject storage

- **WHEN** a watch is stored
- **THEN** the persisted subject representation SHALL match the HMAC scheme used by `notification-service`, and the plaintext subject SHALL NOT appear in the stored record
