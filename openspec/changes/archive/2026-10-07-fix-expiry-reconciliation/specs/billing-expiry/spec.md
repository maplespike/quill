## ADDED Requirements

### Requirement: Secret-only expiry authentication

The gateway SHALL dispatch POST `/v1/billing/reconcile-expiry` (including its optional trailing slash) without a tenant API key. The handler MUST reject missing, empty, wrong, or unconfigured billing secrets before storage mutations. Tenant routes MUST retain their API-key and tier boundaries.

#### Scenario: Scheduler request

- **GIVEN** a configured billing secret and isolated expired paid tenants
- **WHEN** the caller sends only the matching `X-Billing-Secret`
- **THEN** the gateway reaches the expiry handler and returns HTTP 200.

#### Scenario: Unauthorized caller

- **GIVEN** absent or invalid operator authorization, including a valid tenant key alone
- **WHEN** the caller requests expiry
- **THEN** HTTP 403 is returned without tenant changes.

#### Scenario: Tenant boundary

- **GIVEN** a billing-secret header without a tenant key
- **WHEN** the caller requests checkout, status, or tenant usage
- **THEN** tenant authentication still rejects the request.

### Requirement: Observable expiry execution

The handler SHALL downgrade only non-free tenants whose period end is strictly before now, audit successful downgrades, and expose failures as HTTP 500. Retries SHALL not duplicate completed downgrades.

#### Scenario: Mixed and repeated run

- **GIVEN** expired, boundary-time, future, unset-period, and free tenants
- **WHEN** an authorized empty-body request runs and repeats
- **THEN** only expired paid tiers change; the repeat reports zero processed and no duplicate audit.

#### Scenario: Partial write failure

- **GIVEN** one expired tenant update fails and another succeeds
- **WHEN** reconciliation runs and then retries after recovery
- **THEN** the first run returns HTTP 500 and the retry completes only the failed tenant.

### Requirement: Owned nightly scheduler

The chart SHALL render the expiry CronJob only when `billing.reconcileExpiry.enabled` is true. It MUST use the existing daily schedule, required billing secret, release-scoped Service and namespace, configured API port, bounded execution, and failure-sensitive curl without logging response bodies.

#### Scenario: Chart rendering

- **GIVEN** default, production, and renamed-release values
- **WHEN** Helm renders locally
- **THEN** default installs omit the job, production includes it, and renamed targets resolve within that release's namespace.

#### Scenario: Scheduler failure

- **GIVEN** a local test HTTP server returning success or failure
- **WHEN** the rendered job command runs with a synthetic secret
- **THEN** success exits zero, HTTP failure exits nonzero, and neither response bodies nor the secret appear in output.
