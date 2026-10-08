## 1. Gateway and state

- [x] 1.1 Reproduce auth and failed-write defects through the gateway with isolated fixtures.
- [x] 1.2 Apply the narrow expiry auth exemption and propagate partial failures.
- [x] 1.3 Verify secret denial, tenant boundaries, time boundaries, repeat execution, and retry.

## 2. Scheduler and delivery

- [x] 2.1 Port the scheduler into Helm with environment opt-in and required secret binding.
- [x] 2.2 Verify rendering, release targets, and the command against a local HTTP server.
- [x] 2.3 Run typecheck and relevant regressions; update local-only proof and archive the change.

Local proof and remaining blockers: [billing runbook](../../../../docs/go-live-runbook.md#local-expiry-proof--not-deployed).
