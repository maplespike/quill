# Clarify expiry repair

## Why

The local repair keeps duplicate failure and fixture state. Its scheduler checks need a clear local invocation without a new test framework or CI policy.

## What Changes

- Derive partial failure from completed downgrades; keep HTTP status and response data unchanged.
- Remove redundant header lookup, key bookkeeping, repeated chart setup, and shell syntax checks already covered by execution.
- Keep the documented scheduler command and link the repair checklist to the runbook instead of repeating status.

## Capabilities

- New: none.
- Modified: `billing-expiry` adds the documented local regression invocation requirement.

## Impact

Expiry gateway comment, handler, focused tests, runbook, and OpenSpec. No API contract changes, dependencies, CI changes, search edits, live billing calls, or deployment.
