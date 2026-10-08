# Fix expiry reconciliation

## Why

The existing secret-only expiry caller is stopped by tenant API-key authentication. Its scheduler is outside the active ArgoCD Helm chart.

## What Changes

- Exempt only the matched expiry handler from API-key authentication; retain its fail-closed billing-secret guard.
- Render the existing nightly scheduler in the owned chart, opt-in by environment.
- Prove gateway authentication, expiry state, retries, and rendered job behavior locally. Report failed downgrades as failures.

## Capabilities

- New: `billing-expiry` documents the existing operator contract and repaired integration.
- Modified: none.

## Impact

API gateway, expiry handler, chart, focused tests, and runbook. No new dependencies, payment rails, live credentials, cluster changes, commits, or deployment.
