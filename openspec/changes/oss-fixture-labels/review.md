# Review: Synthetic fixture routes

## Spec Compliance

- [x] Every record is required to carry `synthetic: true` and `FIXTURE`.
- [x] The production-off scenario is testable without a live module.
- [x] The disabled body is required to omit fixture records.

## Design Alignment

- [x] The gate is one environment variable, read from `ctx.env` over `process.env`.
- [x] The route does not import `@maplespike/pipeline-core`.
- [x] Free-tier and auth-exempt entries exist so the off switch is reachable.

## Risk Assessment

- [x] Unknown ids return 404 and do not echo other records.
- [x] Rollback is a revert. No schema change.

## Completeness

- [x] The test covers the flag, the list, one id, a missing id, and the router wiring.

VERDICT: APPROVED
