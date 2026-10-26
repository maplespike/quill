## 1. Chart

- [x] 1.1 Add the backup claim, ConfigMap, and CronJobs
- [x] 1.2 Move the search index to a Longhorn claim and copy the legacy claim once
- [x] 1.3 Open port 5432 only when Postgres is enabled

## 2. Drill and docs

- [x] 2.1 Add `scripts/restore-drill.sh` and the node backup checks
- [x] 2.2 Document each store, the schedule, and the manual cluster steps in `docs/ops/BACKUPS.md`

## 3. Verification

- [x] 3.1 Unit tests for backup, retention, freshness, and the local drill
- [x] 3.2 `helm template` of production values, image-pin check, and network-policy check
- [x] 3.3 Default the backup claim to ReadWriteOnce, pin backup jobs to the API node, and copy the search index with the cached Redis image
