# Design

## Context and goals

Flow stays Helm CronJob → gateway → billing-secret guard → SQLite downgrade and audit. Preserve all demonstrated authentication, expiry, retry, and scheduler behavior. Do not change search or deployment policy.

## Decisions

Compare completed downgrades with selected tenants instead of maintaining a second failure flag. Read the case-insensitive Headers API once. Correct the gateway comment to distinguish wrapped public routes from the unwrapped expiry handler.

Generate synthetic API keys directly from fixture IDs instead of storing a map. Keep the mixed tenant fixture and every behavioral case. Copy the focused chart once per test file and clean it with the existing node:test hook. Keep child-process execution asynchronous so the loopback server can respond. Real shell execution already checks syntax.

Use the existing documented `pnpm exec tsx --test scripts/test-reconcile-expiry.mts` path. Do not add a package script or CI step merely to duplicate it. Keep proof in the runbook; required OpenSpec checklists link there.

## Risks and migration

Fewer bookkeeping variables must not hide partial failures or remove security coverage. Rerun the gateway tests, nearby regressions, scheduler command, API typecheck, and documentation/format checks. Full-chart rendering remains a separate search-pin blocker.

No rollout or rollback is part of this pass. Publication still requires operator approval; secret rotation and live payment proof remain separate blockers.
