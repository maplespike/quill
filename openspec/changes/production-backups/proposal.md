## Why

The production SQLite database and the search index have no copy that survives the volume they live on. The search claim does not set a storage class, so it follows the cluster default and sits on one node disk. A lost volume is a lost database.

## What Changes

- Daily backup CronJobs for the API SQLite file, the search index, and Postgres when that StatefulSet is enabled.
- A Longhorn backup claim with 14-day retention, a freshness CronJob, and a weekly restore drill.
- A new Longhorn claim for the search index, plus a one-time copy from the legacy claim.
- `scripts/restore-drill.sh` and `docs/ops/BACKUPS.md`.

## Capabilities

### New Capabilities

- `production-backups`: Daily durable copies of Quill's stateful stores, a freshness check, and a scratch restore drill.

### Modified Capabilities

- None.

## Impact

- Chart templates and production values only. No API or MCP contract change. No new package dependency. No licence or compliance change.
- Redis stays an emptyDir cache. Qdrant is outside this chart and is not backed up here.
