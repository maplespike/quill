## ADDED Requirements

### Requirement: Local scheduler regression invocation

The runbook SHALL document `pnpm exec tsx --test scripts/test-reconcile-expiry.mts` and its Helm prerequisite. Scheduler checks MUST remain local and independent of live billing and cluster access. Focused rendering MUST NOT be reported as full-chart validation.

#### Scenario: Maintainer runs scheduler checks

- **GIVEN** the repository dependencies and Helm CLI are installed
- **WHEN** a maintainer runs the documented command from the repository root
- **THEN** the scheduler regressions run through Helm and a loopback HTTP server without live billing or cluster access.
