# Design

## Context and goals

Flow: Helm CronJob → Service POST → gateway → billing-secret guard → storage downgrade and audit. The current gateway blocks the request before the guard.

## Decisions

Exempt the matched `reconcileExpiryHandler` only. Do not exempt all operator prefixes: other handlers and tenant routes are outside this repair. Keep secret validation in its existing owner. Preserve the route, response data, and strictly-before-now expiry predicate.

Reuse the existing daily schedule, curl image, required `maplespike-secrets/quill-billing-secret`, deadlines, and resources. Derive Service name, namespace, and port from Helm. Default the job off for self-host installs; production values opt in. Make curl return nonzero on HTTP failure and omit response bodies from job logs.

## Risks and migration

A failed tenant update must not make the job report success; return HTTP 500 after attempting the remaining tenants. Retry must only process still-paid expired tenants. Prove with isolated SQLite fixtures and no network requests.

Publishing chart and image changes to ArgoCD's watched branch requires separate production approval and an ops note. This pass does not publish or roll back anything. Secret exposure and live payment remain operator blockers.

## Open questions

None for local implementation. Live image availability, admission/network policy, and successful job execution require authorized deployment verification.
