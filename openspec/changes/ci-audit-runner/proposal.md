## Why

The ARC runner pool queues dependency audit behind build and test work. The audit is independent and does not need cluster access.

## What Changes

Run the existing dependency audit on a GitHub-hosted runner for all events. Keep its commands, result handling, and existing dependency on build-and-test.

## Capabilities

### New Capabilities

- `ci-audit-runner`: isolate dependency audit from the ARC queue.

### Modified Capabilities

## Impact

Only `.github/workflows/ci.yml` and this change record. No application interfaces, dependencies, cluster capacity, or inference scheduling change.
